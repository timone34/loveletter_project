"""The /ws/play page: full games run through the WebSocket, and the human
never receives information they couldn't legitimately have."""
import random

import pytest
from fastapi.testclient import TestClient

import server


@pytest.fixture(autouse=True)
def no_pacing(monkeypatch):
    monkeypatch.setattr(server, "PACE", {})
    monkeypatch.setattr(server, "PACE_YOUR_TURN_START", 0)


def play_game(rng: random.Random, reveal: bool = False, config: dict | None = None) -> list[dict]:
    """Play one game, answering every prompt with a random legal choice."""
    msgs = []
    with TestClient(server.app).websocket_connect("/ws/play") as ws:
        ws.receive_json()  # status
        if reveal:
            ws.send_json({"type": "reveal", "on": True})
            ws.receive_json()
        ws.send_json({"type": "new_game", "config": config})
        while True:
            msg = ws.receive_json()
            msgs.append(msg)
            if msg["type"] == "prompt":
                p = msg["prompt"]
                legal = [i for i in range(len(p["options"])) if p["kind"] != "card" or p["playable"][i]]
                ws.send_json({"type": "choice", "index": rng.choice(legal)})
            if msg["type"] == "error":
                pytest.fail(msg["message"])
            if msg["type"] == "game_end":
                return msgs


def test_games_complete():
    rng = random.Random(0)
    for _ in range(5):
        msgs = play_game(rng)
        assert msgs[-1]["type"] == "game_end"
        assert any(m["type"] == "prompt" for m in msgs)


def test_nothing_hidden_leaks():
    rng = random.Random(1)
    for _ in range(5):
        for msg in play_game(rng):
            table = msg.get("table")
            if table is None:
                continue
            you = table["youSeat"]
            assert table["burn"] is None
            if not table["showdown"]:
                for p in table["players"]:
                    if p["seat"] != you:
                        assert all(c is None for c in p["hand"])
            if msg["type"] in ("turn_start", "turn_end"):
                if msg["seat"] != you:
                    assert msg["held"] is None and msg["drawn"] is None and msg["seen"] is None
                if msg["target"] != you:
                    assert msg["redrawn"] is None
                if you not in (msg["seat"], msg["target"]):
                    assert msg["received"] is None


def test_reveal_shows_everything():
    msgs = play_game(random.Random(2), reveal=True)
    assert any(m.get("table", {}).get("burn") for m in msgs)
    turns = [m for m in msgs if m["type"] == "turn_start"]
    assert all(m["drawn"] is not None for m in turns)


def test_cards_are_ids():
    ids = {"guard", "priest", "baron", "handmaid", "prince", "king", "countess", "princess", None}
    for msg in play_game(random.Random(3)):
        if msg["type"] in ("turn_start", "turn_end"):
            assert {msg[k] for k in ("held", "drawn", "played", "guess", "seen", "discarded", "redrawn", "received")} <= ids
        if msg["type"] == "showdown":
            assert set(msg["contender_hands"].values()) <= ids


CONFIG = {
    "name": "Test Table",
    "you": "Me",
    "seat": 0,
    "opponents": [
        {"name": "Ann", "bot": "CardCounter"},
        {"name": "Ben", "bot": "NoPrincess"},
        {"name": "Cat", "bot": "RandomChoice"},
    ],
    "targetRoundWins": 1,
    "speed": "fast",
    "deckSeed": "abc",
    "visibility": "public",
}


def test_bot_list():
    bots = TestClient(server.app).get("/api/bots").json()
    ids = [b["id"] for b in bots]
    assert {"RandomChoice", "NoPrincess", "CardCounter"} <= set(ids)
    assert "TerminalPlayer" not in ids  # needs a human at the terminal
    assert all(b["name"] and b["description"] for b in bots)


def test_config_is_applied():
    msgs = play_game(random.Random(4), config=CONFIG)
    table = msgs[-1]["table"]
    assert table["name"] == "Test Table" and table["visibility"] == "public"
    assert table["youSeat"] == 0 and table["winsNeeded"] == 1
    players = table["players"]
    assert [p["name"] for p in players] == ["Me", "Ann", "Ben", "Cat"]
    assert players[1]["strategy"] == "Card Counter Bot"
    assert msgs[-1]["scores"][str(msgs[-1]["winner"])] == 1


def test_bad_config_is_rejected():
    bad = {**CONFIG, "opponents": [{"name": "Me", "bot": "RandomChoice"}] * 3}
    with TestClient(server.app).websocket_connect("/ws/play") as ws:
        ws.receive_json()
        ws.send_json({"type": "new_game", "config": bad})
        msg = ws.receive_json()
        assert msg["type"] == "error" and "different name" in msg["message"]
        ws.send_json({"type": "new_game", "config": {**CONFIG, "opponents": [{"name": "X", "bot": "Nope"}]}})
        assert ws.receive_json()["type"] == "error"


WATCH = {
    "mode": "watch",
    "name": "Bot Court",
    "players": [
        {"name": "Ann", "bot": "CardCounter"},
        {"name": "Ben", "bot": "NoPrincess"},
        {"name": "Cat", "bot": "RandomChoice"},
        {"name": "Dan", "bot": "RandomChoice"},
    ],
    "targetRoundWins": 1,
    "speed": "fast",
    "reveal": False,
}


def watch_game(config: dict) -> list[dict]:
    msgs = []
    with TestClient(server.app).websocket_connect("/ws/play") as ws:
        ws.receive_json()  # status
        ws.send_json({"type": "new_game", "config": config})
        while True:
            msg = ws.receive_json()
            msgs.append(msg)
            assert msg["type"] not in ("prompt", "error"), msg
            if msg["type"] == "game_end":
                return msgs


def test_watch_plays_four_bots_without_prompts():
    msgs = watch_game(WATCH)
    table = msgs[-1]["table"]
    assert table["youSeat"] is None
    assert [p["name"] for p in table["players"]] == ["Ann", "Ben", "Cat", "Dan"]


def test_watching_shows_only_public_info_unless_revealed():
    for msg in watch_game(WATCH):
        table = msg.get("table")
        if table and not table["showdown"]:
            assert all(c is None for p in table["players"] for c in p["hand"])
        if msg["type"] in ("turn_start", "turn_end"):
            assert msg["held"] is None and msg["drawn"] is None and msg["seen"] is None
    revealed = watch_game({**WATCH, "reveal": True})
    assert any(m["type"] == "turn_start" and m["drawn"] is not None for m in revealed)


def test_watch_needs_four_bots():
    with TestClient(server.app).websocket_connect("/ws/play") as ws:
        ws.receive_json()
        ws.send_json({"type": "new_game", "config": {**WATCH, "players": WATCH["players"][:3]}})
        msg = ws.receive_json()
        assert msg["type"] == "error" and "four bots" in msg["message"]
