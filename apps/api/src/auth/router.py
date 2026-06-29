"""
The auth HTTP router (the FastAPI wiring of the auth leaf). main.py is the orchestration boundary
that mounts this; nothing on the bundle/SSE path imports it.

Endpoints emit EXACTLY the shapes/statuses/presence the INTERFACE_CONTRACT pins:
  GET  /api/auth/session          — §2.1 always-200 identity shape (anonymous is normal)
  POST /api/auth/signup           — §2.2 (409 email_taken / 422 validation / 503)
  POST /api/auth/login            — §2.3 (401 non-enumerating / 422 / 503)
  POST /api/auth/logout           — §2.4 idempotent 200
  GET  /api/auth/google/start     — §2.5 (302 | 409 google_unavailable)
  GET  /api/auth/google/callback  — §2.5 server-side exchange → redirect
  GET  /api/auth/settings         — §2.6 (200 | 401 auth_required)
  PUT  /api/auth/settings         — §2.7 (200 echo | 401 | 422)

Cookie handling: the signed, HTTP-only, Secure, SameSite=Lax cookie carries the opaque session id
(ARCHITECTURE §5.1 / INTERFACE §1). The browser NEVER receives a session id, key, or secret in a
body. An AuthError maps to its real HTTP status + the `{error, message}` envelope (INTERFACE §3);
a 503 `auth_unavailable` covers an unexpected subsystem fault — but the SESSION READ degrades to
anonymous instead (always-200), and the trader bundle/SSE path is never touched (AC-J1).

This module is part of the auth LEAF: imports stdlib + fastapi + the leaf's own service/errors.
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from . import errors, get_service
from .cookies import COOKIE_NAME

logger = logging.getLogger("Convexa")

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Secure flag: on by default (the contract's Secure cookie); operator-overridable OFF for local
# http dev so the cookie is actually set over the Vite proxy / 127.0.0.1. SameSite=Lax is the
# default — same-origin first-party flow + the OAuth top-level redirect both work under Lax.
_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "true").lower() == "true"
_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower()
# Where the Google callback redirects the browser back into the app (post-login landing).
_APP_POST_LOGIN_URL = os.getenv("AUTH_APP_POST_LOGIN_URL", "/")


class SignupBody(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class LoginBody(BaseModel):
    email: str
    password: str


class SettingsBody(BaseModel):
    # All optional: a PUT carries any SUBSET of the bag (INTERFACE §2.7).
    active_persona_id: str | None = None
    default_ticker: str | None = None
    theme: str | None = None


def _error_response(err: errors.AuthError) -> JSONResponse:
    return JSONResponse(status_code=err.status, content=err.envelope())


def _set_session_cookie(resp: Response, signed_value: str) -> None:
    resp.set_cookie(
        key=COOKIE_NAME, value=signed_value, httponly=True,
        secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE, path="/",
    )


def _clear_session_cookie(resp: Response) -> None:
    resp.delete_cookie(key=COOKIE_NAME, path="/")


def _cookie(request: Request) -> str | None:
    return request.cookies.get(COOKIE_NAME)


# ----------------------------------------------------------------------------- §2.1 session read

@router.get("/session")
async def session_status(request: Request):
    """Always 200. Anonymous is a normal result; a subsystem fault degrades to anonymous (AC-J1)."""
    svc = get_service()
    return svc.session_status(_cookie(request))


# ----------------------------------------------------------------------------- §2.2 signup

@router.post("/signup")
async def signup(body: SignupBody):
    svc = get_service()
    try:
        identity, sid = svc.signup(
            email=body.email, password=body.password, display_name=body.display_name)
    except errors.AuthError as e:
        return _error_response(e)
    except Exception:
        logger.warning("auth: signup subsystem fault", exc_info=False)
        return _error_response(errors.auth_unavailable())
    resp = JSONResponse(content=identity)
    _set_session_cookie(resp, svc.signed_cookie_value(sid))
    return resp


# ----------------------------------------------------------------------------- §2.3 login

@router.post("/login")
async def login(body: LoginBody):
    svc = get_service()
    try:
        identity, sid = svc.login(email=body.email, password=body.password)
    except errors.AuthError as e:
        return _error_response(e)
    except Exception:
        logger.warning("auth: login subsystem fault", exc_info=False)
        return _error_response(errors.auth_unavailable())
    resp = JSONResponse(content=identity)
    _set_session_cookie(resp, svc.signed_cookie_value(sid))
    return resp


# ----------------------------------------------------------------------------- §2.4 logout

@router.post("/logout")
async def logout(request: Request):
    """Idempotent 200: revoke the session row + clear the cookie regardless of prior state."""
    svc = get_service()
    svc.logout(_cookie(request))
    resp = JSONResponse(content={"authenticated": False})
    _clear_session_cookie(resp)
    return resp


# ----------------------------------------------------------------------------- §2.5 google

@router.get("/google/start")
async def google_start():
    svc = get_service()
    try:
        url = svc.google_start_url()
    except errors.AuthError as e:
        return _error_response(e)   # 409 google_unavailable when unconfigured
    return RedirectResponse(url=url, status_code=302)


@router.get("/google/callback")
async def google_callback(request: Request, code: str | None = None, state: str | None = None):
    svc = get_service()
    try:
        sid = svc.google_callback(code=code, state=state)
    except errors.AuthError:
        # Redirect back into the app with a safe error marker — no secret/token/stack leaks.
        return RedirectResponse(url=f"{_APP_POST_LOGIN_URL}?google=error", status_code=302)
    except Exception:
        logger.warning("auth: google callback fault", exc_info=False)
        return RedirectResponse(url=f"{_APP_POST_LOGIN_URL}?google=error", status_code=302)
    resp = RedirectResponse(url=f"{_APP_POST_LOGIN_URL}?google=ok", status_code=302)
    _set_session_cookie(resp, svc.signed_cookie_value(sid))
    return resp


# ----------------------------------------------------------------------------- §2.6/§2.7 settings

@router.get("/settings")
async def get_settings(request: Request):
    svc = get_service()
    resolved = svc.resolve_session(_cookie(request))
    if not resolved.authenticated:
        return _error_response(errors.settings_auth_required())
    return svc.get_settings(resolved.user)


@router.put("/settings")
async def put_settings(body: SettingsBody, request: Request):
    svc = get_service()
    resolved = svc.resolve_session(_cookie(request))
    if not resolved.authenticated:
        return _error_response(errors.settings_auth_required())
    # Only the fields the client actually sent (subset write — server-wins, D7).
    patch = body.model_dump(exclude_unset=True)
    try:
        saved = svc.write_settings(resolved.user, patch)
    except errors.AuthError as e:
        return _error_response(e)   # 422 on a bad theme
    return saved
