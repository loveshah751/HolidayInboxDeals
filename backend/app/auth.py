from __future__ import annotations

import json
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel

from .config import Settings, get_settings


class AuthenticatedUser(BaseModel):
    user_id: str
    email: str | None = None


def _parse_claims(payload: dict[str, Any]) -> tuple[str, str | None]:
    user_id = payload.get("sub") or payload.get("user_id")
    email = payload.get("email")
    hasura_claims = payload.get("https://hasura.io/jwt/claims")
    if isinstance(hasura_claims, dict):
        user_id = hasura_claims.get("x-hasura-user-id", user_id)
        email = hasura_claims.get("x-hasura-user-email", email)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing user id")
    return user_id, email


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    token = auth_header.split(" ", 1)[1]
    secret_raw = settings.nhost_jwt_secret
    if not secret_raw:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT secret not configured")
    try:
        secret = json.loads(secret_raw)
    except json.JSONDecodeError as exc:  # pragma: no cover - misconfiguration
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid JWT secret") from exc
    algorithm = secret.get("type", "HS256")
    key = secret.get("key")
    if not key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT secret missing key")
    try:
        payload = jwt.decode(token, key, algorithms=[algorithm], options={"verify_aud": False})
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user_id, email = _parse_claims(payload)
    return AuthenticatedUser(user_id=user_id, email=email)
