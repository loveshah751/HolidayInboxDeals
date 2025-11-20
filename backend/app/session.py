from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request, status
from itsdangerous import BadSignature, URLSafeSerializer

SESSION_COOKIE_NAME = "session"


@dataclass
class SessionData:
    user_id: str
    gmail_address: str | None = None
    verified: bool = False


class SessionManager:
    """Wraps cookie signing and verification."""

    def __init__(self, secret: str, salt: str = "gmail-promotions-session") -> None:
        self._serializer = URLSafeSerializer(secret_key=secret, salt=salt)

    def create_cookie(self, user_id: str, *, verified: bool, gmail_address: str | None = None) -> str:
        return self._serializer.dumps(
            {
                "user_id": user_id,
                "gmail_address": gmail_address,
                "verified": verified,
            }
        )

    def read_cookie(self, raw_cookie: Optional[str]) -> Optional[SessionData]:
        if not raw_cookie:
            return None
        try:
            payload = self._serializer.loads(raw_cookie)
        except BadSignature:
            return None
        user_id = payload.get("user_id")
        if not user_id:
            return None
        return SessionData(
            user_id=user_id,
            gmail_address=payload.get("gmail_address"),
            verified=bool(payload.get("verified", False)),
        )


async def require_session(request: Request, manager: SessionManager) -> SessionData:
    session = manager.read_cookie(request.cookies.get(SESSION_COOKIE_NAME))
    if not session or not session.verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not connected")
    return session
