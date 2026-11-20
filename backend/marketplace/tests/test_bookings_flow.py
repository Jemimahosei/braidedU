from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from marketplace.models import Booking, BraidStyle
from marketplace.tests.helpers import sign_up


def login(client, name):
    token = Token.objects.get(user__username=f"{name}@cornell.edu")
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


class BookingFlowTests(APITestCase):
    def setUp(self):
        style = BraidStyle.objects.create(name="box braids")
        self.braider = sign_up(self.client, "erica", "braider")
        r = self.client.patch(
            "/api/braiders/me/",
            {
                "available_start_time": "09:00", "available_end_time": "18:00",
                "service_places": ["my_place"], "private_address": "12 Eddy St",
                "venmo_handle": "@erica-braids", "zelle_contact": "erica@cornell.edu",
                "cancel_window_hours": 24, "deposit_note": "$20 to hold",
            },
            format="json",
        )
        assert r.status_code == 200, r.content
        self.listing = self.client.post(
            "/api/listings/", {"style": style.id, "title": "Box", "price": "90", "duration_minutes": 120}, format="json"
        ).data["id"]
        sign_up(self.client, "maya", "client")
        self.day = timezone.localdate() + timedelta(days=5)
        r = self.client.post(
            "/api/bookings/",
            {"listing": self.listing, "date": str(self.day), "start_time": "10:00", "place": "my_place"},
            format="json",
        )
        assert r.status_code == 201, r.content
        self.bid = r.data["id"]

    def act(self, who, action, data=None):
        login(self.client, who)
        return self.client.post(f"/api/bookings/{self.bid}/{action}/", data or {}, format="json")

    def view(self, who):
        login(self.client, who)
        return self.client.get(f"/api/bookings/{self.bid}/").data

    def test_payment_info_hidden_until_accepted(self):
        d = self.view("maya")
        self.assertNotIn("pay", d)
        self.assertNotIn("address", d)
        self.assertEqual(self.act("erica", "accept").status_code, 200)
        d = self.view("maya")
        self.assertEqual(d["pay"]["venmo"], "@erica-braids")
        self.assertEqual(d["address"], "12 Eddy St")

    def test_pay_confirm_receipt_complete(self):
        self.act("erica", "accept")
        self.assertEqual(self.act("maya", "receipt").status_code, 405)  # GET only
        login(self.client, "maya")
        self.assertEqual(self.client.get(f"/api/bookings/{self.bid}/receipt/").status_code, 404)
        self.assertEqual(self.act("maya", "paid").data["status"], "paid")
        self.assertEqual(self.act("erica", "payment-received").data["status"], "confirmed")
        login(self.client, "maya")
        r = self.client.get(f"/api/bookings/{self.bid}/receipt/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["amount"], "90.00")
        self.assertEqual(self.act("erica", "complete").data["status"], "completed")

    def test_client_cannot_confirm_own_payment(self):
        self.act("erica", "accept")
        self.assertEqual(self.act("maya", "payment-received").status_code, 403)

    def test_cannot_pay_before_accept(self):
        self.assertEqual(self.act("maya", "paid").status_code, 400)

    def test_free_vs_late_cancel(self):
        self.assertEqual(self.act("maya", "cancel").data["late_cancel"], False)
        Booking.objects.filter(pk=self.bid).update(status="accepted", date=timezone.localdate())
        r = self.act("maya", "cancel", {"reason": "sick"})
        self.assertTrue(r.data["late_cancel"])
        self.assertEqual(r.data["cancelled_by"], "client")

    def test_braider_cancel_records_reason(self):
        self.act("erica", "accept")
        r = self.act("erica", "braider-cancel", {"reason": "family emergency"})
        self.assertEqual(r.data["status"], "cancelled")
        self.assertEqual(r.data["cancelled_by"], "braider")
        self.assertEqual(r.data["cancel_reason"], "family emergency")

    def test_reschedule_needs_open_slot_and_resets_to_requested(self):
        self.act("erica", "accept")
        new_day = self.day + timedelta(days=1)
        bad = self.act("maya", "reschedule", {"date": str(new_day), "start_time": "03:00"})
        self.assertEqual(bad.status_code, 400)
        ok = self.act("maya", "reschedule", {"date": str(new_day), "start_time": "13:00"})
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertEqual(ok.data["status"], "requested")
        self.assertEqual(ok.data["date"], str(new_day))

    def test_reschedule_blocked_inside_window(self):
        Booking.objects.filter(pk=self.bid).update(status="accepted", date=timezone.localdate() + timedelta(days=0))
        r = self.act("maya", "reschedule", {"date": str(self.day), "start_time": "10:00"})
        self.assertEqual(r.status_code, 400)

    def test_place_must_be_one_she_offers(self):
        login(self.client, "maya")
        r = self.client.post(
            "/api/bookings/",
            {"listing": self.listing, "date": str(self.day), "start_time": "14:00", "place": "client_place"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_reminders_once_and_respect_toggle(self):
        tomorrow = timezone.localdate() + timedelta(days=1)
        Booking.objects.filter(pk=self.bid).update(status="accepted", date=tomorrow)
        out = StringIO()
        call_command("send_reminders", stdout=out)
        self.assertIn("sent: 1", out.getvalue())
        out = StringIO()
        call_command("send_reminders", stdout=out)
        self.assertIn("sent: 0", out.getvalue())
        Booking.objects.filter(pk=self.bid).update(reminder_sent=False)
        login(self.client, "erica")
        self.client.patch("/api/braiders/me/", {"reminders_enabled": False}, format="json")
        out = StringIO()
        call_command("send_reminders", stdout=out)
        self.assertIn("sent: 0", out.getvalue())

    def test_payment_handles_not_public(self):
        self.client.credentials()
        d = self.client.get(f"/api/braiders/{self.braider['profile_id']}/").data
        self.assertNotIn("venmo_handle", d)
        self.assertNotIn("zelle_contact", d)
