"""Add the six launch braiders shown in the design mockup.

These are placeholder profiles for friends of the site's owner, so the
browse page is not empty before real braiders sign up. Each is flagged
``is_demo`` so the site badges her "Demo profile". The accounts have no
usable password, so nobody can sign in as them. Prices, hours, areas and
Instagram handles are stand-ins; photos are left blank until each braider
uploads her own.

Safe to run on every deploy: it makes what is missing and never changes
a profile once a braider has edited it.
"""

from datetime import time

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from marketplace.management.commands.seed_styles import STYLES
from marketplace.models import BraiderProfile, BraidStyle, Listing

# name, area, days, (price, minutes) per style as {style: (price, minutes)}
FRIENDS = [
    ("Richlove", "north", ["fri", "sat", "sun"],
     {"loc retwist": (60, 120), "wash and go": (40, 90), "cornrows": (45, 90)}),
    ("Erica", "collegetown", ["thu", "fri", "sat"],
     {"box braids": (80, 210), "cornrows": (45, 90), "boho braids": (110, 270)}),
    ("Vassou", "west", ["sat", "sun"],
     {"bob braids": (70, 150), "crochet": (55, 120)}),
    ("Persis", "north", ["wed", "sat", "sun"],
     {"faux locs": (95, 240), "twists": (65, 180)}),
    ("Winifred", "south", ["fri", "sat"],
     {"cornrows": (45, 90), "box braids": (80, 210), "boho braids": (110, 270),
      "fulani braids": (75, 180)}),
    ("Jemimah", "north", ["sat", "sun"],
     {"weaves": (90, 180), "extensions": (60, 120), "ponytails": (40, 75), "curling": (30, 60)}),
]


@transaction.atomic
def seed():
    descriptions = {name: (desc, mins) for name, desc, mins in STYLES}
    made = 0
    for name, area, days, offers in FRIENDS:
        user, new_user = User.objects.get_or_create(
            username=f"friend.{name.lower()}", defaults={"is_active": True}
        )
        if new_user:
            user.set_unusable_password()
            user.save()
        profile, new_profile = BraiderProfile.objects.get_or_create(user=user)
        if new_profile:
            made += 1
            profile.display_name = name
            profile.bio = f"{name} braids from her place on campus. Message her to book."
            profile.campus_area = area
            profile.available_days = days
            profile.available_start_time = time(10, 0)
            profile.available_end_time = time(18, 0)
            profile.is_active = True
            profile.is_demo = True
            profile.save()
        for style_name, (price, minutes) in offers.items():
            desc, _typical = descriptions[style_name]
            style, _ = BraidStyle.objects.get_or_create(
                name=style_name,
                defaults={"description": desc, "typical_duration_minutes": _typical},
            )
            if new_profile:
                Listing.objects.get_or_create(
                    braider=profile, style=style, title=style_name.capitalize(),
                    defaults={"description": desc, "price": price,
                              "duration_minutes": minutes, "is_active": True},
                )
    return made


class Command(BaseCommand):
    help = "Add the six mockup braiders as demo profiles (idempotent)."

    def handle(self, *args, **options):
        self.stdout.write(f"Friend profiles ready ({seed()} new).")
