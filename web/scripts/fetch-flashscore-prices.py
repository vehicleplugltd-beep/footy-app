#!/usr/bin/env python3
"""Collect today's Flashscore football match IDs and free pre-match 1X2 prices.

The browser is used only for public match discovery. Odds are then fetched from
Flashscore's public LSApp JSON endpoint. No account or API key is required.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from playwright.async_api import async_playwright

FLASH_URL = "https://www.flashscore.co.uk/football/"
ODDS_URL = "https://global.ds.lsapp.eu/odds/pq_graphql"

BOOKMAKERS = {
    16: "bet365",
    21: "Betfred",
    26: "Betway",
    28: "Ladbrokes",
    263: "BetUK",
    429: "Betfair",
    625: "Unibet UK",
    707: "BetMGM",
    841: "Midnite",
    895: "7Bet",
}

HEADERS = {
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Referer": FLASH_URL,
    "Origin": "https://www.flashscore.co.uk",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    ),
}


def london_kickoff(raw_time: str) -> str | None:
    value = (raw_time or "").strip()
    if ":" not in value:
        return None
    try:
        hour, minute = [int(part) for part in value.split(":", 1)]
        now = datetime.now(ZoneInfo("Europe/London"))
        local = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        return local.astimezone(ZoneInfo("UTC")).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError):
        return None


async def discover_events() -> list[dict]:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        context = await browser.new_context(
            locale="en-GB",
            timezone_id="Europe/London",
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1440, "height": 1100},
        )
        page = await context.new_page()
        await page.goto(FLASH_URL, wait_until="domcontentloaded", timeout=60000)

        try:
            await page.locator("#onetrust-accept-btn-handler").click(timeout=4000)
        except Exception:
            pass

        await page.wait_for_selector(".event__match", timeout=30000)
        await page.wait_for_timeout(1800)

        # Expand public sections conservatively if Flashscore has collapsed them.
        for _ in range(3):
            buttons = page.get_by_text("Show more", exact=True)
            count = await buttons.count()
            clicked = False
            for index in range(min(count, 6)):
                try:
                    await buttons.nth(index).click(timeout=1200)
                    clicked = True
                    await page.wait_for_timeout(250)
                except Exception:
                    continue
            if not clicked:
                break

        rows = page.locator(".event__match")
        count = await rows.count()
        events: list[dict] = []
        seen: set[str] = set()

        for index in range(count):
            row = rows.nth(index)
            raw_id = await row.get_attribute("id")
            if not raw_id:
                continue
            event_id = raw_id.split("_")[-1]
            if not event_id or event_id in seen:
                continue

            try:
                home = (
                    await row.locator(".event__homeParticipant").first.text_content()
                    or ""
                ).strip()
                away = (
                    await row.locator(".event__awayParticipant").first.text_content()
                    or ""
                ).strip()
                raw_time = (
                    await row.locator(".event__time").first.text_content()
                    or ""
                ).strip()
            except Exception:
                continue

            kickoff = london_kickoff(raw_time)
            if not home or not away or not kickoff:
                continue

            seen.add(event_id)
            events.append(
                {
                    "event_id": event_id,
                    "home_team": home,
                    "away_team": away,
                    "commence_time": kickoff,
                }
            )

        await browser.close()
        return events


def parse_1x2(event: dict, payload: dict) -> list[dict]:
    entries = (
        payload.get("data", {})
        .get("findOddsByEventId", {})
        .get("odds", [])
    )
    prices: list[dict] = []

    for entry in entries:
        if entry.get("bettingType") != "HOME_DRAW_AWAY":
            continue
        if entry.get("bettingScope") not in (None, "FULL_TIME"):
            continue

        bookmaker_id = entry.get("bookmakerId")
        try:
            bookmaker_id = int(bookmaker_id)
        except (TypeError, ValueError):
            continue

        # Keep named bookmakers only. Unknown source IDs are ignored until they
        # can be mapped and verified rather than being presented as a bookmaker.
        bookmaker_name = BOOKMAKERS.get(bookmaker_id)
        if not bookmaker_name:
            continue

        items = [item for item in entry.get("odds", []) if item.get("active", True)]
        participant_order: list[object] = []
        for item in items:
            participant_id = item.get("eventParticipantId")
            if participant_id is not None and participant_id not in participant_order:
                participant_order.append(participant_id)

        for item in items:
            participant_id = item.get("eventParticipantId")
            if participant_id is None:
                selection = "draw"
            elif participant_order and participant_id == participant_order[0]:
                selection = "home"
            elif len(participant_order) > 1 and participant_id == participant_order[1]:
                selection = "away"
            else:
                continue

            try:
                price = float(item.get("value"))
            except (TypeError, ValueError):
                continue
            if price <= 1:
                continue

            prices.append(
                {
                    **event,
                    "bookmaker_id": bookmaker_id,
                    "bookmaker_name": bookmaker_name,
                    "market": "1X2",
                    "selection": selection,
                    "decimal_odds": price,
                    "opening_odds": item.get("opening"),
                }
            )

    return prices


async def fetch_event_odds(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    event: dict,
) -> tuple[list[dict], str | None]:
    params = {
        "_hash": "oce",
        "eventId": event["event_id"],
        "projectId": "5",
        "geoIpCode": "GB",
        "geoIpSubdivisionCode": "GBENG",
    }
    async with semaphore:
        try:
            response = await client.get(ODDS_URL, params=params)
            response.raise_for_status()
            return parse_1x2(event, response.json()), None
        except Exception as exc:
            return [], f"{event['event_id']}: {exc}"


async def main() -> int:
    try:
        events = await discover_events()
    except Exception as exc:
        print(json.dumps({"events": [], "prices": [], "errors": [f"discovery: {exc}"]}))
        return 1

    semaphore = asyncio.Semaphore(5)
    async with httpx.AsyncClient(
        headers=HEADERS,
        timeout=httpx.Timeout(15.0),
        follow_redirects=True,
        http2=True,
    ) as client:
        results = await asyncio.gather(
            *(fetch_event_odds(client, semaphore, event) for event in events)
        )

    prices: list[dict] = []
    errors: list[str] = []
    for rows, error in results:
        prices.extend(rows)
        if error:
            errors.append(error)

    print(
        json.dumps(
            {
                "events": events,
                "prices": prices,
                "errors": errors[:30],
            },
            separators=(",", ":"),
        )
    )
    return 0 if events else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
