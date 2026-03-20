"""Authentication and security utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from .config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_workspace_token(
    user_id: int,
    role: str,
    workspace_id: Optional[int] = None,
    workspace_role: Optional[str] = None,
) -> str:
    """Create a JWT with workspace context embedded."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "workspace_id": workspace_id,
        "workspace_role": workspace_role,
    }
    return create_access_token(payload)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def verify_google_id_token(token: str, client_id: str) -> dict:
    """
    Verify a Google ID token from the frontend credential flow.

    Returns the decoded token payload containing:
    - sub: Google's unique user ID
    - email: User's email address
    - email_verified: bool
    - name: Full name
    - picture: Profile picture URL

    Raises ValueError if token is invalid, expired, or audience mismatch.
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    return id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        client_id,
    )
