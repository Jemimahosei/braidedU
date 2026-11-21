"""API tests: register -> listing -> booking -> accept -> complete -> review,
plus permission and validation guards."""

from datetime import timedelta

from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from marketplace.models import Booking, BraidStyle
from marketplace.tests.helpers import sign_up


class ApiFlowTests(APITestCase):
    def setUp(self):
        self.style = BraidStyle.objects.create(name="knotless braids")
        self.other_style = BraidStyle.objects.create(name="cornrows")

    def _auth(self, username, role):
        return sign_up(self.client, username, role)

    def _next_saturday(self):
        today = timezone.localdate()
        return today + timedelta(days=(5 - today.weekday()) % 7 or 7)

    def test_full_booking_flow(self):
        # Braider registers, completes profile, publishes a listing.
        self._auth("braider1", "braider")
        response = self.client.patch(
            "/api/braiders/me/",
            {"display_name": "B1", "campus_area": "north", "available_days": ["sat"],
             "years_experience": 2},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Knotless — mid-back",
             "price": "85.00", "duration_minutes": 240},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        listing_id = response.data["id"]

        # Client registers and requests the booking.
        self.client.credentials()
        self._auth("client1", "client")
        response = self.client.post(
            "/api/bookings/",
            {"listing": listing_id, "date": str(self._next_saturday()),
             "start_time": "11:00", "notes": "Mid-back please."},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["status"], "requested")
        booking_id = response.data["id"]

        # Client cannot review before completion.
        response = self.client.post(
            f"/api/bookings/{booking_id}/review/", {"rating": 5, "comment": "Too soon."},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        # Braider accepts, then completes.
        from rest_framework.authtoken.models import Token

        token = Token.objects.get(user__username="braider1@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        response = self.client.post(f"/api/bookings/{booking_id}/accept/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["status"], "accepted")
        response = self.client.post(f"/api/bookings/{booking_id}/complete/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["status"], "completed")

        # Client reviews the completed booking.
        token = Token.objects.get(user__username="client1@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        response = self.client.post(
            f"/api/bookings/{booking_id}/review/",
            {"rating": 5, "comment": "Neat parts, on time."},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        # The review carries its style and its author, for the profile page.
        self.assertEqual(response.data["style_name"], "knotless braids")
        self.assertEqual(response.data["client_user_id"], User.objects.get(username="client1@cornell.edu").id)
        # Second review for the same booking is rejected.
        response = self.client.post(
            f"/api/bookings/{booking_id}/review/", {"rating": 4},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_clients_cannot_create_listings_and_strangers_cannot_act(self):
        self._auth("braider2", "braider")
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Knotless", "price": "80.00",
             "duration_minutes": 200},
            format="json",
        )
        listing_id = response.data["id"]
        self.client.credentials()
        self._auth("client2", "client")
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Nope", "price": "10.00",
             "duration_minutes": 60},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        response = self.client.post(
            "/api/bookings/",
            {"listing": listing_id, "date": str(self._next_saturday()), "start_time": "10:00"},
            format="json",
        )
        booking_id = response.data["id"]
        # Another client cannot see or cancel it.
        self.client.credentials()
        self._auth("client3", "client")
        response = self.client.get(f"/api/bookings/{booking_id}/")
        self.assertEqual(response.status_code, 403)
        response = self.client.post(f"/api/bookings/{booking_id}/cancel/")
        self.assertEqual(response.status_code, 403)
        # Another braider cannot accept it.
        self.client.credentials()
        self._auth("braider3", "braider")
        response = self.client.post(f"/api/bookings/{booking_id}/accept/")
        self.assertEqual(response.status_code, 403)

    def test_past_date_rejected_and_double_booking_blocked(self):
        self._auth("braider4", "braider")
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Knotless", "price": "80.00",
             "duration_minutes": 240},
            format="json",
        )
        listing_id = response.data["id"]
        self.client.credentials()
        self._auth("client4", "client")
        yesterday = timezone.localdate() - timedelta(days=1)
        response = self.client.post(
            "/api/bookings/",
            {"listing": listing_id, "date": str(yesterday), "start_time": "10:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        saturday = str(self._next_saturday())
        response = self.client.post(
            "/api/bookings/",
            {"listing": listing_id, "date": saturday, "start_time": "10:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        booking_id = response.data["id"]
        # Accept it, then a second overlapping request must fail.
        from rest_framework.authtoken.models import Token

        token = Token.objects.get(user__username="braider4@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.client.post(f"/api/bookings/{booking_id}/accept/")
        token = Token.objects.get(user__username="client4@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        response = self.client.post(
            "/api/bookings/",
            {"listing": listing_id, "date": saturday, "start_time": "11:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_public_browsing_and_recommended(self):
        self._auth("braider5", "braider")
        self.client.patch(
            "/api/braiders/me/",
            {"display_name": "B5", "campus_area": "west", "available_days": ["sat"],
             "years_experience": 5},
            format="json",
        )
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Knotless", "price": "90.00",
             "duration_minutes": 240},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.client.credentials()
        response = self.client.get("/api/styles/")
        self.assertEqual(response.status_code, 200)
        response = self.client.get("/api/braiders/?style=knotless%20braids")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        response = self.client.get(
            f"/api/recommended/?style=knotless%20braids&date={self._next_saturday()}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["match_score"], 85)
        self.assertIn("match_breakdown", response.data[0])
        # No braider offers the other style yet.
        response = self.client.get("/api/recommended/?style=cornrows")
        self.assertEqual(response.data, [])
        self.assertEqual(Booking.objects.count(), 0)


class ListingDeleteTests(APITestCase):
    def setUp(self):
        self.style = BraidStyle.objects.create(name="twists")

    def _listing(self):
        response = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Twists", "price": "60.00", "duration_minutes": 120},
            format="json",
        )
        return response.data["id"]

    def test_owner_can_delete_an_unbooked_listing(self):
        sign_up(self.client, "del-braider", "braider")
        listing_id = self._listing()
        response = self.client.delete(f"/api/listings/{listing_id}/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get(f"/api/listings/{listing_id}/").status_code, 404)

    def test_others_cannot_delete_it(self):
        sign_up(self.client, "del-owner", "braider")
        listing_id = self._listing()
        self.client.credentials()
        sign_up(self.client, "del-other", "braider")
        self.assertEqual(self.client.delete(f"/api/listings/{listing_id}/").status_code, 403)
        self.client.credentials()
        self.assertIn(self.client.delete(f"/api/listings/{listing_id}/").status_code, (401, 403))

    def test_a_listing_with_bookings_cannot_be_deleted(self):
        sign_up(self.client, "del-booked", "braider")
        listing_id = self._listing()
        today = timezone.localdate()
        saturday = today + timedelta(days=(5 - today.weekday()) % 7 or 7)
        self.client.credentials()
        sign_up(self.client, "del-client", "client")
        self.client.post(
            "/api/bookings/", {"listing": listing_id, "date": str(saturday), "start_time": "10:00"}, format="json"
        )
        self.client.credentials()
        from rest_framework.authtoken.models import Token

        braider_token = Token.objects.get(user__username__startswith="del-booked")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {braider_token.key}")
        response = self.client.delete(f"/api/listings/{listing_id}/")
        self.assertEqual(response.status_code, 400)


class BookingBraiderPhotoTests(APITestCase):
    def test_booking_carries_the_braiders_public_photo_link(self):
        style = BraidStyle.objects.create(name="locs")
        sign_up(self.client, "ph-braider", "braider")
        self.client.patch("/api/braiders/me/", {"display_name": "Ph"}, format="json")
        listing = self.client.post(
            "/api/listings/", {"style": style.id, "title": "Locs", "price": "50.00", "duration_minutes": 60}, format="json"
        ).data["id"]
        self.client.credentials()
        sign_up(self.client, "ph-client", "client")
        today = timezone.localdate()
        saturday = today + timedelta(days=(5 - today.weekday()) % 7 or 7)
        made = self.client.post(
            "/api/bookings/", {"listing": listing, "date": str(saturday), "start_time": "10:00"}, format="json"
        )
        self.assertEqual(made.status_code, 201)
        self.assertIn("braider_photo_url", made.data)


class ThreadProfileLinkTests(APITestCase):
    def test_thread_with_a_braider_includes_her_profile_id(self):
        braider = sign_up(self.client, "tp-braider", "braider")
        self.client.credentials()
        sign_up(self.client, "tp-client", "client")
        response = self.client.get(f"/api/messages/{User.objects.get(username='tp-braider@cornell.edu').id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["profile_id"], braider["profile_id"])


class EmailStatusTests(APITestCase):
    def test_health_reports_email_mode_only(self):
        r = self.client.get("/api/health/")
        self.assertEqual(r.status_code, 200)
        self.assertIn(r.json()["email_mode"], ("smtp", "resend", "console"))
        self.assertEqual(set(r.json()), {"ok", "email_mode", "last_email_error", "database"})
