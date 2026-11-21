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
import urllib.error
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


LAST_ERROR = {"detail": ""}


def email_mode():
    """'resend' when a Resend key is set, otherwise 'console' (printed to the log)."""
    return "resend" if (os.environ.get("RESEND_API_KEY") or "").strip() else "console"


def send_email(to, subject, text):
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    sender = os.environ.get("RESEND_FROM", "braidedU <onboarding@resend.dev>")
    if not api_key:
        logger.warning("EMAIL (console) to=%s subject=%s\n%s", to, subject, text)
        print(f"\n--- email to {to}: {subject}\n{text}\n---", flush=True)
        return False
    body = json.dumps({"from": sender, "to": [to], "subject": subject, "text": text}).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # Resend sits behind Cloudflare, which refuses Python's default
            # User-Agent with error 1010.
            "User-Agent": "braidedU/1.0 (+https://braidedu-frontend.onrender.com)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            LAST_ERROR["detail"] = ""
            return True
    except urllib.error.HTTPError as exc:
        try:
            reason = exc.read().decode()[:300]
        except Exception:  # noqa: BLE001
            reason = ""
        LAST_ERROR["detail"] = f"Resend answered {exc.code}: {reason}"
        logger.error("Resend email to %s failed: %s", to, LAST_ERROR["detail"])
        return False
    except Exception as exc:  # noqa: BLE001 - never break the request over an email
        LAST_ERROR["detail"] = f"{type(exc).__name__}: {exc}"[:300]
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
    return send_email(
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


# ---------------------------------------------------------------- bookings


def _when(b):
    return f"{b.date:%a %b %-d} at {b.start_time:%-I:%M %p}"


def _site():
    return f"{frontend_url()}/#/dashboard"


def booking_requested(b):
    send_email(
        b.braider.user.email,
        f"New booking request from {b.client.display_name}",
        f"{b.client.display_name} asked for {b.listing.title} on {_when(b)}.\n"
        f"Accept or decline here: {_site()}",
    )


def booking_accepted(b):
    send_email(
        b.client.user.email,
        f"{b.braider.display_name} accepted your booking",
        f"Good news: {b.braider.display_name} accepted {b.listing.title} on {_when(b)}.\n"
        f"Open braidedU to see where to pay and the details: {_site()}\n\n"
        "Venmo and Zelle have no buyer protection, so only pay the handle shown in your booking.",
    )


def booking_declined(b):
    send_email(
        b.client.user.email,
        f"{b.braider.display_name} can't make that time",
        f"{b.braider.display_name} declined {b.listing.title} on {_when(b)}. "
        f"Pick another time or braider: {frontend_url()}/#/browse",
    )


def client_says_paid(b):
    send_email(
        b.braider.user.email,
        f"{b.client.display_name} says they paid",
        f"{b.client.display_name} marked {b.listing.title} on {_when(b)} as paid. "
        f"Check your Venmo or Zelle, then confirm in braidedU: {_site()}",
    )


def payment_received(b):
    send_email(
        b.client.user.email,
        f"Receipt: {b.listing.title} with {b.braider.display_name}",
        f"{b.braider.display_name} confirmed your payment of ${b.listing.price:.0f}.\n"
        f"Appointment: {b.listing.title}, {_when(b)} ({b.listing.duration_minutes} min).\n"
        f"Receipt #{b.id}. Your booking: {_site()}",
    )


def booking_cancelled(b, by):
    if by == "client":
        to, who = b.braider.user.email, b.client.display_name
        extra = " This was inside your cancel window." if b.late_cancel else ""
    else:
        to, who = b.client.user.email, b.braider.display_name
        extra = f" Reason: {b.cancel_reason}" if b.cancel_reason else ""
    send_email(to, f"Booking cancelled by {who}", f"{who} cancelled {b.listing.title} on {_when(b)}.{extra}")


def booking_rescheduled(b):
    send_email(
        b.braider.user.email,
        f"{b.client.display_name} asked to move their booking",
        f"{b.client.display_name} asked to move {b.listing.title} to {_when(b)}. "
        f"Accept or decline: {_site()}",
    )


def booking_reminder(b):
    place = ""
    if b.place in ("", "my_place") and b.braider.private_address:
        place = f"\nWhere: {b.braider.private_address}"
    send_email(
        b.client.user.email,
        f"Reminder: braids with {b.braider.display_name} tomorrow",
        f"{b.listing.title} is tomorrow, {_when(b)}.{place}\n"
        f"Her rules: {b.braider.policy_text or 'none listed'}\nDetails: {_site()}",
    )


def new_message(sender, recipient, body):
    from .views_social import person

    name = person(sender)[0]
    snippet = (body[:200] + "…") if len(body) > 200 else body
    send_email(
        recipient.email,
        f"New message from {name}",
        f"{name} wrote:\n\n{snippet or '(a photo)'}\n\nReply on braidedU: {frontend_url()}/#/messages/{sender.id}",
    )


def report_filed(report):
    to = os.environ.get("REPORT_EMAIL")
    if not to:
        return
    send_email(
        to,
        f"braidedU report: {report.reason}",
        f"{report.reporter.username} reported {report.reported.username}\n"
        f"Reason: {report.reason}\n\n{report.detail}",
    )
