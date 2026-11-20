"""Vercel serverless entry point for the braidedU Django API.

Vercel's Python runtime looks for a WSGI callable named ``app``. All
requests are rewritten here by backend/vercel.json.

Serverless functions have no deploy-time shell, so when
BRAIDEDU_BOOTSTRAP=1 the API prepares its own database on cold start:
``migrate`` (a cheap no-op once the tables exist) and, only when there are
no users yet, ``seed_demo``. Both are idempotent, so repeated cold starts
never duplicate data or touch real accounts.
"""

import os
import sys

# Make the backend folder (manage.py's directory) importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "braidedu.settings")

from braidedu.wsgi import application  # noqa: E402

if os.environ.get("BRAIDEDU_BOOTSTRAP") == "1":
    try:
        from django.contrib.auth.models import User
        from django.core.management import call_command

        call_command("migrate", interactive=False, verbosity=0)
        if not User.objects.exists():
            call_command("seed_demo")
    except Exception as exc:  # keep the function alive; the error shows in Vercel logs
        print(f"[braidedu] database bootstrap failed: {exc!r}", file=sys.stderr)

app = application
