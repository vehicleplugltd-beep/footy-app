#!/usr/bin/env python3
"""Fetch a public SofaScore JSON route with a browser TLS fingerprint.

No credentials are used. The caller supplies only the API path, never a full URL.
"""

from __future__ import annotations

import json
import sys

from curl_cffi import requests

BASES = (
    "https://api.sofascore.com/api/v1",
    "https://www.sofascore.com/api/v1",
)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: fetch-sofascore.py <api-path>", file=sys.stderr)
        return 2

    path = sys.argv[1].strip().lstrip("/")
    if not path or "://" in path or ".." in path:
        print("invalid SofaScore API path", file=sys.stderr)
        return 2

    errors: list[str] = []
    headers = {
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "en-GB,en;q=0.9",
        "Referer": "https://www.sofascore.com/",
        "Origin": "https://www.sofascore.com",
        "Cache-Control": "no-cache",
    }

    for base in BASES:
        url = f"{base}/{path}"
        try:
            response = requests.get(
                url,
                headers=headers,
                impersonate="chrome",
                timeout=20,
            )
            if response.status_code == 200:
                payload = response.json()
                sys.stdout.write(json.dumps(payload, separators=(",", ":")))
                return 0
            errors.append(f"{url}: HTTP {response.status_code}")
        except Exception as exc:  # network/WAF fallback path
            errors.append(f"{url}: {exc}")

    print(" | ".join(errors)[:1200], file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
