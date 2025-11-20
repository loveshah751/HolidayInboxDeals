from __future__ import annotations

from typing import Any

import httpx

from .config import Settings


class NhostGraphQLClient:
    def __init__(self, settings: Settings) -> None:
        if not settings.nhost_graphql_url or not settings.nhost_admin_secret:
            raise RuntimeError("Nhost GraphQL configuration is missing")
        self.url = str(settings.nhost_graphql_url)
        self.admin_secret = settings.nhost_admin_secret

    async def execute(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                self.url,
                json={"query": query, "variables": variables},
                headers={"x-hasura-admin-secret": self.admin_secret},
            )
            response.raise_for_status()
            payload = response.json()
            if "errors" in payload:
                raise RuntimeError(str(payload["errors"]))
            return payload["data"]

    async def upsert_gmail_token(
        self,
        *,
        user_id: str,
        refresh_token: str,
        access_token: str | None,
        expiry: str | None,
        scopes: list[str],
    ) -> None:
        mutation = """
        mutation UpsertToken($userId: uuid!, $refresh: String!, $access: String, $expiry: timestamptz, $scopes: [String!]!) {
          insert_gmail_tokens_one(
            object: {
              user_id: $userId,
              refresh_token: $refresh,
              access_token: $access,
              expiry: $expiry,
              scopes: $scopes
            },
            on_conflict: {
              constraint: gmail_tokens_pkey,
              update_columns: [refresh_token, access_token, expiry, scopes]
            }
          ) {
            user_id
          }
        }
        """
        variables = {
            "userId": user_id,
            "refresh": refresh_token,
            "access": access_token,
            "expiry": expiry,
            "scopes": scopes,
        }
        await self.execute(mutation, variables)

    async def get_gmail_token(self, user_id: str) -> dict[str, Any] | None:
        query = """
        query GetToken($userId: uuid!) {
          gmail_tokens_by_pk(user_id: $userId) {
            refresh_token
            access_token
            expiry
            scopes
          }
        }
        """
        data = await self.execute(query, {"userId": user_id})
        return data.get("gmail_tokens_by_pk")
