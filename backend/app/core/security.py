import random
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis.asyncio as aioredis
from jose import jwt

from app.core.config import settings

# ── OTP store — Redis with in-memory fallback ─────────────────────────────────
_redis: Optional[aioredis.Redis] = None
_mem_store: dict[str, tuple[str, float]] = {}

# key -> (count, window_start)
_otp_rate_store: dict[str, tuple[int, float]] = {}
OTP_RATE_LIMIT = 3
OTP_RATE_WINDOW = 600  # 10 minutes


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    return _redis


def _mem_set(key: str, value: str, ttl: int) -> None:
    _mem_store[key] = (value, time.time() + ttl)


def _mem_get(key: str) -> Optional[str]:
    entry = _mem_store.get(key)
    if not entry:
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


# ── OTP store ─────────────────────────────────────────────────────────────────

def check_otp_rate_limit(phone: str) -> bool:
    """Return True if allowed, False if rate limit exceeded (3 per 10 min)."""
    now = time.time()
    key = f"rate:{phone}"
    entry = _otp_rate_store.get(key)
    if entry:
        count, window_start = entry
        if now - window_start < OTP_RATE_WINDOW:
            if count >= OTP_RATE_LIMIT:
                return False
            _otp_rate_store[key] = (count + 1, window_start)
        else:
            _otp_rate_store[key] = (1, now)
    else:
        _otp_rate_store[key] = (1, now)
    return True


async def store_otp(phone: str, otp: str, ttl: int = 300) -> None:
    try:
        r = _get_redis()
        await r.setex(f"otp:{phone}", ttl, otp)
    except Exception:
        _mem_set(f"otp:{phone}", otp, ttl)


async def verify_otp(phone: str, otp: str) -> bool:
    key = f"otp:{phone}"
    try:
        r = _get_redis()
        stored = await r.get(key)
        if stored and stored == otp:
            await r.delete(key)
            return True
        return False
    except Exception:
        stored = _mem_get(key)
        if stored and stored == otp:
            _mem_delete(key)
            return True
        return False
