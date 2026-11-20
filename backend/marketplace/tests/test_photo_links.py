from datetime import timedelta
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from marketplace.tests.helpers import sign_up
from marketplace.models import Booking, BraidStyle


def jpeg():
    buf = BytesIO()
    Image.new("RGB", (80, 60), (200, 160, 100)).save(buf, "JPEG")
    return SimpleUploadedFile("a.jpg", buf.getvalue(), content_type="image/jpeg")


@override_settings(USE_CLOUDINARY=False)
class PhotoLinkTests(APITestCase):
    def setUp(self):
        self.style = BraidStyle.objects.create(name="box braids")

    def register(self, name, role):
        sign_up(self.client, name, role)

    def upload(self, kind):
        r = self.client.post("/api/photos/", {"image": jpeg(), "kind": kind}, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        return r.data["url"]

    def test_profile_and_listing_photo_must_be_own_upload(self):
        self.register("erica", "braider")
        url = self.upload("profile")
        r = self.client.patch("/api/braiders/me/", {"photo_url": url}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["photo_url"], url)
        bad = self.client.patch("/api/braiders/me/", {"photo_url": "http://evil.example/x.jpg"}, format="json")
        self.assertEqual(bad.status_code, 400)
        l = self.client.post("/api/listings/", {"style": self.style.id, "title": "Box", "price": "90", "duration_minutes": 200, "photo_url": url}, format="json")
        self.assertEqual(l.status_code, 201, l.content)
        self.assertEqual(l.data["photo_url"], url)

    def test_cannot_use_someone_elses_photo(self):
        self.register("persis", "braider")
        url = self.upload("profile")
        self.client.credentials()
        self.register("winifred", "braider")
        r = self.client.patch("/api/braiders/me/", {"photo_url": url}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_review_with_photos(self):
        self.register("b", "braider")
        listing = self.client.post("/api/listings/", {"style": self.style.id, "title": "Box", "price": "90", "duration_minutes": 120}, format="json").data["id"]
        self.client.credentials()
        self.register("c", "client")
        day = timezone.localdate() + timedelta(days=3)
        bid = self.client.post("/api/bookings/", {"listing": listing, "date": str(day), "start_time": "10:00"}, format="json").data["id"]
        Booking.objects.filter(pk=bid).update(status="completed")
        p1, p2 = self.upload("review"), self.upload("review")
        r = self.client.post(f"/api/bookings/{bid}/review/", {"rating": 5, "comment": "Great", "photo_urls": [p1, p2]}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["photo_urls"], [p1, p2])

    def test_review_rejects_foreign_or_too_many_photos(self):
        self.register("b", "braider")
        listing = self.client.post("/api/listings/", {"style": self.style.id, "title": "Box", "price": "90", "duration_minutes": 120}, format="json").data["id"]
        self.client.credentials()
        self.register("c", "client")
        day = timezone.localdate() + timedelta(days=3)
        bid = self.client.post("/api/bookings/", {"listing": listing, "date": str(day), "start_time": "10:00"}, format="json").data["id"]
        Booking.objects.filter(pk=bid).update(status="completed")
        r = self.client.post(f"/api/bookings/{bid}/review/", {"rating": 5, "photo_urls": ["http://x/y.jpg"]}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"/api/bookings/{bid}/review/", {"rating": 5, "photo_urls": ["a"] * 5}, format="json")
        self.assertEqual(r.status_code, 400)


class SeedStylesTests(APITestCase):
    def test_idempotent(self):
        call_command("seed_styles")
        n = BraidStyle.objects.count()
        call_command("seed_styles")
        self.assertEqual(BraidStyle.objects.count(), n)
        self.assertTrue(BraidStyle.objects.filter(name="boho braids").exists())
