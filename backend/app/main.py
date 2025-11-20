from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, List

import secrets
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from google_auth_oauthlib.flow import Flow
from pydantic import BaseModel

from .auth import AuthenticatedUser, get_current_user
from .config import Settings, get_settings
from .gmail import fetch_promotions_from_gmail
from .nhost_client import NhostGraphQLClient
from .offers import Offer, OfferExtractor
from .session import (
    SESSION_COOKIE_NAME,
    SessionData,
    SessionManager,
)

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]


def get_session_manager(settings: Settings = Depends(get_settings)) -> SessionManager:
    return SessionManager(secret=settings.session_secret)


def get_offer_extractor() -> OfferExtractor:
    return OfferExtractor()


def get_nhost_client(settings: Settings = Depends(get_settings)) -> NhostGraphQLClient:
    return NhostGraphQLClient(settings)


def build_google_flow(settings: Settings, redirect_uri: str) -> Flow:
    if settings.gmail_credentials_file:
        raw_path = Path(settings.gmail_credentials_file).expanduser()
        resolved_path: Path | None = None
        if raw_path.is_absolute() and raw_path.exists():
            resolved_path = raw_path
        else:
            repo_root = Path(__file__).resolve().parents[2]
            backend_root = Path(__file__).resolve().parents[1]
            candidates = [
                (backend_root / raw_path).resolve(),
                (repo_root / raw_path).resolve(),
            ]
            if raw_path.parts and raw_path.parts[0] == "backend":
                trimmed = Path(*raw_path.parts[1:])
                candidates.append((backend_root / trimmed).resolve())
            for candidate in candidates:
                if candidate.exists():
                    resolved_path = candidate
                    break
        if not resolved_path:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Google credentials file not found: {raw_path}",
            )
        return Flow.from_client_secrets_file(str(resolved_path), scopes=GMAIL_SCOPES, redirect_uri=redirect_uri)
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google OAuth is not configured")
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "project_id": "gmail-promotions",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": settings.google_client_secret,
        }
    }
    return Flow.from_client_config(client_config, scopes=GMAIL_SCOPES, redirect_uri=redirect_uri)


def get_optional_session(
    request: Request,
    manager: SessionManager = Depends(get_session_manager),
) -> SessionData | None:
    return manager.read_cookie(request.cookies.get(SESSION_COOKIE_NAME))


def filter_recent_emails(emails: List[dict[str, Any]], days: int = 30) -> List[dict[str, Any]]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    filtered: List[dict[str, Any]] = []
    for email in emails:
        raw_date = email.get("date")
        dt = _parse_email_date(raw_date)
        if dt and dt >= cutoff:
            filtered.append(email)
    return filtered


def dedupe_emails(emails: List[dict[str, Any]]) -> List[dict[str, Any]]:
    seen: set[str] = set()
    unique: List[dict[str, Any]] = []
    for email in emails:
        identifier = email.get("id") or email.get("thread_id")
        if identifier and identifier in seen:
            continue
        if identifier:
            seen.add(identifier)
        unique.append(email)
    return unique


def _parse_email_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        parsed = parsedate_to_datetime(raw)
        if parsed:
            if parsed.tzinfo:
                return parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
    except (ValueError, TypeError):
        pass
    formats = ["%A, %B %d, %Y at %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%d %H:%M:%S %z"]
    for fmt in formats:
        try:
            dt = datetime.strptime(raw, fmt)
            return dt
        except ValueError:
            continue
    return None


class SessionStatusResponse(BaseModel):
    connected: bool
    gmail_address: str | None = None


class OffersResponse(BaseModel):
    offers: list[Offer]
    next_page_token: str | None = None


