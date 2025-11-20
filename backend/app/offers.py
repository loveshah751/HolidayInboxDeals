from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable, List, Optional

from pydantic import BaseModel


class Offer(BaseModel):
    brand: str
    description: str
    discount: Optional[str] = None
    code: Optional[str] = None
    expiry: Optional[date] = None
    link: Optional[str] = None


class OfferExtractor:
    """Create structured offers from raw Gmail email objects."""

    def extract(self, emails: Iterable[dict[str, str]]) -> List[Offer]:
        offers: List[Offer] = []
        for email in emails:
            label_ids = email.get("label_ids") or []
            if "CATEGORY_PROMOTIONS" not in label_ids:
                continue
            sender = email.get("sender") or email.get("from") or "Unknown"
            subject = email.get("subject") or email.get("snippet") or "Promotion"
            snippet = email.get("snippet") or ""
            body = email.get("body") or ""
            offer = Offer(
                brand=self._extract_brand(sender),
                description=subject.strip(),
                discount=self._extract_discount(subject, snippet, body),
                code=self._extract_code(body),
                link=self._extract_link(body, snippet),
                expiry=self._extract_expiry(body, snippet),
            )
            if self._is_informative(offer):
                offers.append(offer)
        return offers

    def _is_informative(self, offer: Offer) -> bool:
        return any([offer.discount, offer.code, offer.link])

    def _extract_brand(self, sender: str) -> str:
        if "<" in sender and ">" in sender:
            return sender.split("<", 1)[0].strip().strip('"') or sender
        return sender

    def _extract_discount(self, *texts: str) -> Optional[str]:
        pattern = re.compile(r"\b(\d{1,3}%|\$\d+)", re.IGNORECASE)
        for text in texts:
            if not text:
                continue
            match = pattern.search(text)
            if match:
                return match.group(1)
        return None

    def _extract_code(self, text: str) -> Optional[str]:
        if not text:
            return None
        patterns = [
            re.compile(r"code[:=]\s*([A-Z0-9-]{4,})", re.IGNORECASE),
            re.compile(r"use\s+([A-Z0-9-]{4,})\s+at", re.IGNORECASE),
        ]
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                return match.group(1)
        return None

    def _extract_link(self, *texts: str) -> Optional[str]:
        pattern = re.compile(r"https?://\S+")
        for text in texts:
            if not text:
                continue
            match = pattern.search(text)
            if match:
                return match.group(0)
        return None

    def _extract_expiry(self, *texts: str) -> Optional[date]:
        for text in texts:
            if not text:
                continue
            match = re.search(r"expires?\s+on\s+(\w+\s+\d{1,2},\s+\d{4})", text, re.IGNORECASE)
            if match:
                try:
                    return datetime.strptime(match.group(1), "%B %d, %Y").date()
                except ValueError:
                    continue
        return None
