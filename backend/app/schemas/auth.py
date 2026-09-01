from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    phone_number: str = Field(..., min_length=10, max_length=20)


class LoginRequest(BaseModel):
    username: str  # Can be username, email, or phone_number
    password: str


class AuthResponse(BaseModel):
    token: str
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    phone_number: str
    username: Optional[str] = None
    email: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    about: Optional[str] = None
    is_online: bool
    last_seen: Optional[str] = None

    class Config:
        from_attributes = True


AuthResponse.model_rebuild()
