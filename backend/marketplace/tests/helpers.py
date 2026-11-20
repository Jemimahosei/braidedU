from marketplace import emails
from django.contrib.auth.models import User


def sign_up(client, name, role, password="pw-12345678"):
    """Register with a Cornell email, confirm it, and sign the test client in."""
    email = f"{name}@cornell.edu"
    r = client.post(
        "/api/auth/register/", {"email": email, "password": password, "role": role}, format="json"
    )
    assert r.status_code == 201, r.content
    token = emails.make_token(User.objects.get(username=email), "confirm")
    r = client.post("/api/auth/confirm/", {"token": token}, format="json")
    assert r.status_code == 200, r.content
    client.credentials(HTTP_AUTHORIZATION="Token " + r.data["token"])
    return r.data
