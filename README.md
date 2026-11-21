# Kormo Mela

## 🔗 Live site: https://kormo-mela-frontend.onrender.com

A marketplace for braiding services for Black women on campus. Clients find student braiders, see real prices and durations up front, and request appointments. Braiders list their styles, manage requests, and build a reputation through reviews. No more chasing DMs.

## Architecture

```
Browser ──▶ Vite + React website (TypeScript, hash routing)
              │  REST /api, token auth
              ▼
           Django 5 + Django REST Framework API (gunicorn)
              │
              ▼
           Postgres (when DATABASE_URL is set) · SQLite by default
```

- **Website** (`web/`, Vite + React 19 + TypeScript): browse braiders and styles, book appointments, leave reviews. Talks to the Django API; the API base is baked in at build time via `VITE_API_URL`.
- **Backend** (`backend/`, Django 5 + DRF, token auth): public browsing of styles, braiders, and listings; a `/recommended/` endpoint that ranks braiders with transparent match scores (availability / rating / price / experience); bookings with accept, decline, complete, and cancel; reviews only after a completed booking, one per booking. Past dates are rejected and double-booking is blocked.
- **Deploy**: `render.yaml` — Django web service + static frontend on Render. (An Expo / React Native app in `frontend/` is kept for future mobile work; the website is the primary deliverable.)

## Stack

Vite · React 19 · TypeScript · react-router-dom · Django 5 · Django REST Framework · PostgreSQL · Render

## Run it locally

Backend (Python 3.12):

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver   # http://127.0.0.1:8000
```

Website:

```bash
cd web
npm install
npm run dev                            # http://localhost:5173
```

The website reads `VITE_API_URL` (default `http://localhost:8000/api`). Docker: `docker compose up` runs Postgres + the backend.

## Demo accounts (password `demo1234` for all)

| Account | Role | Notes |
| --- | --- | --- |
| `client_demo` | Client | One upcoming + one completed booking |
| `client_new` | Client | Bare profile |
| `braider_demo` (Adaeze) | Braider | Knotless, box braids, cornrows |
| `braider_ada` (Zuri) | Braider | Cornrows, stitch braids, twists |
| `braider_zuri` (Mariam) | Braider | Faux locs, goddess braids, twists |
| `braider_new` | Braider | Bare profile |

All seeded braiders are flagged demo and shown with a **Demo profile** badge. No real people are seeded.

## Tests

10 backend tests (`backend/marketplace/tests/`, `cd backend && .venv/bin/python manage.py test marketplace`).

## Notes

- The live site is on Render's free tier, so the first load can take about a minute while it wakes up.
