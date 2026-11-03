import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(scope="module")
def client():
    with TestClient(create_app()) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["inductees"] >= 4


def test_list_and_detail(client):
    items = client.get("/api/inductees").json()
    assert len(items) >= 4
    for item in items:
        detail = client.get(f"/api/inductees/{item['slug']}").json()
        assert detail["name"] == item["name"]
        assert detail["sources"], "every profile must cite sources"
        assert all(p["source_ids"] for p in detail["biography"]), "every biography paragraph must be cited"
        assert len(detail["timeline"]) >= 6


def test_filters(client):
    europe = client.get("/api/inductees", params={"region": "Europe"}).json()
    assert europe and all(i["origin_region"] == "Europe" for i in europe)


def test_search(client):
    hits = client.get("/api/inductees/search", params={"q": "basketball"}).json()
    assert hits and hits[0]["slug"] == "james-naismith"


def test_timeline_sorted(client):
    events = client.get("/api/timeline").json()
    years = [e["year"] for e in events]
    assert years == sorted(years)


def test_sources_and_stats(client):
    sources = client.get("/api/sources").json()
    stats = client.get("/api/stats").json()
    assert stats["sources"] == len(sources)
    assert stats["inductees"] >= 4


def test_exports(client):
    md = client.get("/api/inductees/albert-einstein/export.md")
    assert md.status_code == 200 and "## Sources" in md.text
    html = client.get("/api/inductees/albert-einstein/export.html")
    assert html.status_code == 200 and "ihh-profile" in html.text and "<script" not in html.text


def test_docent_fallback(client, monkeypatch):
    monkeypatch.setenv("IHH_DOCENT_ENABLED", "false")
    from app.config import get_settings
    get_settings.cache_clear()
    r = client.post("/api/docent/ask", json={"slug": "hedy-lamarr", "question": "What did she patent in 1942?"})
    assert r.status_code == 200
    body = r.json()
    assert "patent" in body["answer"].lower()
    assert body["cited_source_ids"]
    get_settings.cache_clear()


def test_unknown_slug(client):
    assert client.get("/api/inductees/nobody").status_code == 404
