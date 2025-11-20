# Gmail Promotions Offers App

This project lets a user sign in with Nhost (Google provider), connect their Gmail account, and view structured promotions that were extracted from their Promotions label. It is split into a React/Vite frontend and a FastAPI backend.

## Architecture at a Glance

- **Frontend (Vite + React + TypeScript)** – Handles Nhost authentication, renders the connect Gmail CTA, and displays parsed offers. All API calls include the current Nhost access token plus the backend session cookie.
- **Backend (FastAPI)** – Validates the Nhost JWT, drives the Google OAuth consent flow, stores refresh tokens inside the Nhost Postgres database via GraphQL, fetches Promotions with the Gmail API, and converts the raw messages into simple offer cards.
- **Nhost** – Provides the hosted Hasura instance, authentication (including Google sign-in), and a GraphQL API we use to persist each user’s Gmail token record.
- **Google APIs** – Gmail OAuth flow returns refresh tokens to the backend, which then calls Gmail’s REST API (CATEGORY_PROMOTIONS) whenever the user loads or refreshes offers.

## Main Flows

1. **Sign in** – The frontend uses `nhost.auth.signInProviderURL("google")`. After Google redirects back with an Nhost refresh token, the frontend finalizes the session and starts polling the backend.
2. **Connect Gmail** – Clicking “Connect Gmail” calls `/api/google/connect`. The backend builds a Google OAuth consent URL, saves a signed session cookie, and returns the URL to the browser. After Google redirects back to `/oauth/google/callback`, the backend exchanges the code for access/refresh tokens and persists them through Hasura.
3. **Fetch offers** – `/api/offers` looks up the user’s Gmail token, refreshes it via Google if needed, fetches Promotions emails, filters + deduplicates, and returns `offers[]`. `/api/promotions/raw` exposes the raw Gmail payload for debugging.

## Running Locally

### Backend

Requirements: Python 3.10+, [`uv`](https://github.com/astral-sh/uv).

1. Copy `backend/.env.example` (or create `backend/.env`) with values such as:

   ```ini
   BACKEND_BASE_URL=http://localhost:8000
   FRONTEND_BASE_URL=http://localhost:5173
   SESSION_SECRET=dev-secret
   COOKIE_SECURE=false

   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:8000/oauth/google/callback
   GMAIL_CREDENTIALS_FILE=backend/GMAIL_CREDENTIALS_FILE.json  # optional

   NHOST_GRAPHQL_URL=https://<project>.hasura.<region>.nhost.run/v1/graphql
   NHOST_ADMIN_SECRET=...
   NHOST_JWT_SECRET={"type":"HS256","key":"..."}
   ```

2. Install deps and run:

   ```bash
   cd backend
   UV_CACHE_DIR="$(pwd)/.uv-cache" uv sync
   uv run python main.py
   ```

The API listens on `http://localhost:8000`.

### Frontend

Requirements: Node 18+.

```bash
cd frontend
npm install
npm run dev
```

Set the following `.env` values (see `frontend/.env.example` if available):

```
VITE_NHOST_SUBDOMAIN=...
VITE_NHOST_REGION=...
VITE_NHOST_REDIRECT_TO=http://localhost:5173
VITE_BACKEND_URL=http://localhost:8000
```

After both servers are running, open `http://localhost:5173`, sign in with Google via Nhost, connect Gmail, and fetch offers.
