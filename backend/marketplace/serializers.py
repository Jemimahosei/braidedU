from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    CAMPUS_AREAS,
    WEEKDAYS,
    Booking,
    BraiderProfile,
    BraidStyle,
    ClientProfile,
    Listing,
    Photo,
    TimeOff,
    Review,
)


def own_photo_url(request, value):
    """A photo link is only accepted if this user uploaded it."""
    if not value:
        return value
    user = getattr(request, "user", None)
    if not user or not Photo.objects.filter(owner=user, url=value).exists():
        raise serializers.ValidationError("Upload the photo first, then use its link.")
    return value


class BraidStyleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BraidStyle
        fields = ["id", "name", "description", "typical_duration_minutes"]


class ListingSerializer(serializers.ModelSerializer):
    braider_name = serializers.CharField(source="braider.display_name", read_only=True)
    braider_id = serializers.IntegerField(source="braider.id", read_only=True)
    braider_is_demo = serializers.BooleanField(source="braider.is_demo", read_only=True)
    campus_area = serializers.CharField(source="braider.campus_area", read_only=True)
    style_name = serializers.CharField(source="style.name", read_only=True)
    photo_url = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Listing
        fields = [
            "id", "braider", "braider_id", "braider_name", "braider_is_demo",
            "campus_area", "style", "style_name", "title", "description",
            "price", "duration_minutes", "photo_url", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["braider", "created_at", "updated_at"]

    def validate_photo_url(self, value):
        return own_photo_url(self.context.get("request"), value)


class ReviewSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.display_name", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "booking", "client_name", "rating", "comment", "photo_urls", "created_at"]
        read_only_fields = ["booking", "created_at"]


SERVICE_PLACES = {"my_place", "client_place", "campus_space"}


class TimeOffSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeOff
        fields = ["id", "start_date", "end_date", "note"]

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError("The last day cannot be before the first day.")
        return attrs


class BraiderProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    listings = ListingSerializer(many=True, read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    reviews = ReviewSerializer(many=True, read_only=True)
    photo_url = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = BraiderProfile
        fields = [
            "id", "username", "display_name", "bio", "campus_area",
            "location_detail", "instagram", "photo_url", "years_experience",
            "available_days", "available_start_time", "available_end_time",
            "service_places", "private_address", "cancel_window_hours",
            "deposit_note", "policy_text", "reminders_enabled", "buffer_minutes",
            "venmo_handle", "zelle_contact",
            "is_active", "is_demo", "average_rating", "review_count",
            "listings", "reviews", "created_at",
        ]
        read_only_fields = ["is_demo", "created_at"]

    def validate_available_days(self, value):
        bad = [day for day in value if day not in WEEKDAYS]
        if bad:
            raise serializers.ValidationError(f"Invalid weekdays: {bad}. Use {WEEKDAYS}.")
        return value

    def validate_photo_url(self, value):
        return own_photo_url(self.context.get("request"), value)

    def validate_service_places(self, value):
        bad = [p for p in value if p not in SERVICE_PLACES]
        if bad:
            raise serializers.ValidationError(f"Invalid places: {bad}. Use {sorted(SERVICE_PLACES)}.")
        return value

    def validate_cancel_window_hours(self, value):
        if value > 24 * 14:
            raise serializers.ValidationError("Use 14 days (336 hours) or less.")
        return value

    def validate_buffer_minutes(self, value):
        if value > 120:
            raise serializers.ValidationError("Use 120 minutes or less.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # The street address is for her eyes only (clients get it after accept).
        request = self.context.get("request")
        if not request or getattr(request.user, "pk", None) != instance.user_id:
            data.pop("private_address", None)
            # Payment handles reach a client only through an accepted booking.
            data.pop("venmo_handle", None)
            data.pop("zelle_contact", None)
        return data

    def validate_campus_area(self, value):
        if value and value not in dict(CAMPUS_AREAS):
            raise serializers.ValidationError(f"Unknown campus area: {value}.")
        return value


class ClientProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ClientProfile
        fields = ["id", "username", "display_name", "created_at"]
        read_only_fields = ["created_at"]


PAYMENT_VISIBLE = {"accepted", "paid", "confirmed", "completed"}


class BookingSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    style_name = serializers.CharField(source="listing.style.name", read_only=True)
    braider_name = serializers.CharField(source="braider.display_name", read_only=True)
    braider_id = serializers.IntegerField(source="braider.id", read_only=True)
    client_name = serializers.CharField(source="client.display_name", read_only=True)
    price = serializers.DecimalField(source="listing.price", max_digits=8, decimal_places=2, read_only=True)
    duration_minutes = serializers.IntegerField(source="listing.duration_minutes", read_only=True)
    end_time = serializers.SerializerMethodField()
    cancel_deadline = serializers.SerializerMethodField()
    cancel_window_hours = serializers.IntegerField(source="braider.cancel_window_hours", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "client", "client_name", "listing", "listing_title",
            "style_name", "braider", "braider_id", "braider_name", "price",
            "duration_minutes", "date", "start_time", "end_time", "status",
            "notes", "place", "paid_at", "payment_confirmed_at",
            "payment_screenshot_url", "cancelled_by", "cancel_reason",
            "late_cancel", "cancel_deadline", "cancel_window_hours",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "client", "braider", "status", "paid_at", "payment_confirmed_at",
            "payment_screenshot_url", "cancelled_by", "cancel_reason",
            "late_cancel", "created_at", "updated_at",
        ]

    def get_end_time(self, obj):
        from datetime import datetime, timedelta

        start = datetime.combine(obj.date, obj.start_time)
        return (start + timedelta(minutes=obj.listing.duration_minutes)).time().isoformat(timespec="minutes")

    def get_cancel_deadline(self, obj):
        return cancel_deadline(obj).isoformat()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Where to pay and where to go are shared only after she accepts.
        if instance.status in PAYMENT_VISIBLE:
            b = instance.braider
            data["pay"] = {
                "venmo": b.venmo_handle,
                "zelle": b.zelle_contact,
                "deposit_note": b.deposit_note,
            }
            data["address"] = b.private_address if instance.place in ("", "my_place") else ""
        return data


def cancel_deadline(booking):
    from datetime import datetime, timedelta

    from django.utils import timezone

    start = timezone.make_aware(datetime.combine(booking.date, booking.start_time))
    return start - timedelta(hours=booking.braider.cancel_window_hours)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=["braider", "client"])
    display_name = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if not value.endswith("@cornell.edu"):
            raise serializers.ValidationError("Use your @cornell.edu email address.")
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("That email already has an account. Try logging in.")
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        # The account stays inactive until the emailed link is opened.
        user = User.objects.create_user(
            username=email, email=email, password=validated_data["password"], is_active=False
        )
        display_name = validated_data.get("display_name") or email.split("@")[0]
        if validated_data["role"] == "braider":
            BraiderProfile.objects.create(user=user, display_name=display_name)
        else:
            ClientProfile.objects.create(user=user, display_name=display_name)
        return user
