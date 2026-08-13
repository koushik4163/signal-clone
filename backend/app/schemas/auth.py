from pydantic import BaseModel
from typing import Optional


class SendOtpRequest(BaseModel):
    identifier: str


class SendOtpResponse(BaseModel):
    message: str
    mocked_otp: str  # for demo purposes only
    is_new_user: bool = False


class VerifyOtpRequest(BaseModel):
    identifier: str
    otp: str
    display_name: Optional[str] = None
    username: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    phone_number: str
    username: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    about: Optional[str] = None
    is_online: bool
    last_seen: Optional[str] = None

    class Config:
        from_attributes = True


AuthResponse.model_rebuild()
