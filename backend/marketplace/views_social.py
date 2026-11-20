"""Messages, blocks, reports, review replies, and removing all of one's photos."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import emails
from . import photos as photo_store
from .models import (
    REPORT_REASONS, Block, Booking, BraiderProfile, ClientProfile, Listing, Message,
    Photo, Report, Review,
)
from .serializers import own_photo_url


def person(user):
    """(display name, photo link, role) for any user."""
    if hasattr(user, "braider_profile"):
        p = user.braider_profile
        return p.display_name, p.photo_url, "braider"
    if hasattr(user, "client_profile"):
        return user.client_profile.display_name, "", "client"
    return user.username, "", ""


def is_blocked(a, b):
    return Block.objects.filter(Q(blocker=a, blocked=b) | Q(blocker=b, blocked=a)).exists()


def may_message(sender, recipient):
    """Clients may write to braiders. A braider may write to a client once they
    share a booking or the client wrote first. Keeps cold messages out."""
    if sender.pk == recipient.pk or is_blocked(sender, recipient):
        return False
    if hasattr(recipient, "braider_profile"):
        return True
    return (
        Booking.objects.filter(braider__user=sender, client__user=recipient).exists()
        or Message.objects.filter(sender=recipient, recipient=sender).exists()
    )


@api_view(["GET"])
def conversations(request):
    me = request.user
    msgs = Message.objects.filter(Q(sender=me) | Q(recipient=me)).select_related("sender", "recipient")
    seen, out = set(), []
    for m in reversed(list(msgs)):  # newest first
        other = m.recipient if m.sender_id == me.id else m.sender
        if other.id in seen:
            continue
        seen.add(other.id)
        name, photo, role = person(other)
        out.append(
            {
                "user_id": other.id,
                "name": name,
                "photo_url": photo,
                "role": role,
                "last": m.body[:120] or "Photo",
                "last_at": m.created_at,
                "unread": Message.objects.filter(sender=other, recipient=me, read_at__isnull=True).count(),
                "blocked": Block.objects.filter(blocker=me, blocked=other).exists(),
            }
        )
    return Response(out)


@api_view(["GET", "POST"])
def thread(request, user_id):
    me = request.user
    other = get_object_or_404(User, pk=user_id, is_active=True)
    name, photo, role = person(other)
    if request.method == "POST":
        if not may_message(me, other):
            return Response({"detail": "You can't message this person."}, status=status.HTTP_403_FORBIDDEN)
        body = str(request.data.get("body", "")).strip()
        shot = own_photo_url(request, str(request.data.get("photo_url", "")))
        if not body and not shot:
            return Response({"detail": "Write a message or add a photo."}, status=status.HTTP_400_BAD_REQUEST)
        if len(body) > 2000:
            return Response({"detail": "That message is too long."}, status=status.HTTP_400_BAD_REQUEST)
        # One email per burst: skip if she already has an unread note from this sender.
        recent_unread = Message.objects.filter(
            sender=me, recipient=other, read_at__isnull=True,
            created_at__gte=timezone.now() - timedelta(minutes=30),
        ).exists()
        msg = Message.objects.create(sender=me, recipient=other, body=body, photo_url=shot)
        if not recent_unread:
            emails.new_message(me, other, body)
        return Response(_msg(msg, me), status=status.HTTP_201_CREATED)
    Message.objects.filter(sender=other, recipient=me, read_at__isnull=True).update(read_at=timezone.now())
    msgs = Message.objects.filter(
        Q(sender=me, recipient=other) | Q(sender=other, recipient=me)
    )
    return Response(
        {
            "user_id": other.id,
            "name": name,
            "photo_url": photo,
            "role": role,
            "can_reply": may_message(me, other),
            "blocked": Block.objects.filter(blocker=me, blocked=other).exists(),
            "messages": [_msg(m, me) for m in msgs],
        }
    )


def _msg(m, me):
    return {
        "id": m.id,
        "mine": m.sender_id == me.id,
        "body": m.body,
        "photo_url": m.photo_url,
        "created_at": m.created_at,
    }


@api_view(["GET"])
def unread_count(request):
    return Response({"unread": Message.objects.filter(recipient=request.user, read_at__isnull=True).count()})


@api_view(["POST", "DELETE"])
def block(request, user_id):
    other = get_object_or_404(User, pk=user_id)
    if other.pk == request.user.pk:
        return Response({"detail": "You can't block yourself."}, status=status.HTTP_400_BAD_REQUEST)
    if request.method == "POST":
        Block.objects.get_or_create(blocker=request.user, blocked=other)
        # Anything still pending with them is called off.
        Booking.objects.filter(
            Q(client__user=request.user, braider__user=other) | Q(client__user=other, braider__user=request.user),
            status="requested",
        ).update(status="declined")
        return Response({"blocked": True})
    Block.objects.filter(blocker=request.user, blocked=other).delete()
    return Response({"blocked": False})


@api_view(["POST"])
def report(request):
    other = get_object_or_404(User, pk=request.data.get("user_id"))
    reason = request.data.get("reason", "")
    if reason not in {k for k, _ in REPORT_REASONS}:
        return Response({"detail": "Pick a reason."}, status=status.HTTP_400_BAD_REQUEST)
    if other.pk == request.user.pk:
        return Response({"detail": "You can't report yourself."}, status=status.HTTP_400_BAD_REQUEST)
    r = Report.objects.create(
        reporter=request.user, reported=other, reason=reason,
        detail=str(request.data.get("detail", ""))[:2000],
    )
    emails.report_filed(r)
    return Response({"detail": "Thank you. We read every report."}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def reply_to_review(request, review_id):
    review = get_object_or_404(Review, pk=review_id)
    if not hasattr(request.user, "braider_profile") or review.braider.user_id != request.user.id:
        return Response({"detail": "Only the reviewed braider can reply."}, status=status.HTTP_403_FORBIDDEN)
    text = str(request.data.get("reply", "")).strip()
    if not text or len(text) > 1000:
        return Response({"detail": "Write a reply of up to 1000 characters."}, status=status.HTTP_400_BAD_REQUEST)
    review.braider_reply = text
    review.replied_at = timezone.now()
    review.save(update_fields=["braider_reply", "replied_at"])
    return Response({"braider_reply": review.braider_reply, "replied_at": review.replied_at})


@api_view(["DELETE"])
def delete_all_my_photos(request):
    """Remove every photo this person uploaded, from storage and from their pages."""
    user = request.user
    photos = list(Photo.objects.filter(owner=user))
    for p in photos:
        photo_store.delete_stored(p.storage_key)
    urls = [p.url for p in photos]
    Photo.objects.filter(owner=user).delete()
    if hasattr(user, "braider_profile"):
        bp = user.braider_profile
        BraiderProfile.objects.filter(pk=bp.pk, photo_url__in=urls).update(photo_url="")
        Listing.objects.filter(braider=bp, photo_url__in=urls).update(photo_url="")
    for r in Review.objects.filter(client__user=user):
        kept = [u for u in r.photo_urls if u not in urls]
        if kept != r.photo_urls:
            r.photo_urls = kept
            r.save(update_fields=["photo_urls"])
    Message.objects.filter(sender=user, photo_url__in=urls).update(photo_url="")
    return Response({"removed": len(photos)})
