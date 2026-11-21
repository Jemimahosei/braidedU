"""Email sending: SMTP (Gmail) first, Resend second, console last.

SMTP is the sender that reaches anyone; Resend's test sender only delivers
to the Resend account owner's own address. These tests use a fake SMTP
server (no network) and a stubbed Resend call.
"""

import os
from unittest import mock

from django.test import SimpleTestCase

from marketplace import emails

ENV_KEYS = ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "RESEND_API_KEY")


class FakeSMTP:
    """Captures what would be sent; optionally fails at login."""

    instances = []

    def __init__(self, *args, **kwargs):
        self.host, self.port = args[0], args[1]
        self.starttls_called = False
        self.sent = []
        self.fail_login = False
        FakeSMTP.instances.append(self)

    def starttls(self):
        self.starttls_called = True

    def login(self, user, password):
        self.user, self.password = user, password
        if self.fail_login:
            raise ValueError("bad password")

    def send_message(self, msg):
        self.sent.append(msg)

    def quit(self):
        pass


class EmailTests(SimpleTestCase):
    def setUp(self):
        FakeSMTP.instances.clear()
        emails.LAST_ERROR["detail"] = ""

    def _env(self, **overrides):
        """Patch the env so exactly the given mail keys are set."""
        values = {k: "" for k in ENV_KEYS}
        values.update(overrides)
        return mock.patch.dict(os.environ, values, clear=False)

    def test_smtp_sends_to_anyone(self):
        with (
            self._env(
                SMTP_HOST="smtp.gmail.com",
                SMTP_PORT="587",
                SMTP_USER="sender@gmail.com",
                SMTP_PASS="app-password",
            ),
            mock.patch("marketplace.emails.smtplib.SMTP", FakeSMTP),
        ):
            self.assertEqual(emails.email_mode(), "smtp")
            link = "https://braidedu-frontend.onrender.com/#/confirm?token=abc123"
            self.assertTrue(emails.send_email("eoa9@cornell.edu", "Confirm your braidedU account", f"Hi!\n{link}"))
            self.assertEqual(emails.LAST_ERROR["detail"], "")
        server = FakeSMTP.instances[-1]
        self.assertEqual((server.host, server.port), ("smtp.gmail.com", 587))
        self.assertTrue(server.starttls_called)
        self.assertEqual((server.user, server.password), ("sender@gmail.com", "app-password"))
        self.assertEqual(len(server.sent), 1)
        msg = server.sent[0]
        self.assertEqual(msg["To"], "eoa9@cornell.edu")
        self.assertEqual(msg["From"], "sender@gmail.com")
        # The confirmation link must go out whole on one line.
        self.assertIn("token=abc123", msg.get_content())

    def test_smtp_ssl_port_465_skips_starttls(self):
        with (
            self._env(
                SMTP_HOST="smtp.gmail.com",
                SMTP_PORT="465",
                SMTP_USER="sender@gmail.com",
                SMTP_PASS="app-password",
            ),
            mock.patch("marketplace.emails.smtplib.SMTP_SSL", FakeSMTP),
        ):
            self.assertTrue(emails.send_email("eoa9@cornell.edu", "Hi", "hello"))
        server = FakeSMTP.instances[-1]
        self.assertFalse(server.starttls_called)

    def test_smtp_failure_is_reported_not_raised(self):
        def failing_smtp(*args, **kwargs):
            inst = FakeSMTP(*args, **kwargs)
            inst.fail_login = True
            return inst

        with (
            self._env(
                SMTP_HOST="smtp.gmail.com",
                SMTP_USER="sender@gmail.com",
                SMTP_PASS="wrong",
            ),
            mock.patch("marketplace.emails.smtplib.SMTP", failing_smtp),
        ):
            self.assertFalse(emails.send_email("eoa9@cornell.edu", "Hi", "hello"))
            self.assertTrue(emails.LAST_ERROR["detail"].startswith("SMTP failed"))

    def test_resend_used_when_smtp_unset(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        with (
            self._env(RESEND_API_KEY="re_test"),
            mock.patch("marketplace.emails.urllib.request.urlopen", return_value=FakeResponse()),
        ):
            self.assertEqual(emails.email_mode(), "resend")
            self.assertTrue(emails.send_email("eoa9@cornell.edu", "Hi", "hello"))
            self.assertEqual(emails.LAST_ERROR["detail"], "")

    def test_console_when_nothing_configured(self):
        with self._env():
            self.assertEqual(emails.email_mode(), "console")
            self.assertFalse(emails.send_email("eoa9@cornell.edu", "Hi", "hello"))
