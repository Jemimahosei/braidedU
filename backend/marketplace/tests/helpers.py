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
    if role == "braider":
        # Open all week, 8am to 8pm, so tests can book freely.
        client.patch(
            "/api/braiders/me/",
            {
                "available_days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                "available_start_time": "08:00",
                "available_end_time": "20:00",
            },
            format="json",
        )
    return r.data
