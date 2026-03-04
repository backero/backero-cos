import httpx

from app.core.config import settings


async def send_otp_sms(phone: str, otp: str) -> bool:
    """Send OTP via MSG91"""
    if not settings.MSG91_AUTH_KEY:
        print(f"[DEV] OTP for {phone}: {otp}")
        return True

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.msg91.com/api/v5/otp",
                params={
                    "template_id": settings.MSG91_TEMPLATE_ID,
                    "mobile": f"91{phone}",
                    "authkey": settings.MSG91_AUTH_KEY,
                    "otp": otp,
                },
            )
            return resp.status_code == 200
    except Exception as e:
        print(f"SMS send error: {e}")
        return False


async def send_whatsapp_message(phone: str, message: str, template_name: str = "task_reminder") -> bool:
    """Send WhatsApp message via Interakt"""
    if not settings.INTERAKT_API_KEY:
        print(f"[DEV] WhatsApp to {phone}: {message}")
        return True

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.interakt.ai/v1/public/message/",
                headers={
                    "Authorization": f"Basic {settings.INTERAKT_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "countryCode": "+91",
                    "phoneNumber": phone,
                    "type": "Template",
                    "template": {
                        "name": template_name,
                        "languageCode": "en",
                        "bodyValues": [message],
                    },
                },
            )
            return resp.status_code == 200
    except Exception as e:
        print(f"WhatsApp send error: {e}")
        return False
