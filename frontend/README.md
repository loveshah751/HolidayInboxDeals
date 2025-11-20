# Frontend

React + Vite SPA that talks to the FastAPI backend.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Create a `.env.local` (or use your preferred dotenv file) with:

```
VITE_BACKEND_URL=http://localhost:8000
VITE_NHOST_SUBDOMAIN=sgvzekrvxvpxgqtqkwod
VITE_NHOST_REGION=us-east-1
VITE_NHOST_REDIRECT_TO=http://localhost:5174
```

Make sure `VITE_NHOST_REDIRECT_TO` is added to **Authentication → Settings → Redirect URLs** in the Nhost dashboard (change it to your production frontend URL when you deploy).

By default the Vite dev server proxies `/api` and `/oauth` to `http://localhost:8000`. Set `VITE_BACKEND_URL` if you deploy the backend elsewhere.

### Auth Test Page

The app currently renders a minimal authentication test UI (replaces the previous Gmail UI) so we can verify Google/Nhost sign-in works end-to-end. It shows your current sign-in status and lets you trigger Google sign-in / sign-out from `src/App.tsx`.

### Test auth view

Navigate to `http://localhost:5174/test-auth` to open a minimal page that only exercises the Nhost/Google sign-in flow. It renders the `TestAuth` component we added in `src/TestAuth.tsx`, showing the signed-in email (if any) and providing simple sign-in / sign-out buttons without touching the main app UI.
