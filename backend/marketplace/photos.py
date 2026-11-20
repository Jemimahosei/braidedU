"""Photo upload helpers: validate, store (Cloudinary or local), delete."""

import uuid

import cloudinary
import cloudinary.uploader
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError


def _configure():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def validate_image(upload):
    """Return (format, width, height) or raise a clear ValidationError."""
    if upload.size > settings.MAX_UPLOAD_BYTES:
        raise ValidationError("That photo is over 10 MB. Try a smaller one.")
    try:
        img = Image.open(upload)
        img.verify()
        upload.seek(0)
        img = Image.open(upload)
        fmt, size = img.format, img.size
        upload.seek(0)
    except (UnidentifiedImageError, OSError):
        raise ValidationError("That file isn't a photo we can read. Use a JPG, PNG or WebP.")
    if fmt not in settings.ALLOWED_IMAGE_TYPES:
        raise ValidationError("Use a JPG, PNG or WebP photo.")
    return fmt, size[0], size[1]


def store_image(upload, kind, owner_id):
    """Save the image and return (url, storage_key). Local URLs are
    site-relative; the view makes them absolute."""
    if settings.USE_CLOUDINARY:
        _configure()
        result = cloudinary.uploader.upload(
            upload,
            folder=f"braidedu/{kind}",
            resource_type="image",
            # Keep the original small enough for any screen; Cloudinary
            # serves a smaller, compressed copy per device on delivery.
            transformation=[{"width": 1800, "height": 1800, "crop": "limit"}],
            overwrite=False,
        )
        return result["secure_url"], result["public_id"]
    name = f"photos/{owner_id}-{uuid.uuid4().hex}.jpg"
    saved = default_storage.save(name, ContentFile(upload.read()))
    return "/" + settings.MEDIA_URL + saved, saved


def delete_stored(storage_key):
    if not storage_key:
        return
    if settings.USE_CLOUDINARY:
        _configure()
        cloudinary.uploader.destroy(storage_key, invalidate=True)
    elif default_storage.exists(storage_key):
        default_storage.delete(storage_key)


def sized_url(url, width):
    """A smaller, compressed delivery URL for Cloudinary photos."""
    marker = "/image/upload/"
    if settings.USE_CLOUDINARY and marker in url:
        return url.replace(marker, f"{marker}f_auto,q_auto,w_{width},c_limit/")
    return url
