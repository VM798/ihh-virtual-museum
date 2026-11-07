"""Visitor accounts: register, sign in, sign out, and "who am I".

Accounts let visitors keep a passport of the inductees they have met and save the
stories they share. Passwords are hashed with scrypt (standard library, no extra
dependency) and never stored or logged in clear. Sessions are random tokens kept in
an HttpOnly cookie; the server keeps only a SHA-256 digest of each token, so a copy
of the data files cannot be used to hijack a session.

Users and sessions live in JSON files under data/community/ (gitignored), next to the
visitor stories and contact messages.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator

from ..config import get_settings

router = APIRouter(prefix="/api/auth", tags=["accounts"])
_lock = threading.Lock()

COOKIE = "ihh_session"
SESSION_DAYS = 30
PASSWORD_MIN = 8
# scrypt parameters (n, r, p): ~16 MB of memory per hash, fast enough for a prototype.
SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def _community_dir() -> Path:
    d = get_settings().data_dir / "community"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _read(name: str) -> list[dict]:
    path = _community_dir() / name
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _write(name: str, items: list[dict]) -> None:
    (_community_dir() / name).write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


# --- passwords and tokens ---------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, **SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex), **SCRYPT)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


# --- models ------------------------------------------------------------------

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120, description="Display name")
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN, max_length=200)

    @field_validator("password")
    @classmethod
    def not_trivial(cls, v: str) -> str:
        if v.strip() != v:
            raise ValueError("Password cannot start or end with spaces")
        if v.lower() in {"password", "12345678", "password1", "qwertyui"}:
            raise ValueError("That password is too common; choose another")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class User(BaseModel):
    id: str
    name: str
    email: str
    created_at: str


class AuthStatus(BaseModel):
    signed_in: bool
    user: User | None = None


def _public(user: dict) -> User:
    return User(id=user["id"], name=user["name"], email=user["email"], created_at=user["created_at"])


# --- session helpers ---------------------------------------------------------

def _find_user(email: str) -> dict | None:
    email = email.lower()
    return next((u for u in _read("users.json") if u["email"] == email), None)


def _user_by_id(user_id: str) -> dict | None:
    return next((u for u in _read("users.json") if u["id"] == user_id), None)


def _create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    with _lock:
        sessions = [s for s in _read("sessions.json") if s["expires_at"] > _iso(_now())]  # prune expired
        sessions.append({
            "digest": _token_digest(token), "user_id": user_id,
            "created_at": _iso(_now()), "expires_at": _iso(_now() + timedelta(days=SESSION_DAYS)),
        })
        _write("sessions.json", sessions)
    return token


def _delete_session(token: str) -> None:
    digest = _token_digest(token)
    with _lock:
        _write("sessions.json", [s for s in _read("sessions.json") if s["digest"] != digest])


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", path="/",
        secure=get_settings().secure_cookies,
    )


def current_user(request: Request) -> dict | None:
    """The signed-in user for this request, or None. Usable from other routers."""
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    digest = _token_digest(token)
    session = next((s for s in _read("sessions.json") if s["digest"] == digest), None)
    if not session or session["expires_at"] <= _iso(_now()):
        return None
    return _user_by_id(session["user_id"])


def require_user(request: Request) -> dict:
    user = current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in first")
    return user


# --- routes --------------------------------------------------------------------

@router.post("/register", response_model=User, status_code=201, summary="Create a visitor account")
def register(payload: RegisterIn, response: Response):
    email = str(payload.email).lower()
    name = _clean(payload.name)
    with _lock:
        users = _read("users.json")
        if any(u["email"] == email for u in users):
            raise HTTPException(status_code=409, detail="An account with that email already exists. Try signing in.")
        user = {
            "id": uuid4().hex[:12], "name": name, "email": email,
            "password": hash_password(payload.password), "created_at": _iso(_now()),
        }
        users.append(user)
        _write("users.json", users)
    _set_cookie(response, _create_session(user["id"]))
    return _public(user)


@router.post("/login", response_model=User, summary="Sign in with email and password")
def login(payload: LoginIn, response: Response):
    user = _find_user(str(payload.email))
    # Always run one hash check so response time does not reveal which emails exist.
    ok = verify_password(payload.password, user["password"] if user else _DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    _set_cookie(response, _create_session(user["id"]))
    return _public(user)


@router.post("/logout", status_code=204, summary="Sign out of the current session")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        _delete_session(token)
    response.delete_cookie(COOKIE, path="/")
    return Response(status_code=204)


@router.get("/me", response_model=AuthStatus, summary="The signed-in visitor, if any")
def me(request: Request):
    user = current_user(request)
    return AuthStatus(signed_in=bool(user), user=_public(user) if user else None)


_DUMMY_HASH = hash_password("not-a-real-password")
