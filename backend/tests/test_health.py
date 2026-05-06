def test_health_returns_ok(main_client):
    resp = main_client.get("/health")
    assert resp.status_code == 200


def test_health_body(main_client):
    body = main_client.get("/health").json()
    assert body["status"] == "ok"
    assert body["environment"] == "development"
