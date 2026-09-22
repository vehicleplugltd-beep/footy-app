from footy_data.identity import default_resolver


def test_historical_championship_aliases():
    resolver = default_resolver()
    assert resolver.resolve("Cardiff City") == "Cardiff"
    assert resolver.resolve("Huddersfield Town") == "Huddersfield"
    assert resolver.resolve("Rotherham United") == "Rotherham"
    assert resolver.resolve("Wigan Athletic") == "Wigan"
    assert resolver.resolve("Plymouth Argyle") == "Plymouth"
