"""One login, both sides: a signed-in client can add a braider profile
("List your chair") and then use both sides of the product.

Covers POST /api/auth/become-braider/ and the dual-profile role checks:
the braider pages work, the client pages keep working, and a second
add is rejected.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from marketplace.models import BraidStyle
from marketplace.tests.helpers import sign_up


class DualRoleTests(APITestCase):
    def setUp(self):
        self.style = BraidStyle.objects.create(name="box braids")

    def _auth(self, username, role):
        session = sign_up(self.client, username, role)
        return session["token"]

    def _next_saturday(self):
        today = timezone.localdate()
        return today + timedelta(days=(5 - today.weekday()) % 7 or 7)

    def _as(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

    def _make_listing(self, token, price="65.00"):
        """As the token's braider, publish one box-braids listing. Returns its id."""
        self._as(token)
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Box braids", "price": price,
             "duration_minutes": 120},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.data["id"]

    def test_client_can_become_braider_and_keep_client_access(self):
        dual_token = self._auth("dual", "client")

        # No braider profile yet: the braider endpoints say so.
        self._as(dual_token)
        self.assertEqual(self.client.get("/api/braiders/me/").status_code, 404)
        self.assertEqual(self.client.get("/api/my-listings/").status_code, 404)

        # Add the braider side. The name starts from the client display name.
        response = self.client.post("/api/auth/become-braider/", {}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["display_name"], "dual")

        # A second add is rejected.
        response = self.client.post("/api/auth/become-braider/", {}, format="json")
        self.assertEqual(response.status_code, 409, response.content)

        # Both profiles now exist; /me/ says so.
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["roles"], ["braider", "client"])
        self.assertEqual(response.data["role"], "braider")
        self.assertIsNotNone(response.data["braider_profile_id"])
        self.assertIsNotNone(response.data["client_profile_id"])
        self.assertEqual(self.client.get("/api/braiders/me/").status_code, 200)
        self.assertEqual(self.client.get("/api/clients/me/").status_code, 200)

        # The braider side works: publish a listing.
        self._make_listing(dual_token)
        self.assertEqual(len(self.client.get("/api/my-listings/").data), 1)

        # The client side still works: book another braider.
        other_token = self._auth("other", "braider")
        other_listing = self._make_listing(other_token, price="70.00")
        self._as(dual_token)
        response = self.client.post(
            "/api/bookings/",
            {"listing": other_listing, "date": str(self._next_saturday()),
             "start_time": "10:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(len(self.client.get("/api/bookings/").data), 1)

    def test_dual_user_sees_both_sides_of_bookings_and_can_act_on_both(self):
        dual_token = self._auth("dual", "client")
        self._as(dual_token)
        self.client.post("/api/auth/become-braider/", {}, format="json")
        # A brand-new braider has no hours yet; set them like the
        # Availability page does, so the chair can actually be booked.
        self.client.patch(
            "/api/braiders/me/",
            {"available_days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
             "available_start_time": "08:00", "available_end_time": "20:00"},
            format="json",
        )
        own_listing = self._make_listing(dual_token)

        # Another client books the dual user's chair.
        client_token = self._auth("client1", "client")
        self._as(client_token)
        response = self.client.post(
            "/api/bookings/",
            {"listing": own_listing, "date": str(self._next_saturday()),
             "start_time": "10:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        as_braider_booking = response.data["id"]

        # The dual user also books a second braider, as a client.
        other_token = self._auth("other", "braider")
        other_listing = self._make_listing(other_token, price="70.00")
        self._as(dual_token)
        response = self.client.post(
            "/api/bookings/",
            {"listing": other_listing, "date": str(self._next_saturday()),
             "start_time": "12:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        as_client_booking = response.data["id"]

        # One bookings list holds both sides.
        seen = {b["id"] for b in self.client.get("/api/bookings/").data}
        self.assertEqual(seen, {as_braider_booking, as_client_booking})
        self.assertEqual(self.client.get(f"/api/bookings/{as_braider_booking}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/bookings/{as_client_booking}/").status_code, 200)

        # Act as the braider on one, as the client on the other.
        response = self.client.post(f"/api/bookings/{as_braider_booking}/accept/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["status"], "accepted")
        self._as(other_token)
        self.assertEqual(
            self.client.post(f"/api/bookings/{as_client_booking}/accept/").status_code, 200
        )
        self._as(dual_token)
        response = self.client.post(f"/api/bookings/{as_client_booking}/paid/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["status"], "paid")

    def test_cannot_book_own_listing(self):
        dual_token = self._auth("dual", "client")
        self._as(dual_token)
        self.client.post("/api/auth/become-braider/", {}, format="json")
        own_listing = self._make_listing(dual_token)
        response = self.client.post(
            "/api/bookings/",
            {"listing": own_listing, "date": str(self._next_saturday()),
             "start_time": "10:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn("own chair", response.data["detail"])

    def test_client_without_braider_profile_cannot_use_braider_pages(self):
        self._auth("plain", "client")
        self.assertEqual(self.client.get("/api/braiders/me/").status_code, 404)
        self.assertEqual(self.client.get("/api/my-listings/").status_code, 404)
        self.assertEqual(self.client.get("/api/braiders/me/time-off/").status_code, 403)
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Box braids", "price": "65.00",
             "duration_minutes": 120},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)
        # But the client side works.
        self.assertEqual(self.client.get("/api/clients/me/").status_code, 200)
        self.assertEqual(self.client.get("/api/bookings/").status_code, 200)

    def test_braider_only_user_is_unchanged(self):
        token = self._auth("solo", "braider")
        self._as(token)
        response = self.client.post("/api/auth/become-braider/", {}, format="json")
        self.assertEqual(response.status_code, 409, response.content)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.data["roles"], ["braider"])
        self.assertIsNone(response.data["client_profile_id"])
        self.assertEqual(self.client.get("/api/clients/me/").status_code, 404)
