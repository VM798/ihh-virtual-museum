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


def test_story_submission_and_listing(client, tmp_path, monkeypatch):
    from app import config
    from app.routers import community
    monkeypatch.setattr(community, "_community_dir", lambda: tmp_path)
    bad = client.post("/api/stories", json={"name": "A", "email": "nope", "origin_country": "", "title": "x", "story": "short", "consent": False})
    assert bad.status_code == 422
    good = {
        "name": "Rosa Delgado", "display_name": "Rosa D.", "email": "rosa@example.com", "origin_country": "Mexico",
        "origin_flag": "🇲🇽", "arrival_year": 1998, "story_type": "contemporary", "title": "Two suitcases and a sewing machine",
        "story": "My mother crossed with two suitcases and a sewing machine, and that machine paid for my first year of school.", "consent": True,
    }
    r = client.post("/api/stories", json=good)
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "pending" and body["display_name"] == "Rosa D." and "email" not in body
    listed = client.get("/api/stories").json()
    assert listed and listed[0]["id"] == body["id"] and "email" not in listed[0]
    assert client.get("/api/stories", params={"status": "approved"}).json() == []
    assert {t["id"] for t in client.get("/api/stories/types").json()} == {"contemporary", "legacy", "what-we-bring"}


def test_contact_form(client, tmp_path, monkeypatch):
    from app.routers import community
    monkeypatch.setattr(community, "_community_dir", lambda: tmp_path)
    topics = client.get("/api/contact/topics").json()
    assert "Volunteering" in topics
    r = client.post("/api/contact", json={"name": "Sam Lee", "email": "sam@example.com", "topics": ["Volunteering"], "message": "I would like to help with the archive."})
    assert r.status_code == 201 and r.json()["id"]
    assert client.post("/api/contact", json={"name": "Sam Lee", "email": "sam@example.com", "topics": ["Nonsense"], "message": "Hello there friend"}).status_code == 422


def test_historical_context_and_lesson(client):
    pei = client.get("/api/inductees/i-m-pei").json()
    assert pei["historical_context"]["id"] == "quotas"
    cruz = client.get("/api/inductees/celia-cruz").json()
    assert cruz["historical_context"]["id"] == "cuban-exodus"
    for item in client.get("/api/inductees").json():
        assert client.get(f"/api/inductees/{item['slug']}").json()["historical_context"], item["slug"]
    r = client.get("/api/inductees/hedy-lamarr/lesson.md")
    assert r.status_code == 200 and "Discussion prompts" in r.text and "TEKS" not in r.text and "Historical context" in r.text
    assert client.get("/api/explore").json()


def test_narration_and_exhibition_exports(client):
    n = client.get("/api/inductees/john-muir/narration").json()
    assert n["words"] > 120 and n["seconds"] > 40 and n["source_ids"] and "the story of John Muir" in n["text"]
    assert "[" not in n["text"], "spoken script must not contain citation brackets"
    assert client.get("/api/inductees/john-muir/narration.mp3").status_code in (200, 404)
    md = client.get("/api/inductees/john-muir/export.md").text
    for room in ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5", "Room 6", "Room 7", "Audio guide"]:
        assert room in md, room
    html_block = client.get("/api/inductees/john-muir/export.html").text
    assert "<script" not in html_block and "Historical context" in html_block and "Audio guide" in html_block and "Explore further" in html_block
    assert html_block.count("<figure") >= 8, "timeline moments should carry their scene pictures"


def test_museum_hall(client):
    bays = client.get("/api/museum").json()
    assert len(bays) >= 4 and all(b["portrait"] and b["items"] for b in bays)


def test_image_proxy_rejects_unknown_hosts(client):
    assert client.get("/api/image", params={"url": "https://example.com/x.jpg"}).status_code == 400
    assert client.get("/api/image", params={"url": "http://commons.wikimedia.org/x.jpg"}).status_code == 400


