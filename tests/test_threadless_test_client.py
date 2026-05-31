# -*- coding: utf-8 -*-
"""Regression tests for the local TestClient compatibility shim."""

from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient as FastAPITestClient


def test_threadless_test_client_preserves_cookies_between_requests() -> None:
    app = FastAPI()

    @app.post("/login")
    def login(response: Response) -> dict[str, bool]:
        response.set_cookie("dsa_session", "session-token")
        return {"ok": True}

    @app.get("/protected")
    def protected(request: Request) -> dict[str, str | None]:
        return {"session": request.cookies.get("dsa_session")}

    client = FastAPITestClient(app)

    assert client.post("/login").status_code == 200
    assert client.get("/protected").json() == {"session": "session-token"}
