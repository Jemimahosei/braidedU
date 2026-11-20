"""Sending email, and the signed links that go in it.

If RESEND_API_KEY is set, mail goes out through Resend (https://resend.com).
Otherwise it is printed to the server log, so everything still works in
development and before a sender is set up. Sending never raises: a failed
email must not break a sign-up or a booking.

Until a domain is verified at Resend, their test sender
(onboarding@resend.dev) can only deliver to the Resend account owner's own
address. Set RESEND_FROM once a domain exists.
"""

import json
import logging
import os
import urllib.request

from django.core import signing

logger = logging.getLogger(__name__)

CONFIRM_MAX_AGE = 3 * 24 * 3600
RESET_MAX_AGE = 3600


def frontend_url():
    default = (
        "http://localhost:5173"
        if os.environ.get("DJANGO_DEBUG", "1") == "1"
        else "https://braidedu-frontend.onrender.com"
    )
    return os.environ.get("FRONTEND_URL", default).rstrip("/")


def send_email(to, subject, text):
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("RESEND_FROM", "braidedU <onboarding@resend.dev>")
    if not api_key:
        logger.warning("EMAIL (console) to=%s subject=%s\n%s", to, subject, text)
        print(f"\n--- email to {to}: {subject}\n{text}\n---", flush=True)
        return False
    body = json.dumps({"from": sender, "to": [to], "subject": subject, "text": text}).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            return True
    except Exception:  # noqa: BLE001 - never break the request over an email
        logger.exception("Resend email to %s failed", to)
        return False


def make_token(user, purpose):
    # Including the password hash makes reset links single use.
    return signing.dumps({"u": user.pk, "p": purpose, "h": user.password[-12:]}, salt="braidedu")


def read_token(token, purpose, max_age):
    """Return the user the token was made for, or None."""
    from django.contrib.auth.models import User

    try:
        data = signing.loads(token, salt="braidedu", max_age=max_age)
    except signing.BadSignature:
        return None
    if data.get("p") != purpose:
        return None
    user = User.objects.filter(pk=data.get("u")).first()
    if user is None or user.password[-12:] != data.get("h"):
        return None
    return user


def send_confirmation(user):
    link = f"{frontend_url()}/#/confirm?token={make_token(user, 'confirm')}"
    send_email(
        user.email,
        "Confirm your braidedU account",
        f"Welcome to braidedU!\n\nConfirm your Cornell email to finish signing up:\n{link}\n\n"
        "The link works for 3 days. If you didn't sign up, ignore this email.",
    )


def send_reset(user):
    link = f"{frontend_url()}/#/reset?token={make_token(user, 'reset')}"
    send_email(
        user.email,
        "Reset your braidedU password",
        f"Choose a new password here:\n{link}\n\nThe link works for 1 hour and only once. "
        "If you didn't ask for this, ignore this email.",
    )