def test_register_login_logout(client, tmp_path, monkeypatch):
    from app.routers import auth, community
    monkeypatch.setattr(auth, "_community_dir", lambda: tmp_path)
    monkeypatch.setattr(community, "_community_dir", lambda: tmp_path)
    assert client.get("/api/auth/me").json() == {"signed_in": False, "user": None}
    weak = client.post("/api/auth/register", json={"name": "Ana", "email": "ana@example.com", "password": "short"})
    assert weak.status_code == 422
    r = client.post("/api/auth/register", json={"name": "  Ana  Souza ", "email": "Ana@Example.com", "password": "correct horse battery"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Ana Souza" and body["email"] == "ana@example.com" and "password" not in body
    assert client.cookies.get("ihh_session")
    me = client.get("/api/auth/me").json()
    assert me["signed_in"] and me["user"]["id"] == body["id"]
    # the stored record never holds the clear password
    stored = (tmp_path / "users.json").read_text()
    assert "correct horse battery" not in stored and "scrypt$" in stored
    # duplicate email
    assert client.post("/api/auth/register", json={"name": "Ana", "email": "ana@example.com", "password": "another secret 1"}).status_code == 409
    # a story shared while signed in is listed under "mine"
    story = {"name": "Ana Souza", "email": "ana@example.com", "origin_country": "Brazil", "story_type": "legacy", "title": "Grandfather's accordion",
             "story": "He carried the accordion from Porto Alegre to Houston and played it at every wedding on our street for forty years.", "consent": True}
    sid = client.post("/api/stories", json=story).json()["id"]
    assert [s["id"] for s in client.get("/api/stories/mine").json()] == [sid]
    assert "user_id" not in client.get("/api/stories").json()[0]
    # logout clears the cookie and the server-side session
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").json()["signed_in"] is False
    assert client.get("/api/stories/mine").status_code == 401
    # sign in again: wrong password, unknown email, then success
    assert client.post("/api/auth/login", json={"email": "ana@example.com", "password": "wrong password"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "correct horse battery"}).status_code == 401
    ok = client.post("/api/auth/login", json={"email": "ANA@example.com", "password": "correct horse battery"})
    assert ok.status_code == 200 and ok.json()["id"] == body["id"]
    assert client.get("/api/auth/me").json()["user"]["name"] == "Ana Souza"


def test_museum_guide_chat(client):
    r = client.post("/api/docent/chat", json={"messages": [{"role": "user", "content": "Who was Levi Strauss and why did he leave Germany?"}]})
    assert r.status_code == 200
    body = r.json()
    assert "levi-strauss" in body["inductees"] and "Levi Strauss" in body["answer"]
    assert any(l["to"] == "/inductees/levi-strauss" for l in body["links"])
    # follow-up keeps the same inductee in scope
    r = client.post("/api/docent/chat", json={"messages": [
        {"role": "user", "content": "Who was Levi Strauss?"}, {"role": "assistant", "content": body["answer"]}, {"role": "user", "content": "When was he born?"}]})
    assert r.json()["inductees"] == ["levi-strauss"]
    # site questions point to pages
    r = client.post("/api/docent/chat", json={"messages": [{"role": "user", "content": "How do I share my family's story?"}]})
    assert any(l["to"] == "/share" for l in r.json()["links"])
    r = client.post("/api/docent/chat", json={"messages": [{"role": "user", "content": "How do I bring my class for a visit?"}]})
    assert r.json()["inductees"] == [] and any(l["to"].startswith("/contact") for l in r.json()["links"])
    r = client.post("/api/docent/chat", json={"messages": [{"role": "user", "content": "Which inductees came from Germany?"}]})
    assert "albert-einstein" in r.json()["inductees"]
    r = client.post("/api/docent/chat", json={"messages": [{"role": "user", "content": "Who are the inductees?"}]})
    assert len(r.json()["inductees"]) >= 4
    assert client.post("/api/docent/chat", json={"messages": [{"role": "assistant", "content": "hi"}]}).status_code == 422