class PromotionsResponse(BaseModel):
    emails: list[dict[str, Any]]
    next_page_token: str | None = None


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="Gmail Promotions Offers API", version="0.1.0")
    cookie_samesite = "none" if settings.cookie_secure else "lax"

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    router = APIRouter(prefix="/api")

    @router.get("/health")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @router.get("/session", response_model=SessionStatusResponse)
    async def session_status(
        current_user: AuthenticatedUser = Depends(get_current_user),
        nhost_client: NhostGraphQLClient = Depends(get_nhost_client),
    ) -> SessionStatusResponse:
        token_record = await nhost_client.get_gmail_token(current_user.user_id)
        connected = token_record is not None
        return SessionStatusResponse(connected=connected, gmail_address=current_user.email)

    @router.get("/google/connect")
    async def google_connect(
        current_user: AuthenticatedUser = Depends(get_current_user),
        settings: Settings = Depends(get_settings),
        manager: SessionManager = Depends(get_session_manager),
    ) -> JSONResponse:
        redirect_uri = str(settings.google_redirect_uri or f"{settings.backend_base_url}/oauth/google/callback")
        flow = build_google_flow(settings, redirect_uri=redirect_uri)
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        cookie_value = manager.create_cookie(
            current_user.user_id,
            verified=False,
            gmail_address=current_user.email,
        )
        response = JSONResponse({"auth_url": authorization_url})
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=cookie_value,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=cookie_samesite,
        )
        response.set_cookie(
            key="google_oauth_state",
            value=state,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=cookie_samesite,
        )
        return response

    @router.get("/offers", response_model=OffersResponse)
    async def offers(
        current_user: AuthenticatedUser = Depends(get_current_user),
        nhost_client: NhostGraphQLClient = Depends(get_nhost_client),
        settings: Settings = Depends(get_settings),
        extractor: OfferExtractor = Depends(get_offer_extractor),
        max_results: int = 20,
        page_token: str | None = None,
    ) -> OffersResponse:
        max_results = max(1, min(max_results, 50))
        token_record = await nhost_client.get_gmail_token(current_user.user_id)
        if not token_record:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gmail not connected")
        emails, next_page = await fetch_promotions_from_gmail(
            settings,
            token_record,
            max_results=max_results,
            page_token=page_token,
        )
        recent_emails = dedupe_emails(filter_recent_emails(emails, days=30))
        offers = extractor.extract(recent_emails)
        return OffersResponse(offers=offers, next_page_token=next_page)

    @router.get("/promotions/raw", response_model=PromotionsResponse)
    async def raw_promotions(
        current_user: AuthenticatedUser = Depends(get_current_user),
        nhost_client: NhostGraphQLClient = Depends(get_nhost_client),
        settings: Settings = Depends(get_settings),
        max_results: int = 20,
        page_token: str | None = None,
    ) -> PromotionsResponse:
        max_results = max(1, min(max_results, 50))
        token_record = await nhost_client.get_gmail_token(current_user.user_id)
        if not token_record:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gmail not connected")
        emails, next_page = await fetch_promotions_from_gmail(
            settings,
            token_record,
            max_results=max_results,
            page_token=page_token,
        )
        return PromotionsResponse(emails=emails, next_page_token=next_page)

    app.include_router(router)

    @app.get("/oauth/google/callback")
    async def oauth_google_callback(
        request: Request,
        code: str,
        state: str | None = None,
        settings: Settings = Depends(get_settings),
        manager: SessionManager = Depends(get_session_manager),
        nhost_client: NhostGraphQLClient = Depends(get_nhost_client),
        session: SessionData | None = Depends(get_optional_session),
    ) -> RedirectResponse:
        if not session:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session missing for callback")
        expected_state = request.cookies.get("google_oauth_state")
        if not expected_state or expected_state != (state or ""):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State mismatch")
        redirect_uri = str(settings.google_redirect_uri or f"{settings.backend_base_url}/oauth/google/callback")
        flow = build_google_flow(settings, redirect_uri=redirect_uri)
        flow.fetch_token(code=code)
        credentials = flow.credentials
        if not credentials.refresh_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No refresh token returned")
        expiry_iso = credentials.expiry.isoformat() if credentials.expiry else None
        await nhost_client.upsert_gmail_token(
            user_id=session.user_id,
            refresh_token=credentials.refresh_token,
            access_token=credentials.token,
            expiry=expiry_iso,
            scopes=list(credentials.scopes or GMAIL_SCOPES),
        )
        cookie_value = manager.create_cookie(
            session.user_id,
            verified=True,
            gmail_address=session.gmail_address,
        )
        response = RedirectResponse(url=str(settings.frontend_base_url or settings.backend_base_url), status_code=status.HTTP_302_FOUND)
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=cookie_value,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=cookie_samesite,
        )
        response.delete_cookie("google_oauth_state")
        return response

    @app.post("/api/logout", status_code=status.HTTP_204_NO_CONTENT)
    async def logout(response: Response) -> Response:
        response.delete_cookie(SESSION_COOKIE_NAME)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
