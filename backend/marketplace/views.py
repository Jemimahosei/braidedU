"""API views for braidedU — braiding marketplace.

Auth is DRF token auth: register/login return a token the client stores
and sends as ``Authorization: Token <key>``.
"""

from datetime import date as date_cls
from datetime import datetime, timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from django.contrib.auth.models import User
from django.db import connection

from . import emails, matching
from .models import (
    Booking,
    BraiderProfile,
    BraidStyle,
    ClientProfile,
    Listing,
    Photo,
    Review,
    TimeOff,
)
from . import photos as photo_store
from .serializers import (
    cancel_deadline,
    own_photo_url,
    BookingSerializer,
    BraiderProfileSerializer,
    BraidStyleSerializer,
    ClientProfileSerializer,
    ListingSerializer,
    RegisterSerializer,
    TimeOffSerializer,
    ReviewSerializer,
)


def _role_and_profile(user):
    """Return (role, profile) for a user, or (None, None)."""
    if hasattr(user, "braider_profile"):
        return "braider", user.braider_profile
    if hasattr(user, "client_profile"):
        return "client", user.client_profile
    return None, None


# ---------------------------------------------------------------- auth


def _session(user):
    token, _ = Token.objects.get_or_create(user=user)
    role, profile = _role_and_profile(user)
    return {
        "token": token.key,
        "username": user.username,
        "role": role,
        "profile_id": profile.id if profile else None,
    }


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    sent = emails.send_confirmation(user)
    return Response(
        {
            "detail": "Check your Cornell email for a confirmation link.",
            "email": user.email,
            "email_sent": bool(sent),
            "email_mode": emails.email_mode(),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def confirm_email(request):
    user = emails.read_token(request.data.get("token", ""), "confirm", emails.CONFIRM_MAX_AGE)
    if user is None:
        return Response(
            {"detail": "That link is not valid any more. Ask for a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])
    return Response(_session(user))


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def resend_confirmation(request):
    email = str(request.data.get("email", "")).strip().lower()
    user = User.objects.filter(username=email, is_active=False).first()
    if user:
        emails.send_confirmation(user)
    # Same answer either way so this can't be used to find who has an account.
    return Response({"detail": "If that account is waiting for confirmation, we sent a new link."})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def password_reset(request):
    email = str(request.data.get("email", "")).strip().lower()
    user = User.objects.filter(username=email, is_active=True).first()
    if user:
        emails.send_reset(user)
    return Response({"detail": "If that email has an account, we sent a reset link."})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request):
    user = emails.read_token(request.data.get("token", ""), "reset", emails.RESET_MAX_AGE)
    password = str(request.data.get("password", ""))
    if user is None:
        return Response(
            {"detail": "That link is not valid any more. Ask for a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(password) < 8:
        return Response(
            {"detail": "Use a password of at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST
        )
    user.set_password(password)
    user.save(update_fields=["password"])
    Token.objects.filter(user=user).delete()  # sign out everywhere else
    return Response(_session(user))


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login(request):
    email = str(request.data.get("username") or request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    user = User.objects.filter(username=email).first()
    if user is None or not user.check_password(password):
        return Response({"detail": "Wrong email or password."}, status=status.HTTP_400_BAD_REQUEST)
    if not user.is_active:
        return Response(
            {"detail": "Confirm your email first. Check your inbox, or ask for a new link."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return Response(_session(user))


@api_view(["GET"])
def me(request):
    role, profile = _role_and_profile(request.user)
    data = {"username": request.user.username, "role": role, "profile_id": profile.id if profile else None}
    if role == "braider":
        data["profile"] = BraiderProfileSerializer(profile).data
    elif role == "client":
        data["profile"] = ClientProfileSerializer(profile).data
    return Response(data)


# ---------------------------------------------------------------- styles


class BraidStyleListView(generics.ListAPIView):
    queryset = BraidStyle.objects.all()
    serializer_class = BraidStyleSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


# ---------------------------------------------------------------- braiders


class BraiderListView(generics.ListAPIView):
    serializer_class = BraiderProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = BraiderProfile.objects.filter(is_active=True).prefetch_related(
            "listings__style", "reviews"
        )
        style = self.request.query_params.get("style")
        campus_area = self.request.query_params.get("campus_area")
        if style:
            queryset = queryset.filter(listings__style__name__iexact=style, listings__is_active=True)
        if campus_area:
            queryset = queryset.filter(campus_area__iexact=campus_area)
        return queryset.distinct()


class BraiderDetailView(generics.RetrieveAPIView):
    queryset = BraiderProfile.objects.prefetch_related("listings__style", "reviews__client")
    serializer_class = BraiderProfileSerializer
    permission_classes = [permissions.AllowAny]


@api_view(["GET", "PUT", "PATCH"])
def my_braider_profile(request):
    role, profile = _role_and_profile(request.user)
    if role != "braider":
        return Response({"detail": "No braider profile for this user."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        return Response(BraiderProfileSerializer(profile, context={"request": request}).data)
    serializer = BraiderProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET", "PUT", "PATCH"])
def my_client_profile(request):
    role, profile = _role_and_profile(request.user)
    if role != "client":
        return Response({"detail": "No client profile for this user."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        return Response(ClientProfileSerializer(profile).data)
    serializer = ClientProfileSerializer(profile, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET"])
def recommended_braiders(request):
    """Braiders ranked for a style + date (+ optional budget)."""
    style_name = request.query_params.get("style")
    date_str = request.query_params.get("date")
    max_price = request.query_params.get("max_price")
    if not style_name:
        return Response({"detail": "Query param 'style' is required."}, status=status.HTTP_400_BAD_REQUEST)
    style = get_object_or_404(BraidStyle, name__iexact=style_name)
    requested_date = None
    if date_str:
        try:
            requested_date = date_cls.fromisoformat(date_str)
        except ValueError:
            return Response({"detail": "Date must be YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
    ranked = matching.ranked_braiders_for_request(style, requested_date, max_price)
    data = []
    for braider, score, breakdown, cheapest in ranked:
        item = BraiderProfileSerializer(braider).data
        item["match_score"] = score
        item["match_breakdown"] = breakdown
        item["cheapest_listing"] = ListingSerializer(cheapest).data
        data.append(item)
    return Response(data)


# ---------------------------------------------------------------- listings


class ListingListCreateView(generics.ListCreateAPIView):
    serializer_class = ListingSerializer

    def get_queryset(self):
        queryset = Listing.objects.filter(is_active=True).select_related("braider", "style")
        style = self.request.query_params.get("style")
        braider = self.request.query_params.get("braider")
        max_price = self.request.query_params.get("max_price")
        campus_area = self.request.query_params.get("campus_area")
        if style:
            queryset = queryset.filter(style__name__iexact=style)
        if braider:
            queryset = queryset.filter(braider_id=braider)
        if campus_area:
            queryset = queryset.filter(braider__campus_area__iexact=campus_area)
        if max_price:
            try:
                queryset = queryset.filter(price__lte=max_price)
            except (ValueError, TypeError):
                pass
        return queryset

    def perform_create(self, serializer):
        role, profile = _role_and_profile(self.request.user)
        if role != "braider":
            raise PermissionDenied("Only braiders can create listings.")
        serializer.save(braider=profile)


class ListingDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Listing.objects.select_related("braider", "style")
    serializer_class = ListingSerializer
    permission_classes = [permissions.AllowAny]

    def perform_update(self, serializer):
        listing = self.get_object()
        role, profile = _role_and_profile(self.request.user)
        if role != "braider" or listing.braider_id != profile.id:
            raise PermissionDenied("Not your listing.")
        serializer.save()

    def perform_destroy(self, instance):
        role, profile = _role_and_profile(self.request.user)
        if role != "braider" or instance.braider_id != profile.id:
            raise PermissionDenied("Not your listing.")
        # Deleting would also delete the bookings (and receipts) made on it.
        if instance.bookings.exists():
            raise ValidationError({"detail": "This posting has bookings, so it can't be deleted. Pause it instead."})
        instance.delete()


@api_view(["GET"])
def my_listings(request):
    role, profile = _role_and_profile(request.user)
    if role != "braider":
        return Response({"detail": "No braider profile for this user."}, status=status.HTTP_404_NOT_FOUND)
    listings = Listing.objects.filter(braider=profile).select_related("style")
    return Response(ListingSerializer(listings, many=True).data)


# ---------------------------------------------------------------- bookings


def _overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def _braider_has_conflict(braider, booking_date, start_time, duration_minutes, exclude_id=None):
    """True if an accepted booking (plus her rest time) overlaps the new one."""
    start = datetime.combine(booking_date, start_time)
    end = start + timedelta(minutes=duration_minutes)
    pad = timedelta(minutes=braider.buffer_minutes)
    busy = Booking.objects.filter(braider=braider, date=booking_date, status="accepted")
    if exclude_id:
        busy = busy.exclude(id=exclude_id)
    for other in busy.select_related("listing"):
        o_start = datetime.combine(other.date, other.start_time) - pad
        o_end = (
            datetime.combine(other.date, other.start_time)
            + timedelta(minutes=other.listing.duration_minutes)
            + pad
        )
        if start < o_end and o_start < end:
            return True
    return False


WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
SLOT_STEP_MINUTES = 30


def _on_time_off(braider, day):
    return braider.time_off.filter(start_date__lte=day, end_date__gte=day).exists()


def _open_slots(braider, listing, day, exclude_id=None):
    """Start times a client may request on a day (list of datetime.time)."""
    if not braider.is_active or day < timezone.localdate():
        return []
    if WEEKDAY_KEYS[day.weekday()] not in braider.available_days:
        return []
    if not braider.available_start_time or not braider.available_end_time:
        return []
    if _on_time_off(braider, day):
        return []
    now = timezone.localtime()
    cursor = datetime.combine(day, braider.available_start_time)
    close = datetime.combine(day, braider.available_end_time)
    length = timedelta(minutes=listing.duration_minutes)
    slots = []
    while cursor + length <= close:
        t = cursor.time()
        in_past = day == now.date() and cursor.replace(tzinfo=None) <= now.replace(tzinfo=None)
        if not in_past and not _braider_has_conflict(
            braider, day, t, listing.duration_minutes, exclude_id=exclude_id
        ):
            slots.append(t)
        cursor += timedelta(minutes=SLOT_STEP_MINUTES)
    return slots


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def braider_slots(request, braider_id):
    braider = get_object_or_404(BraiderProfile, id=braider_id)
    listing = get_object_or_404(Listing, id=request.query_params.get("listing"), braider=braider)
    try:
        day = date_cls.fromisoformat(request.query_params.get("date", ""))
    except ValueError:
        return Response({"detail": "Provide date as YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"date": day.isoformat(), "slots": [t.strftime("%H:%M") for t in _open_slots(braider, listing, day)]})


@api_view(["GET", "POST"])
def my_time_off(request):
    role, profile = _role_and_profile(request.user)
    if role != "braider":
        return Response({"detail": "Braiders only."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        upcoming = profile.time_off.filter(end_date__gte=timezone.localdate())
        return Response(TimeOffSerializer(upcoming, many=True).data)
    serializer = TimeOffSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(braider=profile)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def delete_time_off(request, time_off_id):
    role, profile = _role_and_profile(request.user)
    if role != "braider":
        return Response({"detail": "Braiders only."}, status=status.HTTP_403_FORBIDDEN)
    get_object_or_404(TimeOff, id=time_off_id, braider=profile).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def bookings(request):
    role, profile = _role_and_profile(request.user)
    if request.method == "GET":
        if role == "client":
            qs = Booking.objects.filter(client=profile)
        elif role == "braider":
            qs = Booking.objects.filter(braider=profile)
        else:
            return Response({"detail": "No profile for this user."}, status=status.HTTP_404_NOT_FOUND)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs.select_related("listing__style", "braider", "client")
        return Response(BookingSerializer(qs, many=True).data)

    # POST: client requests a booking for a listing.
    if role != "client":
        return Response({"detail": "Only clients can request bookings."}, status=status.HTTP_403_FORBIDDEN)
    listing = get_object_or_404(Listing, id=request.data.get("listing"))
    from .views_social import is_blocked

    if is_blocked(request.user, listing.braider.user):
        return Response({"detail": "You can't book this braider."}, status=status.HTTP_403_FORBIDDEN)
    if not listing.is_active or not listing.braider.is_active:
        return Response({"detail": "That listing is not available."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        booking_date = date_cls.fromisoformat(request.data.get("date", ""))
        start_time = datetime.strptime(request.data.get("start_time", ""), "%H:%M").time()
    except (ValueError, TypeError):
        return Response(
            {"detail": "Provide date as YYYY-MM-DD and start_time as HH:MM."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if booking_date < timezone.localdate():
        return Response({"detail": "Booking date cannot be in the past."}, status=status.HTTP_400_BAD_REQUEST)
    if start_time not in _open_slots(listing.braider, listing, booking_date):
        return Response(
            {"detail": "That time is not open. Pick one of the times shown for that day."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    place = str(request.data.get("place", ""))
    chosen = listing.braider.service_places
    if chosen and place not in chosen:
        return Response({"detail": "Choose where the appointment will be."}, status=status.HTTP_400_BAD_REQUEST)
    serializer = BookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    booking = serializer.save(client=profile, braider=listing.braider, status="requested")
    emails.booking_requested(booking)
    return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def booking_detail(request, booking_id):
    role, profile = _role_and_profile(request.user)
    booking = get_object_or_404(Booking, id=booking_id)
    if role == "client" and booking.client_id != profile.id:
        return Response({"detail": "Not your booking."}, status=status.HTTP_403_FORBIDDEN)
    if role == "braider" and booking.braider_id != profile.id:
        return Response({"detail": "Not your booking."}, status=status.HTTP_403_FORBIDDEN)
    if role not in ("client", "braider"):
        return Response({"detail": "No profile for this user."}, status=status.HTTP_404_NOT_FOUND)
    return Response(BookingSerializer(booking).data)


def _own_booking(request, booking_id, actor):
    """Return (booking, error response). actor is 'braider' or 'client'."""
    role, profile = _role_and_profile(request.user)
    booking = get_object_or_404(Booking, id=booking_id)
    owner = booking.braider_id if actor == "braider" else booking.client_id
    if role != actor or owner != profile.id:
        return None, Response({"detail": "Not your booking."}, status=status.HTTP_403_FORBIDDEN)
    return booking, None


def _transition_booking(request, booking_id, allowed_from, new_status, actor):
    booking, err = _own_booking(request, booking_id, actor)
    if err:
        return err
    if booking.status not in allowed_from:
        return Response(
            {"detail": f"Booking is {booking.status}; cannot move it to {new_status}."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if new_status == "accepted" and _braider_has_conflict(
        booking.braider, booking.date, booking.start_time,
        booking.listing.duration_minutes, exclude_id=booking.id,
    ):
        return Response(
            {"detail": "That time now conflicts with another accepted booking."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    booking.status = new_status
    fields = ["status", "updated_at"]
    now = timezone.now()
    if new_status == "confirmed":
        booking.payment_confirmed_at = now
        fields.append("payment_confirmed_at")
    booking.save(update_fields=fields)
    if new_status == "accepted":
        emails.booking_accepted(booking)
    elif new_status == "declined":
        emails.booking_declined(booking)
    elif new_status == "confirmed":
        emails.payment_received(booking)
    return Response(BookingSerializer(booking).data)


@api_view(["POST"])
def accept_booking(request, booking_id):
    return _transition_booking(request, booking_id, ["requested"], "accepted", "braider")


@api_view(["POST"])
def decline_booking(request, booking_id):
    return _transition_booking(request, booking_id, ["requested"], "declined", "braider")


@api_view(["POST"])
def complete_booking(request, booking_id):
    return _transition_booking(request, booking_id, ["accepted", "paid", "confirmed"], "completed", "braider")


@api_view(["POST"])
def payment_received(request, booking_id):
    return _transition_booking(request, booking_id, ["accepted", "paid"], "confirmed", "braider")


@api_view(["POST"])
def mark_paid(request, booking_id):
    """The client says they have sent the money (optionally with a screenshot)."""
    booking, err = _own_booking(request, booking_id, "client")
    if err:
        return err
    if booking.status != "accepted":
        return Response(
            {"detail": "You can mark a booking paid once it is accepted."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    shot = own_photo_url(request, str(request.data.get("screenshot_url", "")))
    booking.status = "paid"
    booking.paid_at = timezone.now()
    booking.payment_screenshot_url = shot
    booking.save(update_fields=["status", "paid_at", "payment_screenshot_url", "updated_at"])
    emails.client_says_paid(booking)
    return Response(BookingSerializer(booking).data)


ACTIVE = ["requested", "accepted", "paid", "confirmed"]


@api_view(["POST"])
def cancel_booking(request, booking_id):
    booking, err = _own_booking(request, booking_id, "client")
    if err:
        return err
    if booking.status not in ACTIVE:
        return Response({"detail": f"Booking is {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
    booking.status = "cancelled"
    booking.cancelled_by = "client"
    booking.cancel_reason = str(request.data.get("reason", ""))[:300]
    # Inside her window she may keep any deposit; we only record it.
    booking.late_cancel = timezone.now() > cancel_deadline(booking)
    booking.save(update_fields=["status", "cancelled_by", "cancel_reason", "late_cancel", "updated_at"])
    emails.booking_cancelled(booking, "client")
    return Response(BookingSerializer(booking).data)


@api_view(["POST"])
def braider_cancel_booking(request, booking_id):
    booking, err = _own_booking(request, booking_id, "braider")
    if err:
        return err
    if booking.status not in ["accepted", "paid", "confirmed"]:
        return Response({"detail": f"Booking is {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
    booking.status = "cancelled"
    booking.cancelled_by = "braider"
    booking.cancel_reason = str(request.data.get("reason", ""))[:300]
    booking.save(update_fields=["status", "cancelled_by", "cancel_reason", "updated_at"])
    emails.booking_cancelled(booking, "braider")
    return Response(BookingSerializer(booking).data)


@api_view(["POST"])
def reschedule_booking(request, booking_id):
    """Client asks to move the appointment. Allowed until her cancel window starts."""
    booking, err = _own_booking(request, booking_id, "client")
    if err:
        return err
    if booking.status not in ACTIVE:
        return Response({"detail": f"Booking is {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
    if timezone.now() > cancel_deadline(booking):
        return Response(
            {"detail": "It is too close to the appointment to move it here. Message her instead."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        day = date_cls.fromisoformat(request.data.get("date", ""))
        start = datetime.strptime(request.data.get("start_time", ""), "%H:%M").time()
    except (ValueError, TypeError):
        return Response({"detail": "Provide date and start_time."}, status=status.HTTP_400_BAD_REQUEST)
    if start not in _open_slots(booking.braider, booking.listing, day, exclude_id=booking.id):
        return Response({"detail": "That time is not open."}, status=status.HTTP_400_BAD_REQUEST)
    booking.date, booking.start_time = day, start
    booking.status = "requested"  # she approves the new time
    booking.reminder_sent = False
    booking.save(update_fields=["date", "start_time", "status", "reminder_sent", "updated_at"])
    emails.booking_rescheduled(booking)
    return Response(BookingSerializer(booking).data)


@api_view(["GET"])
def booking_receipt(request, booking_id):
    booking = get_object_or_404(Booking, id=booking_id)
    role, profile = _role_and_profile(request.user)
    mine = (role == "client" and booking.client_id == profile.id) or (
        role == "braider" and booking.braider_id == profile.id
    )
    if not mine:
        return Response({"detail": "Not your booking."}, status=status.HTTP_403_FORBIDDEN)
    if booking.status not in ("confirmed", "completed") or not booking.payment_confirmed_at:
        return Response({"detail": "No receipt yet: payment is not confirmed."}, status=status.HTTP_404_NOT_FOUND)
    return Response(
        {
            "receipt_no": booking.id,
            "braider": booking.braider.display_name,
            "client": booking.client.display_name,
            "service": booking.listing.title,
            "date": booking.date,
            "start_time": booking.start_time.strftime("%H:%M"),
            "duration_minutes": booking.listing.duration_minutes,
            "amount": str(booking.listing.price),
            "paid_on": booking.payment_confirmed_at,
        }
    )


# ---------------------------------------------------------------- reviews


@api_view(["GET", "POST"])
def reviews_for_booking(request, booking_id):
    booking = get_object_or_404(Booking, id=booking_id)
    if request.method == "GET":
        if hasattr(booking, "review"):
            return Response(ReviewSerializer(booking.review).data)
        return Response({"detail": "No review yet."}, status=status.HTTP_404_NOT_FOUND)
    role, profile = _role_and_profile(request.user)
    if role != "client" or booking.client_id != profile.id:
        return Response({"detail": "Not your booking."}, status=status.HTTP_403_FORBIDDEN)
    if booking.status != "completed":
        return Response(
            {"detail": "You can only review a completed booking."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if hasattr(booking, "review"):
        return Response({"detail": "This booking already has a review."}, status=status.HTTP_400_BAD_REQUEST)
    rating = request.data.get("rating")
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return Response({"detail": "Rating must be an integer 1-5."}, status=status.HTTP_400_BAD_REQUEST)
    if rating < 1 or rating > 5:
        return Response({"detail": "Rating must be 1-5."}, status=status.HTTP_400_BAD_REQUEST)
    urls = request.data.get("photo_urls") or []
    if not isinstance(urls, list) or len(urls) > 4:
        return Response({"detail": "Add up to 4 photos."}, status=status.HTTP_400_BAD_REQUEST)
    mine = set(Photo.objects.filter(owner=request.user, url__in=urls).values_list("url", flat=True))
    if any(u not in mine for u in urls):
        return Response({"detail": "Upload each photo first, then use its link."}, status=status.HTTP_400_BAD_REQUEST)
    review = Review.objects.create(
        booking=booking, client=profile, braider=booking.braider,
        rating=rating, comment=request.data.get("comment", ""), photo_urls=urls,
    )
    return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def reviews_for_braider(request, braider_id):
    braider = get_object_or_404(BraiderProfile, id=braider_id)
    reviews = Review.objects.filter(braider=braider).select_related("client")
    return Response(ReviewSerializer(reviews, many=True).data)


# -------------------------------------------------------------- photos


def _photo_json(p):
    return {
        "id": p.id,
        "kind": p.kind,
        "url": p.url,
        "thumb_url": photo_store.sized_url(p.url, 480),
        "large_url": photo_store.sized_url(p.url, 1200),
        "width": p.width,
        "height": p.height,
    }


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_photo(request):
    """Upload one photo (form field ``image``, optional ``kind``)."""
    upload = request.FILES.get("image")
    if upload is None:
        raise ValidationError({"image": "Choose a photo to upload."})
    kind = request.data.get("kind", "work")
    if kind not in {k for k, _ in Photo._meta.get_field("kind").choices}:
        raise ValidationError({"kind": "Unknown photo type."})
    _fmt, width, height = photo_store.validate_image(upload)
    url, key = photo_store.store_image(upload, kind, request.user.id)
    if url.startswith("/"):
        url = request.build_absolute_uri(url)
    photo = Photo.objects.create(
        owner=request.user, kind=kind, url=url, storage_key=key, width=width, height=height
    )
    return Response(_photo_json(photo), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_photo(request, photo_id):
    """Remove one of your own photos, from the database and from storage."""
    photo = get_object_or_404(Photo, pk=photo_id)
    if photo.owner_id != request.user.id:
        raise PermissionDenied("You can only remove your own photos.")
    photo_store.delete_stored(photo.storage_key)
    photo.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health(request):
    """Safe status check: says how email is set up, never any key or address."""
    return Response(
        {
            "ok": True,
            "email_mode": emails.email_mode(),
            "last_email_error": emails.LAST_ERROR["detail"],
            "database": "postgres" if "postgresql" in connection.vendor else connection.vendor,
        }
    )
