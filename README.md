# braidedU

## 🔗 Live site: https://braidedu-frontend.onrender.com

A marketplace for braiding services for Cornell students. Clients find braiders, see prices and durations up front, and request appointments; braiders list styles with prices, set their hours, and manage requests, payments, and reviews. Signup requires a Cornell email, and accounts are confirmed by email.

## Architecture

```
Browser ──▶ React + TypeScript + Vite (hash routing, web/)
              │  REST calls to /api (Token auth)
              ▼
           Django + Django REST Framework (backend/, gunicorn)
              │  reads / writes
              ▼
           Neon Postgres (DATABASE_URL; SQLite if unset)
              │
           Photos: Cloudinary · Email: Resend (from hello@jemimahosei.com)
```

- **Frontend** (`web/`, React 19, TypeScript, Vite): browse and filter braiders, braider profiles with priced listings and open slots, booking, dashboard, messages, reviews.
- **Backend** (Django 5 + DRF): auth with email confirmation and password reset, braiders/listings, availability slots, bookings (`requested → accepted → paid → confirmed → completed`), reviews, messages, reports and blocks.
- **Photos**: uploads go to Cloudinary (resized, with thumb/large variants); the database stores only the URL.
- **Email**: account confirmation, password reset, and message notifications go out through Resend.
- **Deploy**: `render.yaml` — Django web service + static frontend on Render. (An Expo / React Native app in `frontend/` is kept for future mobile work.)

## Stack

React 19 · TypeScript · Vite · Django 5 · Django REST Framework · Neon Postgres · Cloudinary · Resend · Render

## Run it locally

Backend (Python 3.12):

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_styles
.venv/bin/python manage.py runserver   # http://127.0.0.1:8000
```

Website:

```bash
cd web
npm install
npm run dev                            # http://localhost:5173
```

The website reads `VITE_API_URL` (default `http://localhost:8000/api`). Docker: `docker compose up` runs Postgres + the backend.

## Tests

74 backend tests (`backend/marketplace/tests/`, `python manage.py test marketplace` — verified passing).

## Notes

- The live site is on Render's free tier, so the first load can take about a minute while it wakes up.
- No demo data: the 15 braid styles are seeded on every deploy; braiders and clients are real people who sign up.
