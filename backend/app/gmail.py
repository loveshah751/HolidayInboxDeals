from __future__ import annotations

import asyncio
import base64
from datetime import datetime
from typing import Any, Iterable

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .config import Settings

DEFAULT_GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def _build_credentials(settings: Settings, token_record: dict[str, Any]) -> Credentials:
    client_id = settings.google_client_id
    client_secret = settings.google_client_secret
    if settings.gmail_credentials_file and not (client_id and client_secret):
        # If user provided a credentials file, load client info from it
        # but google-auth doesn't provide convenience method, so assume client_id/secret are set
        pass
    if not client_id or not client_secret:
        raise ValueError("Google client configuration is missing")
    scopes = token_record.get("scopes") or DEFAULT_GMAIL_SCOPES
    return Credentials(
        token=token_record.get("access_token"),
        refresh_token=token_record.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=scopes,
    )


def _decode_body(payload: dict[str, Any]) -> str:
    body = payload.get("body", {})
    data = body.get("data")
    if data:
        try:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")
        except Exception:
            return ""
    for part in payload.get("parts", []) or []:
        text = _decode_body(part)
        if text:
            return text
    return ""


def _extract_headers(message: dict[str, Any]) -> dict[str, str]:
    headers = {}
    for header in message.get("payload", {}).get("headers", []):
        name = header.get("name")
        value = header.get("value")
        if name and value:
            headers[name] = value
    return headers


def _extract_email(service, message_meta: dict[str, Any]) -> dict[str, Any]:
    msg = service.users().messages().get(userId="me", id=message_meta["id"]).execute()
    headers = _extract_headers(msg)
    body_text = _decode_body(msg.get("payload", {}))
    return {
        "id": msg["id"],
        "label_ids": msg.get("labelIds", []),
        "subject": headers.get("Subject", ""),
        "sender": headers.get("From", ""),
        "date": headers.get("Date"),
        "snippet": msg.get("snippet", ""),
        "body": body_text,
        "link": f"https://mail.google.com/mail/u/0/#all/{msg['id']}",
    }


def _list_promotions(creds: Credentials, max_results: int, page_token: str | None) -> tuple[list[dict[str, Any]], str | None]:
    service = build("gmail", "v1", credentials=creds)
    messages_response = service.users().messages().list(
        userId="me",
        labelIds=["CATEGORY_PROMOTIONS"],
        maxResults=max_results,
        pageToken=page_token,
    ).execute()
    messages = messages_response.get("messages", [])
    emails = [_extract_email(service, meta) for meta in messages]
    return emails, messages_response.get("nextPageToken")


async def fetch_promotions_from_gmail(
    settings: Settings,
    token_record: dict[str, Any],
    *,
    max_results: int,
    page_token: str | None,
) -> tuple[list[dict[str, Any]], str | None]:
    creds = _build_credentials(settings, token_record)
    try:
        return await asyncio.to_thread(_list_promotions, creds, max_results, page_token)
    except HttpError as exc:
        raise RuntimeError(f"Gmail API error: {exc}")
