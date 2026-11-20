from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from marketplace.models import Booking, BraidStyle
from marketplace.tests.helpers import sign_up


class AvailabilityTests(APITestCase):
    def setUp(self):
        self.style = BraidStyle.objects.create(name="box braids")
        self.braider = sign_up(self.client, "erica", "braider")
        self.client.patch(
            "/api/braiders/me/",
            {"available_start_time": "10:00", "available_end_time": "16:00", "buffer_minutes": 30},
            format="json",
        )
        self.listing = self.client.post(
            "/api/listings/",
            {"style": self.style.id, "title": "Box", "price": "90", "duration_minutes": 120},
            format="json",
        ).data["id"]
        self.bid = self.braider["profile_id"]
        self.day = timezone.localdate() + timedelta(days=3)
        self.client.credentials()

    def slots(self, day=None):
        r = self.client.get(f"/api/braiders/{self.bid}/slots/", {"listing": self.listing, "date": str(day or self.day)})
        self.assertEqual(r.status_code, 200, r.content)
        return r.data["slots"]

    def test_slots_fit_inside_her_hours(self):
        s = self.slots()
        self.assertEqual(s[0], "10:00")
        self.assertEqual(s[-1], "14:00")  # a 2 hour style must end by 16:00
        self.assertNotIn("14:30", s)

    def test_day_off_and_time_off_have_no_slots(self):
        from rest_framework.authtoken.models import Token

        token = Token.objects.get(user__username="erica@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        r = self.client.post(
            "/api/braiders/me/time-off/",
            {"start_date": str(self.day), "end_date": str(self.day), "note": "exam"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.client.credentials()
        self.assertEqual(self.slots(), [])
        self.assertTrue(self.slots(self.day + timedelta(days=1)))

    def test_accepted_booking_blocks_with_rest_time(self):
        from rest_framework.authtoken.models import Token

        sign_up(self.client, "maya", "client")
        r = self.client.post("/api/bookings/", {"listing": self.listing, "date": str(self.day), "start_time": "10:00"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        token = Token.objects.get(user__username="erica@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.client.post(f"/api/bookings/{r.data['id']}/accept/")
        self.client.credentials()
        s = self.slots()
        # 10:00-12:00 plus 30 minutes rest: the next start is 12:30.
        self.assertNotIn("10:00", s)
        self.assertNotIn("12:00", s)
        self.assertEqual(s[0], "12:30")

    def test_cannot_book_a_closed_time(self):
        sign_up(self.client, "maya", "client")
        r = self.client.post("/api/bookings/", {"listing": self.listing, "date": str(self.day), "start_time": "07:00"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/bookings/", {"listing": self.listing, "date": str(self.day), "start_time": "15:00"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_private_address_is_hidden_from_everyone_but_her(self):
        from rest_framework.authtoken.models import Token

        token = Token.objects.get(user__username="erica@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        r = self.client.patch(
            "/api/braiders/me/",
            {"private_address": "12 Eddy St, Apt 3", "service_places": ["my_place", "campus_space"],
             "cancel_window_hours": 48, "policy_text": "No late arrivals past 20 min."},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["private_address"], "12 Eddy St, Apt 3")
        self.client.credentials()
        public = self.client.get(f"/api/braiders/{self.bid}/")
        self.assertNotIn("private_address", public.data)
        self.assertEqual(public.data["cancel_window_hours"], 48)
        self.assertEqual(self.client.get("/api/braiders/").content.count(b"Eddy"), 0)

    def test_bad_places_rejected(self):
        from rest_framework.authtoken.models import Token

        token = Token.objects.get(user__username="erica@cornell.edu")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        r = self.client.patch("/api/braiders/me/", {"service_places": ["the moon"]}, format="json")
        self.assertEqual(r.status_code, 400)
