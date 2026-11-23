from django.core.management import call_command
from rest_framework.test import APITestCase

from marketplace.models import BraiderProfile, Listing


class SeedFriendsTests(APITestCase):
    def test_creates_six_demo_braiders_with_their_styles(self):
        call_command("seed_friends")
        self.assertEqual(BraiderProfile.objects.filter(is_demo=True).count(), 6)
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
