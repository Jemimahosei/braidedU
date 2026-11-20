import io
import shutil
import tempfile
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from marketplace.models import Photo


def image_bytes(fmt="JPEG", size=(120, 90)):
    buf = io.BytesIO()
    Image.new("RGB", size, (60, 107, 87)).save(buf, fmt)
    return buf.getvalue()


class PhotoUploadTests(APITestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media, USE_CLOUDINARY=False)
        self.override.enable()
        self.user = User.objects.create_user("erica", password="pw-12345")
        self.other = User.objects.create_user("persis", password="pw-12345")
        self.client.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=self.user).key)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)

    def post(self, data, name="a.jpg", ctype="image/jpeg", **extra):
        f = SimpleUploadedFile(name, data, content_type=ctype)
        return self.client.post("/api/photos/", {"image": f, **extra}, format="multipart")

    def test_upload_saves_and_returns_urls(self):
        r = self.post(image_bytes(), kind="profile")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["kind"], "profile")
        self.assertEqual((r.data["width"], r.data["height"]), (120, 90))
        self.assertTrue(r.data["url"].startswith("http"))
        self.assertEqual(Photo.objects.filter(owner=self.user).count(), 1)

    def test_requires_login(self):
        self.client.credentials()
        self.assertEqual(self.post(image_bytes()).status_code, 401)

    def test_rejects_non_image(self):
        r = self.post(b"not an image at all", name="a.jpg")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Photo.objects.count(), 0)

    def test_rejects_unknown_kind(self):
        self.assertEqual(self.post(image_bytes(), kind="banner").status_code, 400)

    @override_settings(MAX_UPLOAD_BYTES=100)
    def test_rejects_big_file(self):
        r = self.post(image_bytes(size=(400, 400)))
        self.assertEqual(r.status_code, 400)
        self.assertIn("10 MB", str(r.data))

    def test_missing_file(self):
        self.assertEqual(self.client.post("/api/photos/", {}, format="multipart").status_code, 400)

    def test_delete_own_photo(self):
        pid = self.post(image_bytes()).data["id"]
        self.assertEqual(self.client.delete(f"/api/photos/{pid}/").status_code, 204)
        self.assertFalse(Photo.objects.filter(pk=pid).exists())

    def test_cannot_delete_someone_elses_photo(self):
        p = Photo.objects.create(owner=self.other, kind="work", url="http://x/y.jpg")
        self.assertEqual(self.client.delete(f"/api/photos/{p.id}/").status_code, 403)
        self.assertTrue(Photo.objects.filter(pk=p.id).exists())


class CloudinaryRoutingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("jem", password="pw-12345")
        self.client.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=self.user).key)

    @override_settings(USE_CLOUDINARY=True, CLOUDINARY_CLOUD_NAME="demo", CLOUDINARY_API_KEY="k", CLOUDINARY_API_SECRET="s")
    def test_uses_cloudinary_when_configured(self):
        fake = {"secure_url": "https://res.cloudinary.com/demo/image/upload/v1/braidedu/work/x.jpg", "public_id": "braidedu/work/x"}
        with mock.patch("cloudinary.uploader.upload", return_value=fake) as up, mock.patch("cloudinary.uploader.destroy") as de:
            f = SimpleUploadedFile("a.jpg", image_bytes(), content_type="image/jpeg")
            r = self.client.post("/api/photos/", {"image": f, "kind": "work"}, format="multipart")
            self.assertEqual(r.status_code, 201, r.content)
            up.assert_called_once()
            self.assertEqual(up.call_args.kwargs["folder"], "braidedu/work")
            self.assertIn("f_auto,q_auto,w_480", r.data["thumb_url"])
            self.client.delete(f"/api/photos/{r.data['id']}/")
            de.assert_called_once()
            self.assertEqual(de.call_args.args[0], "braidedu/work/x")
