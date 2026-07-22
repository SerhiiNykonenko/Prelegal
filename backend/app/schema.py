from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        password = value.strip()
        if not password:
            raise ValueError("Password is required")
        return password


class LoginUser(BaseModel):
    id: int
    email: EmailStr


class LoginResponse(BaseModel):
    user: LoginUser
