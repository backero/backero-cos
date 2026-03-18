from pydantic import BaseModel


class SendOTPRequest(BaseModel):
    phone: str


class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str


class RefreshRequest(BaseModel):
    refresh_token: str
