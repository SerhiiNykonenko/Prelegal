from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import get_connection, initialize_database
from app.repositories.users import upsert_user_for_fake_login
from app.schema import LoginRequest, LoginResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    initialize_database(settings.database_path, reset=settings.reset_database_on_startup)
    yield


app = FastAPI(title="Prelegal Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/session-login", response_model=LoginResponse)
def session_login(payload: LoginRequest) -> LoginResponse:
    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        user = upsert_user_for_fake_login(connection, payload.email, payload.password)
    return LoginResponse(user=user)
