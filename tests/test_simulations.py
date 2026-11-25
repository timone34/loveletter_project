"""The /api/simulations endpoints: runs play in the background, are saved to the
history, and can be repeated exactly from their saved settings."""
import bz2
import json
import time

import pytest
from fastapi.testclient import TestClient

import server
from lln import parse_lln
from runs import History
from tests.test_timing import without_timing

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
    assert "overTime" not in listed[0]["stats"]["performance"]

    renamed = client.patch(f"/api/simulations/{run_id}", json={"name": "Renamed"}).json()
    assert renamed["config"]["name"] == "Renamed"
    assert client.get(f"/api/simulations/{run_id}").json()["config"]["name"] == "Renamed"


def test_saved_games_match_the_stats(client):
    record = finish(client, client.post("/api/simulations", json=CONFIG).json()["id"])
    lln = client.get(f"/api/simulations/{record['id']}/lln")
    assert lln.status_code == 200
    assert lln.headers["content-type"].startswith("text/plain")
    assert '.lln"' in lln.headers["content-disposition"]
    games = parse_lln(lln.text, target_round_wins=2)
    assert len(games) == 60
    assert sum(len(gh.rounds) for gh in games) == record["stats"]["rounds"]

    packed = client.get(f"/api/simulations/{record['id']}/lln?compressed=true")
    assert bz2.decompress(packed.content).decode("utf-8") == lln.text


def test_saved_settings_repeat_the_run(client):
    first = finish(client, client.post("/api/simulations", json={**CONFIG, "seed": ""}).json()["id"])
    assert first["config"]["seed"]  # an empty seed gets a random one, kept with the run
    assert first["config"]["seedAuto"] and not first["config"]["nameAuto"]
    again = finish(client, client.post("/api/simulations", json=first["config"]).json()["id"])
    assert without_timing(again["stats"]) == without_timing(first["stats"])  # clock readings differ


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


def test_empty_name_is_made_from_the_lineup(client):
    record = client.post("/api/simulations", json={**CONFIG, "name": ""}).json()
    assert record["config"]["name"] == "CardCounter vs 2× RandomChoice vs NoPrincess"
    assert record["config"]["nameAuto"]
    renamed = client.patch(f"/api/simulations/{record['id']}", json={"name": "Mine"}).json()
    assert renamed["config"]["name"] == "Mine" and not renamed["config"]["nameAuto"]


def test_records_from_another_format_are_outdated(client, tmp_path):
    record = finish(client, client.post("/api/simulations", json=CONFIG).json()["id"])
    path = tmp_path / f"{record['id']}.json"
    old = json.loads(path.read_text(encoding="utf-8"))
    del old["format"]  # as saved before records had a format
    path.write_text(json.dumps(old), encoding="utf-8")

    loaded = client.get(f"/api/simulations/{record['id']}").json()
    assert loaded["status"] == "outdated" and loaded["stats"] is None
    assert loaded["savedFormat"] == 1
    assert loaded["config"]["seed"] == CONFIG["seed"]  # enough to run it again
    assert client.get("/api/simulations").json()[0]["status"] == "outdated"
    # renaming changes only the name on disk; the old stats stay there
    client.patch(f"/api/simulations/{record['id']}", json={"name": "Old run"})
    assert "stats" in json.loads(path.read_text(encoding="utf-8"))


def test_timing_and_lineup_speeds(client):
    record = finish(client, client.post("/api/simulations", json=CONFIG).json()["id"])
    perf = record["stats"]["performance"]
    assert perf["games"] == 60 and all(p["think"] for p in record["stats"]["players"])
    timing = record["timing"]
    assert 0 < timing["playSec"] and 0 < timing["countSec"] and 0 < timing["llnSec"]
    assert timing["playSec"] + timing["countSec"] + timing["llnSec"] <= record["durationSec"]
    assert perf["total"] <= timing["playSec"]  # games are timed inside the play phase
    assert timing["machine"]["python"]

    speeds = client.get("/api/lineup-speeds").json()
    entry = speeds["CardCounter+NoPrincess+RandomChoice+RandomChoice|2"]
    assert entry["timed"]["runId"] == record["id"] and entry["timed"]["msPerGame"] > 0
    assert "plain" not in entry and entry["llnMsPerGame"] > 0

    plain = finish(client, client.post("/api/simulations", json={**CONFIG, "measureTime": False, "saveLln": False}).json()["id"])
    assert plain["stats"]["performance"] is None and plain["config"]["measureTime"] is False
    assert all(p["think"] is None for p in plain["stats"]["players"])
    entry = client.get("/api/lineup-speeds").json()["CardCounter+NoPrincess+RandomChoice+RandomChoice|2"]
    assert entry["plain"]["runId"] == plain["id"] and entry["timed"]["runId"] == record["id"]
    assert len(client.get("/api/simulations").json()) == 2  # the speeds file isn't a run


def test_short_runs_leave_the_speeds_alone(client):
    finish(client, client.post("/api/simulations", json={**CONFIG, "games": 5}).json()["id"])
    assert client.get("/api/lineup-speeds").json() == {}
