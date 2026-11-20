"""Email clients the day before their appointment.

Run once a day, e.g. from a scheduler: python manage.py send_reminders
Safe to run twice: each booking is reminded once. Braiders can switch reminders off.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from marketplace import emails
from marketplace.models import Booking


class Command(BaseCommand):
    help = "Send the day-before reminder for tomorrow's appointments."

    def handle(self, *args, **options):
        tomorrow = timezone.localdate() + timedelta(days=1)
        due = Booking.objects.filter(
            date=tomorrow,
            status__in=["accepted", "paid", "confirmed"],
            reminder_sent=False,
            braider__reminders_enabled=True,
        ).select_related("client__user", "braider__user", "listing")
        sent = 0
        for booking in due:
            emails.booking_reminder(booking)
            booking.reminder_sent = True
            booking.save(update_fields=["reminder_sent"])
            sent += 1
        self.stdout.write(f"Reminders sent: {sent}")
