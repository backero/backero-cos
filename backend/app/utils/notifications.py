import re
import sys
import httpx

from app.core.config import settings

# Force UTF-8 stdout on Windows so emoji/Unicode print calls don't crash uvicorn
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

_WA_URL = "https://graph.facebook.com/v19.0/{phone_number_id}/messages"


def _normalize_phone(phone: str) -> str:
    """Return a WhatsApp-ready number: digits only, with 91 country prefix."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("91") and len(digits) == 12:
        return digits
    digits = digits.lstrip("0")
    return f"91{digits}"


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
                    "mobile": _normalize_phone(phone),
                    "authkey": settings.MSG91_AUTH_KEY,
                    "otp": otp,
                },
            )
            return resp.status_code == 200
    except Exception as e:
        print(f"SMS send error: {e}")
        return False


async def _wa_post(client: httpx.AsyncClient, payload: dict) -> httpx.Response:
    url = _WA_URL.format(phone_number_id=settings.WHATSAPP_PHONE_NUMBER_ID)
    return await client.post(
        url,
        headers={
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=10,
    )


async def send_whatsapp_message(phone: str, message: str) -> bool:
    """Send a WhatsApp message via Meta Cloud API.

    Tries template first, then falls back to free-form text.
    Logs all failures clearly so you can see what's wrong.
    """
    if not settings.WHATSAPP_ACCESS_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        print(f"[DEV-WA] → {phone}: {message}")
        return True

    to = _normalize_phone(phone)
    tpl = settings.WHATSAPP_TEMPLATE_NAME

    print(f"[WhatsApp] Sending to {to} via phone_id={settings.WHATSAPP_PHONE_NUMBER_ID}")

    try:
        async with httpx.AsyncClient() as client:
            # ── 1. Template message ───────────────────────────────────────────
            resp = await _wa_post(client, {
                "messaging_product": "whatsapp",
                "to": to,
                "type": "template",
                "template": {
                    "name": tpl,
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [{"type": "text", "text": message[:1024]}],
                        }
                    ],
                },
            })

            if resp.status_code == 200:
                print(f"[WhatsApp] ✓ Template sent to {to}")
                return True

            print(f"[WhatsApp] ✗ Template failed ({resp.status_code}): {resp.text}")

            # ── 2. Free-form text fallback (works in 24h session window) ─────
            resp2 = await _wa_post(client, {
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": message[:4096]},
            })

            if resp2.status_code == 200:
                print(f"[WhatsApp] ✓ Text message sent to {to}")
                return True

            print(f"[WhatsApp] ✗ Text fallback also failed ({resp2.status_code}): {resp2.text}")
            return False

    except Exception as e:
        print(f"[WhatsApp] ✗ Exception sending to {to}: {e}")
        return False


# ── Task-specific message builders ───────────────────────────────────────────

def build_task_assigned_message(
    task_title: str,
    priority: str,
    due_date,
    assigned_by: str,
    description: str | None = None,
) -> str:
    due = due_date.strftime("%d %b %Y").lstrip("0") if due_date else "No deadline"
    priority_emoji = {"urgent": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(priority, "⚪")
    lines = [
        "📋 *New Task Assigned* — Backero",
        "",
        f"*Task:* {task_title}",
        f"*Priority:* {priority_emoji} {priority.capitalize()}",
        f"*Due Date:* {due}",
        f"*Assigned by:* {assigned_by}",
    ]
    if description:
        lines += ["", f"*Details:* {description[:200]}"]
    lines += ["", "Please complete this task on time. Log in to the Backero app to view and update your task."]
    return "\n".join(lines)


def build_task_submitted_message(
    task_title: str,
    submitted_by: str,
    note: str | None = None,
) -> str:
    lines = [
        "✅ *Task Submitted for Approval* — Backero",
        "",
        f"*Task:* {task_title}",
        f"*Submitted by:* {submitted_by}",
    ]
    if note:
        lines += [f"*Note:* {note}"]
    lines += ["", "Please review and approve or reject this task in the Backero app."]
    return "\n".join(lines)


def build_task_approved_message(task_title: str, approved_by: str) -> str:
    return "\n".join([
        "🎉 *Task Approved* — Backero",
        "",
        f"Your task *{task_title}* has been reviewed and approved by {approved_by}.",
        "Great work! Keep it up.",
    ])


def build_task_rejected_message(task_title: str, reason: str | None = None) -> str:
    lines = [
        "🔁 *Task Needs Revision* — Backero",
        "",
        f"Your completion for *{task_title}* was not approved.",
    ]
    if reason:
        lines += [f"*Reason:* {reason}"]
    lines += ["", "Please review the feedback and resubmit once done."]
    return "\n".join(lines)


# ── Email notifications ────────────────────────────────────────────────────────

async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an email via SMTP. Logs to console if SMTP not configured."""
    from app.core.config import settings

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print(f"[DEV-EMAIL] To: {to}\nSubject: {subject}\n{html_body[:300]}")
        return True

    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())
        return True
    except Exception as e:
        print(f"[EMAIL] Error sending to {to}: {e}")
        return False


def build_task_assigned_email(
    employee_name: str,
    task_title: str,
    priority: str,
    due_date,
    assigned_by: str,
    description: str | None = None,
) -> str:
    due = due_date.strftime("%d %b %Y") if due_date else "No deadline"
    priority_color = {"urgent": "#ef4444", "high": "#f97316", "medium": "#eab308", "low": "#22c55e"}.get(priority, "#6b7280")
    desc_html = f"<p style='color:#555;'>{description[:300]}</p>" if description else ""
    return f"""
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
      <h2 style="color: #1e3a5f; margin-bottom: 4px;">New Task Assigned</h2>
      <p style="color: #6b7280; margin-top: 0;">Hi {employee_name}, you have a new task in Backero COS.</p>
      <div style="background: white; border-radius: 8px; padding: 20px; margin: 16px 0; border-left: 4px solid #22c55e;">
        <h3 style="margin: 0 0 8px; color: #111;">{task_title}</h3>
        <p style="margin: 4px 0; color: #555;">Priority: <strong style="color: {priority_color};">{priority.upper()}</strong></p>
        <p style="margin: 4px 0; color: #555;">Due: <strong>{due}</strong></p>
        <p style="margin: 4px 0; color: #555;">Assigned by: <strong>{assigned_by}</strong></p>
        {desc_html}
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Backero Private Limited · Company Operating System</p>
    </div>
    """


def build_invoice_email(
    customer_name: str,
    invoice_number: str,
    total: float,
    due_date,
    company_name: str = "Backero Private Limited",
) -> str:
    due = due_date.strftime("%d %b %Y") if due_date else "N/A"
    return f"""
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
      <h2 style="color: #1e3a5f;">Invoice from {company_name}</h2>
      <p style="color: #555;">Dear {customer_name},</p>
      <p style="color: #555;">Please find your invoice details below:</p>
      <div style="background: white; border-radius: 8px; padding: 20px; margin: 16px 0; border-left: 4px solid #1e3a5f;">
        <p style="margin: 4px 0;">Invoice Number: <strong>{invoice_number}</strong></p>
        <p style="margin: 4px 0;">Amount Due: <strong>₹{total:,.2f}</strong></p>
        <p style="margin: 4px 0;">Due Date: <strong>{due}</strong></p>
      </div>
      <p style="color: #555;">Please make the payment by the due date. For any queries, please contact us.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">{company_name} · Backero COS</p>
    </div>
    """
