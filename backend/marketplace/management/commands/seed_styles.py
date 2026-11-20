"""Create the list of braid styles clients can search by.

Safe to run on every deploy: existing styles are left alone. This seeds
styles only. There are no demo braiders or demo accounts; every braider on
the site is a real person who signed up (or was set up with her consent).
"""

from django.core.management.base import BaseCommand

from marketplace.models import BraidStyle

STYLES = [
    ("box braids", "The classic. Square parts, endless length options.", 210),
    ("knotless braids", "Feed-in braids with no knot at the root, lighter on the scalp.", 240),
    ("cornrows", "Close-to-the-scalp rows, straight back or patterned.", 90),
    ("boho braids", "Braids with loose, curly pieces woven through.", 270),
    ("fulani braids", "Cornrows with a centre braid, beads and cuffs.", 180),
    ("faux locs", "Locs look without the commitment.", 240),
    ("twists", "Two-strand or passion twists, a protective staple.", 180),
    ("bob braids", "Chin-length braids, light and quick to wear.", 150),
    ("crochet", "Pre-made hair looped in on cornrows. Fast, full, easy to change.", 120),
    ("loc retwist", "Maintenance for locs: fresh roots and a neat finish.", 120),
    ("wash and go", "Wash, define and style natural curls.", 90),
    ("weaves", "Sew-in or install with bundles and closures.", 180),
    ("extensions", "Added length or volume with clip-ins or tape-ins.", 120),
    ("ponytails", "Sleek or curly ponytails with added hair.", 75),
    ("curling", "Curl styling for natural hair or extensions.", 60),
]


class Command(BaseCommand):
    help = "Create the searchable list of braid styles (idempotent)."

    def handle(self, *args, **options):
        made = 0
        for name, description, minutes in STYLES:
            _, created = BraidStyle.objects.get_or_create(
                name=name,
                defaults={"description": description, "typical_duration_minutes": minutes},
            )
            made += created
        self.stdout.write(f"Styles ready ({made} new, {len(STYLES) - made} already there).")
