import os
from unittest import mock

from django.contrib.auth.models import User
from django.core import mail
from rest_framework.test import APITestCase

from marketplace import emails

PW = "pw-12345678"


@mock.patch.dict(os.environ, {"EMAIL_REQUIRE_CONFIRM": "1"})
class CornellSignupTests(APITestCase):
    def register(self, email="ada@cornell.edu", **extra):
        return self.client.post(
            "/api/auth/register/",
            {"email": email, "password": PW, "role": "client", **extra},
            format="json",
        )

    def test_only_cornell_emails(self):
        for bad in ["ada@gmail.com", "ada@cornell.edu.evil.com", "ada@alumni.cornell.edu"]:
            self.assertEqual(self.register(bad).status_code, 400, bad)
        self.assertEqual(self.register("Ada@Cornell.edu").status_code, 201)
        self.assertTrue(User.objects.filter(username="ada@cornell.edu").exists())

    def test_short_password_rejected(self):
        r = self.client.post(
            "/api/auth/register/",
            {"email": "a@cornell.edu", "password": "short", "role": "client"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_duplicate_email_rejected(self):
        self.register()
        self.assertEqual(self.register("ADA@cornell.edu").status_code, 400)

    def test_register_gives_no_token_and_blocks_login_until_confirmed(self):
        r = self.register()
        self.assertNotIn("token", r.data)
        r = self.client.post("/api/auth/login/", {"username": "ada@cornell.edu", "password": PW}, format="json")
        self.assertEqual(r.status_code, 403)
        user = User.objects.get(username="ada@cornell.edu")
        r = self.client.post("/api/auth/confirm/", {"token": emails.make_token(user, "confirm")}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("token", r.data)
        r = self.client.post("/api/auth/login/", {"username": "Ada@cornell.edu", "password": PW}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_bad_confirm_token(self):
        self.register()
        r = self.client.post("/api/auth/confirm/", {"token": "nope"}, format="json")
        self.assertEqual(r.status_code, 400)
        user = User.objects.get(username="ada@cornell.edu")
        r = self.client.post("/api/auth/confirm/", {"token": emails.make_token(user, "reset")}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_stale_auth_token_does_not_block_public_auth_endpoints(self):
        # Regression: a browser holding a token from a deleted account (e.g.
        # after the site moved databases) used to get 401 "Invalid token."
        # from TokenAuthentication before the view ever ran — so a valid
        # confirmation link failed, and so did log in. Public auth endpoints
        # skip authentication entirely, so a stale header is ignored.
        self.register()
        user = User.objects.get(username="ada@cornell.edu")
        stale = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {stale}")
        r = self.client.post("/api/auth/confirm/", {"token": "nope"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["detail"], "That link is not valid any more. Ask for a new one.")
        r = self.client.post(
            "/api/auth/confirm/", {"token": emails.make_token(user, "confirm")}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("token", r.data)
        r = self.client.post("/api/auth/login/", {"username": "ada@cornell.edu", "password": PW}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_wrong_password(self):
        self.register()
        r = self.client.post("/api/auth/login/", {"username": "ada@cornell.edu", "password": "x"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_password_reset_is_single_use(self):
        self.register()
        user = User.objects.get(username="ada@cornell.edu")
        user.is_active = True
        user.save()
        r = self.client.post("/api/auth/password-reset/", {"email": "ada@cornell.edu"}, format="json")
        self.assertEqual(r.status_code, 200)
        # Same answer for an unknown address.
        r = self.client.post("/api/auth/password-reset/", {"email": "nobody@cornell.edu"}, format="json")
        self.assertEqual(r.status_code, 200)
        token = emails.make_token(user, "reset")
        r = self.client.post("/api/auth/password-reset/confirm/", {"token": token, "password": "new-pass-1234"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/auth/password-reset/confirm/", {"token": token, "password": "another-1234"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/auth/login/", {"username": "ada@cornell.edu", "password": "new-pass-1234"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_resend_only_for_unconfirmed(self):
        self.register()
        r = self.client.post("/api/auth/resend/", {"email": "ada@cornell.edu"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/auth/resend/", {"email": "who@cornell.edu"}, format="json")
        self.assertEqual(r.status_code, 200)


MAIL_KEYS = ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY", "RESEND_FROM", "EMAIL_REQUIRE_CONFIRM")


class AutoConfirmTests(APITestCase):
    """While no sender can reach new users, sign up must not lock them out."""

    def _env(self, **overrides):
        values = {k: "" for k in MAIL_KEYS}
        values.update(overrides)
        return mock.patch.dict(os.environ, values, clear=False)

    def register(self, email="ada@cornell.edu"):
        return self.client.post(
            "/api/auth/register/",
            {"email": email, "password": PW, "role": "client", "display_name": "Ada"},
            format="json",
        )

    def test_confirms_and_signs_in_when_no_sender_reaches_users(self):
        for env in ({}, {"RESEND_API_KEY": "re_test"}):  # Resend test sender reaches only its owner
            with self._env(**env):
                email = f"u{len(env)}@cornell.edu"
                r = self.register(email)
                self.assertEqual(r.status_code, 201)
                self.assertTrue(r.data["auto_confirmed"])
                self.assertIn("token", r.data)
                r = self.client.post("/api/auth/login/", {"username": email, "password": PW}, format="json")
                self.assertEqual(r.status_code, 200)

    def test_requires_confirmation_once_smtp_is_set(self):
        with self._env(SMTP_HOST="smtp.gmail.com", SMTP_USER="a@gmail.com", SMTP_PASS="x"), mock.patch(
            "marketplace.emails._send_smtp"
        ):
            r = self.register()
            self.assertNotIn("token", r.data)
            self.assertNotIn("auto_confirmed", r.data)
            r = self.client.post("/api/auth/login/", {"username": "ada@cornell.edu", "password": PW}, format="json")
            self.assertEqual(r.status_code, 403)

    def test_requires_confirmation_with_verified_resend_domain(self):
        with self._env(RESEND_API_KEY="re_test", RESEND_FROM="braidedU <hi@braidedu.com>"), mock.patch(
            "marketplace.emails.urllib.request.urlopen"
        ):
            self.assertNotIn("token", self.register().data)

    def test_require_flag_turns_it_off(self):
        with self._env(EMAIL_REQUIRE_CONFIRM="1"):
            self.assertNotIn("token", self.register().data)
