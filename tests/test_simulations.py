"""The /api/simulations endpoints: runs play in the background, are saved to the
history, and can be repeated exactly from their saved settings."""
import bz2
import time

import pytest
from fastapi.testclient import TestClient

import server
from lln import parse_lln
from runs import History

CONFIG = {
    "name": "Test run",
    "players": [
        {"name": "Ann", "bot": "CardCounter"},
        {"name": "Ben", "bot": "RandomChoice"},
        {"name": "Cat", "bot": "NoPrincess"},
        {"name": "Dan", "bot": "RandomChoice"},
    ],
    "games": 60,
    "targetRoundWins": 2,
    "rotateSeats": True,
    "seed": "abc",
    "saveLln": True,
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "history", History(tmp_path))
    return TestClient(server.app)


def finish(client, run_id: str) -> dict:
    for _ in range(500):
        record = client.get(f"/api/simulations/{run_id}").json()
        if record["status"] in ("done", "failed"):
            return record
        time.sleep(0.02)
    pytest.fail("simulation didn't finish")


def test_run_and_history(client):
    started = client.post("/api/simulations", json=CONFIG)
    assert started.status_code == 201
    run_id = started.json()["id"]

    record = finish(client, run_id)
    assert record["status"] == "done", record["error"]
    assert record["progress"] == {"done": 60, "total": 60}
    assert record["stats"]["games"] == 60
    assert [p["name"] for p in record["stats"]["players"]] == ["Ann", "Ben", "Cat", "Dan"]
    assert record["botNames"]["CardCounter"] == "Card Counter Bot"

    listed = client.get("/api/simulations").json()
    assert [r["id"] for r in listed] == [run_id]
    assert "convergence" not in listed[0]["stats"]  # the list stays light

    renamed = client.patch(f"/api/simulations/{run_id}", json={"name": "Renamed"}).json()
    assert renamed["config"]["name"] == "Renamed"
    assert client.get(f"/api/simulations/{run_id}").json()["config"]["name"] == "Renamed"


def test_saved_games_match_the_stats(client):
    record = finish(client, client.post("/api/simulations", json=CONFIG).json()["id"])
    lln = client.get(f"/api/simulations/{record['id']}/lln")
    assert lln.status_code == 200
    games = parse_lln(bz2.decompress(lln.content).decode("utf-8"), target_round_wins=2)
    assert len(games) == 60
    assert sum(len(gh.rounds) for gh in games) == record["stats"]["rounds"]


def test_saved_settings_repeat_the_run(client):
    first = finish(client, client.post("/api/simulations", json={**CONFIG, "seed": ""}).json()["id"])
    assert first["config"]["seed"]  # an empty seed gets a random one, kept with the run
    again = finish(client, client.post("/api/simulations", json=first["config"]).json()["id"])
    assert again["stats"] == first["stats"]


def test_delete(client):
    run_id = finish(client, client.post("/api/simulations", json=CONFIG).json()["id"])["id"]
    assert client.delete(f"/api/simulations/{run_id}").status_code == 204
    assert client.get(f"/api/simulations/{run_id}").status_code == 404
    assert client.get(f"/api/simulations/{run_id}/lln").status_code == 404
    assert client.get("/api/simulations").json() == []


def test_cancel_a_running_run(client):
    run_id = client.post("/api/simulations", json={**CONFIG, "games": 100_000}).json()["id"]
    assert client.delete(f"/api/simulations/{run_id}").status_code == 204
    time.sleep(0.2)
    assert client.get(f"/api/simulations/{run_id}").status_code == 404
    assert client.get("/api/simulations").json() == []


@pytest.mark.parametrize("bad, message", [
    ({"players": CONFIG["players"][:3]}, "exactly 4"),
    ({"players": [{"name": "Same", "bot": "RandomChoice"}] * 4}, "different name"),
    ({"players": [{"name": "X", "bot": "Nope"}] + CONFIG["players"][1:]}, "Unknown bot"),
    ({"games": 0}, "between 1"),
    ({"games": 10**7}, "between 1"),
    ({"targetRoundWins": 12}, "between 1 and 9"),
])
def test_bad_settings_are_rejected(client, bad, message):
    response = client.post("/api/simulations", json={**CONFIG, **bad})
    assert response.status_code == 400
    assert message in response.json()["detail"]


def test_unknown_ids(client):
    assert client.get("/api/simulations/nope").status_code == 404
    assert client.get("/api/simulations/..%2Fserver").status_code == 404
    assert client.delete("/api/simulations/nope").status_code == 404
