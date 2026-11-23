from django.core.management import call_command
from rest_framework.test import APITestCase

from marketplace.models import BraiderProfile, Listing


class SeedFriendsTests(APITestCase):
    def test_creates_five_demo_braiders_with_their_styles(self):
        call_command("seed_friends")
        self.assertEqual(BraiderProfile.objects.filter(is_demo=True).count(), 5)
        erica = BraiderProfile.objects.get(display_name="Erica")
        self.assertEqual(
            set(erica.listings.values_list("style__name", flat=True)),
            {"box braids", "cornrows", "boho braids"},
        )
        self.assertFalse(erica.user.has_usable_password())

    def test_is_idempotent_and_keeps_edits(self):
        call_command("seed_friends")
        BraiderProfile.objects.filter(display_name="Persis").update(bio="Mine now.")
        before = Listing.objects.count()
        call_command("seed_friends")
        self.assertEqual(Listing.objects.count(), before)
        self.assertEqual(BraiderProfile.objects.get(display_name="Persis").bio, "Mine now.")

    def test_they_show_up_when_browsing(self):
        call_command("seed_friends")
        r = self.client.get("/api/braiders/?style=faux%20locs")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([b["display_name"] for b in r.data["results"]], ["Persis"])

    def test_vassou_gets_her_photo_without_overwriting_a_new_one(self):
        call_command("seed_friends")
        self.assertEqual(BraiderProfile.objects.get(display_name="Vassou").photo_url, "/people/vassou.jpg")
        BraiderProfile.objects.filter(display_name="Vassou").update(photo_url="https://x/y.jpg")
        call_command("seed_friends")
        self.assertEqual(BraiderProfile.objects.get(display_name="Vassou").photo_url, "https://x/y.jpg")

    def test_jemimah_is_not_seeded_and_an_old_stand_in_is_removed(self):
        from django.contrib.auth.models import User

        User.objects.create(username="friend.jemimah")
        call_command("seed_friends")
        self.assertFalse(User.objects.filter(username="friend.jemimah").exists())
        self.assertFalse(BraiderProfile.objects.filter(display_name="Jemimah").exists())

    def test_a_real_erica_without_styles_becomes_vassou(self):
        from django.contrib.auth.models import User

        real = User.objects.create(username="someone@cornell.edu")
        BraiderProfile.objects.create(user=real, display_name="Erica")
        call_command("seed_friends")
        self.assertEqual(BraiderProfile.objects.get(user=real).display_name, "Vassou")
        self.assertEqual(BraiderProfile.objects.filter(display_name="Vassou").count(), 1)
        self.assertEqual(BraiderProfile.objects.filter(display_name="Erica").count(), 1)
        self.assertEqual(BraiderProfile.objects.get(user=real).photo_url, "/people/vassou.jpg")
