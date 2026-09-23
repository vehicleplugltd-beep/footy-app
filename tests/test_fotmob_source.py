from unittest.mock import Mock, patch

from footy_data.sources.fotmob_source import FotMobSource


def test_fotmob_source_uses_verified_core_second_tier_ids():
    source = FotMobSource()
    assert source.league_id("ENG-Championship") == 48
    assert source.league_id("ESP-La Liga 2") == 140
    assert source.league_id("GER-2. Bundesliga") == 146
    assert source.league_id("ITA-Serie B") == 86
    assert source.league_id("FRA-Ligue 2") == 110


def test_fotmob_source_extracts_all_matches():
    source = FotMobSource()
    payload = {
        "matches": {
            "allMatches": [
                {"id": "1", "home": {"name": "A"}, "away": {"name": "B"}},
                {"id": "2", "home": {"name": "C"}, "away": {"name": "D"}},
            ]
        }
    }
    with patch.object(source, "league", return_value=payload):
        rows = source.matches("ENG-Championship", "2025/2026")
    assert [row["id"] for row in rows] == ["1", "2"]


def test_fotmob_source_passes_historical_season_param():
    source = FotMobSource()
    response = Mock()
    response.ok = True
    response.json.return_value = {"matches": {"allMatches": []}}
    response.text = ""
    response.status_code = 200
    response.url = "https://www.fotmob.com/api/data/leagues"

    with patch("footy_data.sources.fotmob_source.requests.get", return_value=response) as get:
        source.league("ENG-Championship", "2025/2026")

    params = get.call_args.kwargs["params"]
    assert params["id"] == 48
    assert params["season"] == "2025/2026"
    assert params["ccode3"] == "GBR"


def test_fotmob_source_uses_league_country_code():
    source = FotMobSource()
    response = Mock()
    response.ok = True
    response.json.return_value = {"matches": {"allMatches": []}}
    response.text = ""
    response.status_code = 200
    response.url = "https://www.fotmob.com/api/data/leagues"

    with patch("footy_data.sources.fotmob_source.requests.get", return_value=response) as get:
        source.league("ESP-La Liga 2", "2026/2027")

    params = get.call_args.kwargs["params"]
    assert params["id"] == 140
    assert params["ccode3"] == "ESP"
    assert params["season"] == "2026/2027"
