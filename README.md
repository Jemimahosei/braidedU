# braidedU — Braids on Campus

**Live site: https://braidedu-frontend.onrender.com**
(The API sleeps when idle, so the first load can take up to a minute. The
site tells you when it is waking up.)

A marketplace for braiding services for Black individuals on campus. Clients
find student braiders, see real prices and durations up front, and request
appointments. Braiders list their styles, manage requests, and build a
reputation through reviews. No more chasing DMs.


## Pages

| Route | Page | Who |
| --- | --- | --- |
| `/` | Home: find-a-braider search, styles with lowest prices, featured braiders, how booking works | Everyone |
| `/browse` | Filter braiders by style, date, campus area and budget; ranked when a style and date are chosen | Everyone |
| `/braiders/:id` | Braider profile: bio, hours, where she braids, her rules, priced listings, reviews, booking form with open times only | Everyone (booking needs a client account) |
| `/messages`, `/messages/:userId` | Conversations with an email notice to the other person, photo sharing, report and block | Signed in |
| `/signup`, `/login` | Create an account with a Cornell email (client or braider), log in | Everyone |
| `/confirm?token=`, `/forgot`, `/reset?token=` | Email confirmation, forgot password, choose a new password | Everyone |
| `/dashboard` | Client: My bookings (appointments, change time, cancel). Braider: Requests (accept, decline, payment received, complete, cancel) and reviews | Signed in |
| `/bookings/:id` | Booking page: pay info after accept, "I've paid", screenshot, receipt, review | Signed in |
| `/join` | Braider onboarding after email confirmation | Braiders |
| `/postings`, `/postings/new`, `/postings/:id/edit` | Braider postings: list, add, edit, delete (not once booked) | Braiders |
| `/availability`, `/my-page` | Braider hours, rules and deposit note; edit her public page | Braiders |
| `/account` | Phone-only tab: account links and log out | Signed in |

## Stack

- **Backend:** Django 5 + Django REST Framework, token auth. SQLite by
  default, Postgres when `DATABASE_URL` is set.
- **Website:** Vite + React + TypeScript (`web/`), hash routing so it works
  as a plain static site. Talks to the Django API.
- **Mobile app:** Expo / React Native (`frontend/`), kept for future mobile
  work. The website is the primary deliverable.
- **Deploy:** `render.yaml` (Django web service + static frontend on Render,
  the current live demo). `backend/vercel.json` + `backend/api/index.py` and
  `web/vercel.json` are ready for a Vercel deployment (see `DEPLOY_NOTES.md`).

## Run locally

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
# or: npm run build && npx vite preview --port 4173
```

The website reads `VITE_API_URL` (default `http://localhost:8000/api`).
Docker: `docker compose up` runs Postgres + the backend.

## Real braiders only

There is no demo data. The 15 braid styles are created on every deploy by
`python manage.py seed_styles` (safe to repeat). Braiders and clients are real
people who sign up. Photos go on the site only after the person has agreed.

## API

Base: `/api/`. Auth: `Authorization: Token <key>`.

- `POST /api/auth/register/` `{email (@cornell.edu), password (8+), role: braider|client, display_name?}` → sends a confirmation email; no token yet
- `POST /api/auth/confirm/` `{token}` → `{token, username, role, profile_id}` (activates the account)
- `POST /api/auth/resend/` `{email}` · `POST /api/auth/password-reset/` `{email}` (same answer for unknown emails)
- `POST /api/auth/password-reset/confirm/` `{token, password}` — single use, 1 hour
- `POST /api/auth/login/` `{username: email, password}` → `{token, username, role, profile_id}`; 403 until the email is confirmed
- `GET /api/styles/` — braid styles (public)
- `GET /api/braiders/?style=&campus_area=` — public, paginated
- `GET /api/braiders/<id>/` — profile with listings + reviews (public)
- `GET /api/recommended/?style=&date=&max_price=` — ranked braiders with
  transparent match scores (availability / rating / price / experience)
