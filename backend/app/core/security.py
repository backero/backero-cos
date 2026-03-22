import random
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

# import redis.asyncio as aioredis  # Redis commented out — using in-memory store for MVP
from jose import jwt

from app.core.config import settings

# ── In-memory OTP store ───────────────────────────────────────────────────────
# Redis is not used for MVP. All OTPs are stored in process memory with TTL.
# { key: (value, expires_at_unix_timestamp) }
_mem_store: dict[str, tuple[str, float]] = {}


def _mem_set(key: str, value: str, ttl: int) -> None:
    _mem_store[key] = (value, time.time() + ttl)


def _mem_get(key: str) -> Optional[str]:
    entry = _mem_store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        _mem_store.pop(key, None)
        return None
    return value


def _mem_delete(key: str) -> None:
    _mem_store.pop(key, None)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": subject, "role": role, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


# ── OTP store (in-memory) ─────────────────────────────────────────────────────

async def store_otp(phone: str, otp: str, ttl: int = 300) -> None:
    _mem_set(f"otp:{phone}", otp, ttl)


async def verify_otp(phone: str, otp: str) -> bool:
    key = f"otp:{phone}"
    stored = _mem_get(key)
    if stored and stored == otp:
        _mem_delete(key)
        return True
    return False
