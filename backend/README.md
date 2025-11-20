# Backend

FastAPI backend for the Gmail Promotions Offers project. It exposes the session, OAuth helper, and offers endpoints required by the frontend.

## Requirements

- Python 3.10+
- [`uv`](https://github.com/astral-sh/uv) for dependency management

## Environment

Create a `.env` file inside `backend/` when you're ready to integrate real services. Typical values:

```
BACKEND_BASE_URL=http://localhost:8000
FRONTEND_BASE_URL=http://localhost:5173
SESSION_SECRET=change-me
COOKIE_SECURE=false

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/oauth/google/callback
GMAIL_CREDENTIALS_FILE=backend/GMAIL_CREDENTIALS_FILE.json  # optional helper file

NHOST_GRAPHQL_URL=https://<project>.hasura.<region>.nhost.run/v1/graphql
NHOST_ADMIN_SECRET=...
NHOST_JWT_SECRET={"type":"HS256","key":"..."}
```

## Install & Run

```bash
# Install dependencies
UV_CACHE_DIR="$(pwd)/.uv-cache" uv sync

# Start dev server with reload
uv run python main.py
```

The API will be available at `http://localhost:8000`. Example endpoints:

- `GET /api/health`
- `GET /api/session`
- `GET /api/google/connect`
- `GET /api/offers?max_results=20&page_token=...`
- `GET /api/promotions/raw?max_results=20&page_token=...`
- `GET /oauth/google/callback`
- `POST /api/logout`

Use `/api/promotions/raw` if you need to inspect the Gmail payload. `/api/offers` converts those messages into simple structured offers (filters to the last 30 days, deduplicates, and returns `next_page_token` for pagination). Both endpoints require that the user has connected Gmail via `/api/google/connect`; if no token exists, the backend returns `400` so the frontend can prompt the user to connect first.
