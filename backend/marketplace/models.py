"""Core models for braidedU — a braiding-services marketplace for Black
women on campus.

Two sides, synced through bookings:
- BraiderProfile: a student braider offering braid styles as listings.
- ClientProfile: a client looking for a braider.

A braider publishes one Listing per style offering (style + price +
duration). A client books a listing for a date/time; the braider accepts
or declines; after a completed booking the client may leave one Review.

Seed/demo accounts are flagged ``is_demo`` on the braider profile so the
frontend can badge them "Demo profile". No real people are seeded.
"""

from django.contrib.auth.models import User
from django.db import models

ROLE_CHOICES = [
    ("braider", "Braider"),
    ("client", "Client"),
]

BOOKING_STATUS_CHOICES = [
    ("requested", "Requested"),
    ("accepted", "Accepted"),
    ("paid", "Client says paid"),
    ("confirmed", "Payment received"),
    ("declined", "Declined"),
    ("completed", "Completed"),
    ("cancelled", "Cancelled"),
]

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

CAMPUS_AREAS = [
    ("north", "North Campus"),
    ("west", "West Campus"),
    ("south", "South Campus"),
    ("collegetown", "Collegetown"),
    ("east", "East Campus"),
    ("off_campus", "Off Campus"),
]


class BraidStyle(models.Model):
    """A braid style clients can search for, e.g. 'knotless braids'."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    typical_duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class BraiderProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="braider_profile")
    display_name = models.CharField(max_length=120, blank=True)
    bio = models.TextField(blank=True)
    campus_area = models.CharField(max_length=20, choices=CAMPUS_AREAS, blank=True)
    # Free-text detail, e.g. a dorm or building clients should meet at.
    location_detail = models.CharField(max_length=160, blank=True)
    instagram = models.CharField(max_length=120, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    years_experience = models.PositiveIntegerField(default=0)
    # e.g. ["fri", "sat", "sun"] plus an optional daily window.
    available_days = models.JSONField(default=list, blank=True)
    available_start_time = models.TimeField(null=True, blank=True)
    available_end_time = models.TimeField(null=True, blank=True)
    # Where she braids: any of "my_place", "client_place", "campus_space".
    service_places = models.JSONField(default=list, blank=True)
    # Street address of her place. Never in public output; clients see it only
    # once she has accepted their booking.
    private_address = models.CharField(max_length=200, blank=True)
    # Her rules.
    cancel_window_hours = models.PositiveIntegerField(default=24)
    deposit_note = models.CharField(max_length=200, blank=True)
    policy_text = models.TextField(blank=True)
    reminders_enabled = models.BooleanField(default=True)
    # Rest time kept between two appointments.
    buffer_minutes = models.PositiveIntegerField(default=15)
    # How clients pay her. Shown to a client only once she accepts the booking.
    venmo_handle = models.CharField(max_length=80, blank=True)
    zelle_contact = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)
    # True for seeded demo accounts; the frontend badges these "Demo profile".
    is_demo = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["display_name"]

    def __str__(self):
        return self.display_name or self.user.username

    @property
    def role(self):
        return "braider"

    @property
    def average_rating(self):
        from django.db.models import Avg

        result = self.reviews.aggregate(avg=Avg("rating"))["avg"]
        return round(result, 1) if result is not None else None

    @property
    def review_count(self):
        return self.reviews.count()


class ClientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="client_profile")
    display_name = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name or self.user.username

    @property
    def role(self):
        return "client"


class Listing(models.Model):
    """One braider's offering of one style: price + how long it takes."""

    braider = models.ForeignKey(BraiderProfile, on_delete=models.CASCADE, related_name="listings")
    style = models.ForeignKey(BraidStyle, on_delete=models.CASCADE, related_name="listings")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    duration_minutes = models.PositiveIntegerField()
    photo_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    # Days this style is offered, e.g. ["mon", "tue", "wed", "thu", "fri"].
    # Empty means it follows the braider's own days.
    available_days = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["price", "-created_at"]

    def __str__(self):
        return f"{self.title} — {self.braider} (${self.price})"


class Booking(models.Model):
    client = models.ForeignKey(ClientProfile, on_delete=models.CASCADE, related_name="bookings")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="bookings")
    braider = models.ForeignKey(BraiderProfile, on_delete=models.CASCADE, related_name="bookings")
    date = models.DateField()
    start_time = models.TimeField()
    status = models.CharField(max_length=20, choices=BOOKING_STATUS_CHOICES, default="requested")
    notes = models.TextField(blank=True)
    # Which of her places this booking is at (see BraiderProfile.service_places).
    place = models.CharField(max_length=20, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
    payment_screenshot_url = models.CharField(max_length=500, blank=True)
    cancelled_by = models.CharField(max_length=10, blank=True)
    cancel_reason = models.CharField(max_length=300, blank=True)
    # Cancelled by the client inside the braider's cancel window.
    late_cancel = models.BooleanField(default=False)
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.client} -> {self.listing} on {self.date} ({self.status})"

    @property
    def duration_minutes(self):
        return self.listing.duration_minutes

    @property
    def price(self):
        return self.listing.price


class Review(models.Model):
    """One review per completed booking, left by the client."""

    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="review")
    client = models.ForeignKey(ClientProfile, on_delete=models.CASCADE, related_name="reviews_given")
    braider = models.ForeignKey(BraiderProfile, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    photo_urls = models.JSONField(default=list, blank=True)
    # The braider's one public answer to this review.
    braider_reply = models.TextField(blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rating}/5 for {self.braider} by {self.client}"


PHOTO_KIND_CHOICES = [
    ("profile", "Profile photo"),
    ("work", "Style photo"),
    ("review", "Review photo"),
    ("message", "Message photo"),
    ("reference", "Custom request reference"),
]


class Photo(models.Model):
    """An uploaded image. Only the link is stored here; the file itself
    lives in Cloudinary (or local disk in development)."""

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="photos")
    kind = models.CharField(max_length=12, choices=PHOTO_KIND_CHOICES, default="work")
    url = models.URLField(max_length=500)
    # Cloudinary public id, or the local file name; used to delete the file.
    storage_key = models.CharField(max_length=300, blank=True)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} photo by {self.owner}"


class TimeOff(models.Model):
    """A stretch of days a braider is not taking appointments."""

    braider = models.ForeignKey(BraiderProfile, on_delete=models.CASCADE, related_name="time_off")
    start_date = models.DateField()
    end_date = models.DateField()
    note = models.CharField(max_length=160, blank=True)

    class Meta:
        ordering = ["start_date"]

    def __str__(self):
        return f"{self.braider} off {self.start_date} to {self.end_date}"


class Message(models.Model):
    """A note between two people. Saved here; the recipient also gets an email."""

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="messages_sent")
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="messages_received")
    body = models.TextField(max_length=2000)
    photo_url = models.CharField(max_length=500, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class Block(models.Model):
    """blocker does not want to hear from, or book with, blocked."""

    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("blocker", "blocked")]


REPORT_REASONS = [
    ("harassment", "Harassment or unsafe behavior"),
    ("no_show", "No-show or repeated cancelling"),
    ("scam", "Scam or payment problem"),
    ("fake", "Fake profile or photos"),
    ("other", "Something else"),
]


class Report(models.Model):
    """A report about a person. Read by the site owner in the Django admin."""

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reports_made")
    reported = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reports_received")
    reason = models.CharField(max_length=20, choices=REPORT_REASONS)
    detail = models.TextField(blank=True, max_length=2000)
    handled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
