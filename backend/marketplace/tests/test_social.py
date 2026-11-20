from datetime import timedelta
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from marketplace.models import Booking, BraidStyle, Message, Report
from marketplace.tests.helpers import sign_up


def login(client, name):
    token = Token.objects.get(user__username=f"{name}@cornell.edu")
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


def jpeg():
    buf = BytesIO()
    Image.new("RGB", (80, 60), (200, 160, 100)).save(buf, "JPEG")
    return SimpleUploadedFile("a.jpg", buf.getvalue(), content_type="image/jpeg")


@override_settings(USE_CLOUDINARY=False)
class SocialTests(APITestCase):
    def setUp(self):
        self.style = BraidStyle.objects.create(name="box braids")
        self.erica = sign_up(self.client, "erica", "braider")
        self.listing = self.client.post(
            "/api/listings/", {"style": self.style.id, "title": "Box", "price": "90", "duration_minutes": 120}, format="json"
        ).data["id"]
        sign_up(self.client, "maya", "client")

    def uid(self, name):
        from django.contrib.auth.models import User

        return User.objects.get(username=f"{name}@cornell.edu").id

    def test_client_messages_braider_and_she_replies(self):
        login(self.client, "maya")
        r = self.client.post(f"/api/messages/{self.uid('erica')}/", {"body": "Do you do 3 hour sets?"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        login(self.client, "erica")
        convos = self.client.get("/api/messages/").data
        self.assertEqual(convos[0]["unread"], 1)
        self.assertEqual(self.client.get("/api/messages/unread/").data["unread"], 1)
        t = self.client.get(f"/api/messages/{self.uid('maya')}/").data
        self.assertEqual(len(t["messages"]), 1)
        self.assertTrue(t["can_reply"])
        self.assertEqual(self.client.get("/api/messages/unread/").data["unread"], 0)
        r = self.client.post(f"/api/messages/{self.uid('maya')}/", {"body": "Yes!"}, format="json")
        self.assertEqual(r.status_code, 201)

    def test_braider_cannot_cold_message_a_client(self):
        login(self.client, "erica")
        r = self.client.post(f"/api/messages/{self.uid('maya')}/", {"body": "hi"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_block_stops_messages_and_bookings(self):
        login(self.client, "erica")
        self.assertEqual(self.client.post(f"/api/blocks/{self.uid('maya')}/").status_code, 200)
        login(self.client, "maya")
        r = self.client.post(f"/api/messages/{self.uid('erica')}/", {"body": "hi"}, format="json")
        self.assertEqual(r.status_code, 403)
        day = timezone.localdate() + timedelta(days=3)
        r = self.client.post("/api/bookings/", {"listing": self.listing, "date": str(day), "start_time": "10:00"}, format="json")
        self.assertEqual(r.status_code, 403)
        login(self.client, "erica")
        self.client.delete(f"/api/blocks/{self.uid('maya')}/")
        login(self.client, "maya")
        r = self.client.post(f"/api/messages/{self.uid('erica')}/", {"body": "hi"}, format="json")
        self.assertEqual(r.status_code, 201)

    def test_report(self):
        login(self.client, "maya")
        r = self.client.post("/api/reports/", {"user_id": self.uid("erica"), "reason": "nope"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/reports/", {"user_id": self.uid("erica"), "reason": "no_show", "detail": "x"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Report.objects.count(), 1)

    def test_only_reviewed_braider_can_reply(self):
        login(self.client, "maya")
        day = timezone.localdate() + timedelta(days=3)
        bid = self.client.post("/api/bookings/", {"listing": self.listing, "date": str(day), "start_time": "10:00"}, format="json").data["id"]
        Booking.objects.filter(pk=bid).update(status="completed")
        rid = self.client.post(f"/api/bookings/{bid}/review/", {"rating": 5, "comment": "Great"}, format="json").data["id"]
        r = self.client.post(f"/api/reviews/{rid}/reply/", {"reply": "thanks"}, format="json")
        self.assertEqual(r.status_code, 403)
        login(self.client, "erica")
        r = self.client.post(f"/api/reviews/{rid}/reply/", {"reply": "Thank you Maya!"}, format="json")
        self.assertEqual(r.status_code, 200)
        public = self.client.get(f"/api/braiders/{self.erica['profile_id']}/reviews/").data
        self.assertEqual(public[0]["braider_reply"], "Thank you Maya!")

    def test_remove_all_my_photos(self):
        login(self.client, "erica")
        url = self.client.post("/api/photos/", {"image": jpeg(), "kind": "profile"}, format="multipart").data["url"]
        self.client.patch("/api/braiders/me/", {"photo_url": url}, format="json")
        r = self.client.delete("/api/photos/mine/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["removed"], 1)
        self.assertEqual(self.client.get("/api/braiders/me/").data["photo_url"], "")

    def test_message_photo_must_be_own(self):
        login(self.client, "erica")
        url = self.client.post("/api/photos/", {"image": jpeg(), "kind": "message"}, format="multipart").data["url"]
        login(self.client, "maya")
        r = self.client.post(f"/api/messages/{self.uid('erica')}/", {"body": "", "photo_url": url}, format="json")
        self.assertEqual(r.status_code, 400)
