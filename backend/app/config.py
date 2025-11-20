from functools import lru_cache
from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration pulled from environment variables."""

    google_client_id: str | None = Field(default=None)
    google_client_secret: str | None = Field(default=None)
    google_redirect_uri: AnyHttpUrl | None = Field(default=None)
    gmail_credentials_file: str | None = Field(default=None)
    gmail_token_file: str | None = Field(default=None)
    backend_base_url: AnyHttpUrl = Field(
        default="http://localhost:8000",
        description="Publicly reachable backend URL used as the OAuth redirect.",
    )
    frontend_base_url: AnyHttpUrl | None = Field(
        default=None,
        description="Optional frontend URL used for post-auth redirects.",
    )
    session_secret: str = Field(
        default="dev-session-secret",
        description="Secret used to sign session cookies. Replace in production.",
    )
    cookie_secure: bool = Field(
        default=False,
        description="If true, session cookie is marked secure.",
    )
    nhost_graphql_url: AnyHttpUrl | None = Field(default=None)
    nhost_admin_secret: str | None = Field(default=None)
    nhost_jwt_secret: str | None = Field(default=None)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""

    return Settings()