- `GET /api/listings/?style=&braider=&max_price=&campus_area=` — public
- `POST /api/listings/` — braider only
- `GET /api/my-listings/` · `PATCH /api/listings/<id>/` — braider's own
- `GET /api/braiders/me/` · `PATCH /api/braiders/me/` — braider profile, including `service_places` (`my_place|client_place|campus_space`), `private_address` (only ever returned to her), `cancel_window_hours`, `deposit_note`, `policy_text`, `reminders_enabled`, `buffer_minutes`
- `GET /api/braiders/<id>/slots/?listing=&date=` — public; start times still open that day
- `GET|POST /api/braiders/me/time-off/` `{start_date, end_date, note}` · `DELETE /api/braiders/me/time-off/<id>/`
- `GET /api/clients/me/` · `PATCH /api/clients/me/` — client profile
- `GET /api/bookings/?status=` · `POST /api/bookings/` `{listing, date, start_time, notes}`
- `POST /api/bookings/<id>/accept|decline|complete|payment-received/` — braider; `braider-cancel/ {reason}` — braider
- `POST /api/bookings/<id>/paid/ {screenshot_url?}` · `cancel/ {reason?}` · `reschedule/ {date, start_time}` — client. Cancelling inside the braider's cancel window sets `late_cancel`; rescheduling is blocked inside it and sends the booking back to `requested`
- `GET /api/bookings/<id>/receipt/` — either party, once payment is confirmed
- Booking `status`: `requested → accepted → paid (client says paid) → confirmed (braider got it) → completed`, or `declined` / `cancelled`. `pay` (Venmo, Zelle, deposit note) and `address` appear on a booking only from `accepted` on; they are never in public profile output
- `POST /api/bookings/<id>/review/` `{rating 1-5, comment}` — client, completed only
- `GET /api/braiders/<id>/reviews/` — public
- `PATCH /api/braiders/me/` and `POST /api/listings/` accept `photo_url`; `POST /api/bookings/<id>/review/` accepts `photo_urls` (up to 4). A photo link is accepted only if that user uploaded it.
- `GET /api/messages/` (conversations) · `GET /api/messages/unread/` · `GET|POST /api/messages/<user_id>/` `{body, photo_url?}` — a client can write to any braider; a braider can write to a client once they share a booking or the client wrote first. One email per burst of unread messages
- `POST|DELETE /api/blocks/<user_id>/` — a block stops messages and bookings both ways and declines pending requests between the two
- `POST /api/reports/` `{user_id, reason: harassment|no_show|scam|fake|other, detail?}` — read in the Django admin (and emailed to `REPORT_EMAIL` if set)
- `POST /api/reviews/<id>/reply/` `{reply}` — the reviewed braider's one public reply
- `DELETE /api/photos/mine/` — removes every photo you uploaded, from storage and from your page
- `POST /api/photos/` multipart `{image, kind: profile|work|review|message|reference}` → `{id, url, thumb_url, large_url}` — signed in; JPG/PNG/WebP/GIF up to 10 MB
- `DELETE /api/photos/<id>/` — owner only; removes the file from storage too

Booking rules: a request must start at one of the open times from `/slots/` (inside
her hours, a day she works, not on time off, not in the past, long enough for the
style, and clear of accepted bookings plus her rest time); reviews only after completion,
one per booking.

## Day-before reminders

`python manage.py send_reminders` emails clients about tomorrow's accepted
bookings (once each, skipping braiders who turned reminders off). It needs to
run once a day. Render's free plan has no cron, so until a scheduler is set up
run it by hand or from any free scheduler that can run a command.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres URL (`postgres://user:pass@host:port/db`). Unset → SQLite |
| `DJANGO_SECRET_KEY` | Required in production (dev default is insecure) |
| `DJANGO_DEBUG` | `1`/`0`, default `1` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated, default `127.0.0.1,localhost,10.0.2.2` |
| `DJANGO_CORS_ALLOW_ALL` | `1`/`0`, default `1` when DEBUG else `0` |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Comma-separated origins when not allow-all |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Photo storage (Cloudinary free plan). All three set → photos upload to Cloudinary and are served resized and compressed. Unset → saved to local disk (development only; Render wipes it on redeploy) |
| `RESEND_API_KEY` | Email sending through Resend. Unset → emails are printed to the server log. Until a domain is verified at Resend, the test sender can only deliver to the Resend account owner's own address |
| `RESEND_FROM` | Sender, default `braidedU <onboarding@resend.dev>`; change once a domain is verified |
| `REPORT_EMAIL` | Optional. Where new reports are emailed. Reports are always visible in the Django admin |
| `FRONTEND_URL` | Base URL used in emailed links (default: the Render site when `DJANGO_DEBUG=0`) |
| `VITE_API_URL` | API base URL baked into the website build |

## Photos

The database stores only a photo's link; the file lives in Cloudinary. Uploads are
checked (real image, allowed type, 10 MB cap), kept to 1800 px on the long side, and
delivered as `thumb_url` (480 px) or `large_url` (1200 px) in an automatic modern
format so pages stay fast. Users can delete their own photos, which also removes
the stored file.

## Design

Calm and photo-led. Sage ground (`#eef1ee`), sand accent (`#efd9a3`), green
(`#3f6b57`), big rounded cards and pill buttons, Fraunces for headings and
Figtree for text. Real photos lead every card; a braider with no photo shows
her initials on sand, never a stand-in face. The logo is a silhouette badge
with a braided bun. The site shows a "server waking up" notice instead of an
empty list when the free API host is asleep. Phone layouts use the same
styles under 700px: a bottom tab bar (Find / Messages / Bookings, or
Requests / Messages / Postings for braiders, plus Account), single-column cards,
a sticky Book bar on braider profiles and full-width chat. The footer reads "A Cornell student project".

## Tests

```bash
cd backend
.venv/bin/python manage.py test marketplace   # 61 tests
```
