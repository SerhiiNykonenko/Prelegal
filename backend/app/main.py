from contextlib import asynccontextmanager
from typing import Any

from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import get_connection, initialize_database
from app.repositories.document_drafts import get_or_create_document_draft, list_recent_document_drafts, save_document_draft
from app.repositories.sessions import create_session, delete_expired_sessions, delete_session, get_user_by_session_token
from app.repositories.users import create_user, get_user_by_email, normalize_email, verify_password
from app.schema import (
    AuthRequest,
    AuthResponse,
    ChatMessage,
    ChatTurnRequest,
    ChatTurnResponse,
    DocumentDraft,
    DocumentDraftResponse,
    DocumentKey,
    GenericDocumentDraft,
    MutualNdaDraft,
    RecentDocumentDraftsResponse,
    ReviewDraftResponse,
    SaveDocumentDraftRequest,
    SessionResponse,
    create_default_document_draft,
)
from app.services.document_chat import DocumentChatService


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    initialize_database(settings.database_path, reset=settings.reset_database_on_startup)
    yield


app = FastAPI(title="Prelegal Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_service = DocumentChatService()
SESSION_COOKIE_NAME = "prelegal_session"


from datetime import datetime, timezone


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
        max_age=settings.session_days * 24 * 60 * 60,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


def get_current_user(prelegal_session: str | None) -> dict[str, int | str]:
    if not prelegal_session:
        raise HTTPException(status_code=401, detail="Session required")

    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        row = get_user_by_session_token(connection, prelegal_session)

    if row is None:
        raise HTTPException(status_code=401, detail="Session required")
    return {"id": row["id"], "email": normalize_email(row["email"])}


def get_current_user_email(prelegal_session: str | None) -> str:
    return str(get_current_user(prelegal_session)["email"])


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/sign-up", response_model=AuthResponse)
def sign_up(payload: AuthRequest, response: Response) -> AuthResponse:
    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        if get_user_by_email(connection, payload.email) is not None:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        user = create_user(connection, payload.email, payload.password)
        delete_expired_sessions(connection)
        token, _ = create_session(connection, user_id=int(user["id"]), session_days=settings.session_days)
    _set_session_cookie(response, token)
    return AuthResponse(user=user)


@app.post("/api/auth/sign-in", response_model=AuthResponse)
def sign_in(payload: AuthRequest, response: Response) -> AuthResponse:
    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        row = get_user_by_email(connection, payload.email)
        if row is None or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user = {"id": row["id"], "email": row["email"]}
        delete_expired_sessions(connection)
        token, _ = create_session(connection, user_id=int(user["id"]), session_days=settings.session_days)
    _set_session_cookie(response, token)
    return AuthResponse(user=user)


@app.post("/api/auth/sign-out")
def sign_out(response: Response, prelegal_session: str | None = Cookie(default=None)) -> dict[str, bool]:
    if prelegal_session:
        settings = get_settings()
        with get_connection(settings.database_path) as connection:
            delete_session(connection, prelegal_session)
    _clear_session_cookie(response)
    return {"ok": True}


@app.get("/api/auth/session", response_model=SessionResponse)
def auth_session(prelegal_session: str | None = Cookie(default=None)) -> SessionResponse:
    return SessionResponse(user=get_current_user(prelegal_session))


@app.get("/api/document-drafts", response_model=RecentDocumentDraftsResponse)
def recent_document_drafts(prelegal_session: str | None = Cookie(default=None)) -> RecentDocumentDraftsResponse:
    current_user = get_current_user_email(prelegal_session)
    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        drafts = list_recent_document_drafts(connection, user_email=current_user)
    return RecentDocumentDraftsResponse(drafts=drafts)


@app.get("/api/document-drafts/{document_key}", response_model=DocumentDraftResponse)
def load_document_draft(
    document_key: str,
    prelegal_session: str | None = Cookie(default=None),
) -> DocumentDraftResponse:
    current_user = get_current_user_email(prelegal_session)
    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        draft = get_or_create_document_draft(
            connection,
            user_email=current_user,
            document_key=document_key,
        )
    if isinstance(draft.draft, MutualNdaDraft) and not draft.draft.effectiveDate:
        draft.draft.effectiveDate = _today_iso()
        draft.draft.partyOne.signatureDate = draft.draft.partyOne.signatureDate or _today_iso()
        draft.draft.partyTwo.signatureDate = draft.draft.partyTwo.signatureDate or _today_iso()
        with get_connection(settings.database_path) as connection:
            draft = save_document_draft(
                connection,
                user_email=current_user,
                document_key=document_key,
                payload=SaveDocumentDraftRequest(
                    status=draft.status,
                    inputMode=draft.inputMode,
                    draft=draft.draft,
                    chat=draft.chat,
                ),
            )
    return DocumentDraftResponse(draft=draft)


@app.put("/api/document-drafts/{document_key}", response_model=DocumentDraftResponse)
def update_document_draft(
    document_key: str,
    payload: SaveDocumentDraftRequest,
    prelegal_session: str | None = Cookie(default=None),
) -> DocumentDraftResponse:
    current_user = get_current_user_email(prelegal_session)
    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        draft = save_document_draft(
            connection,
            user_email=current_user,
            document_key=document_key,
            payload=payload,
        )
    return DocumentDraftResponse(draft=draft)


@app.post("/api/document-drafts/{document_key}/chat-turn", response_model=ChatTurnResponse)
def create_chat_turn(
    document_key: DocumentKey,
    payload: ChatTurnRequest,
    prelegal_session: str | None = Cookie(default=None),
) -> ChatTurnResponse:
    current_user = get_current_user_email(prelegal_session)
    result = chat_service.process_chat_turn(payload)

    if result.switchTo is not None and result.switchTo != document_key:
        target_snapshot = create_default_document_draft(result.switchTo)
        target_snapshot.chat = payload.chat.model_copy(
            update={
                "messages": [
                    *payload.chat.messages,
                    ChatMessage(role="user", content=payload.message),
                    ChatMessage(role="assistant", content=result.assistantMessage),
                ],
                "questionGroups": result.questionGroups,
            }
        )
        target_snapshot.status = "draft"
        target_snapshot.inputMode = "chat"

        settings = get_settings()
        with get_connection(settings.database_path) as connection:
            draft = save_document_draft(
                connection,
                user_email=current_user,
                document_key=result.switchTo,
                payload=SaveDocumentDraftRequest(
                    status=target_snapshot.status,
                    inputMode=target_snapshot.inputMode,
                    draft=target_snapshot.draft,
                    chat=target_snapshot.chat,
                ),
            )

        return ChatTurnResponse(
            draft=draft,
            assistantMessage=result.assistantMessage,
            readyForReview=result.readyForReview,
            switchTo=result.switchTo,
        )

    updated_chat = payload.chat.model_copy(
        update={
            "messages": [
                *payload.chat.messages,
                ChatMessage(role="user", content=payload.message),
                ChatMessage(role="assistant", content=result.assistantMessage),
            ],
            "questionGroups": result.questionGroups,
        }
    )
    updated_draft = apply_draft_updates(payload.draft, result.fieldUpdates)

    draft_payload = SaveDocumentDraftRequest(
        status="review" if result.readyForReview else "draft",
        inputMode="chat",
        draft=updated_draft,
        chat=updated_chat,
    )

    settings = get_settings()
    with get_connection(settings.database_path) as connection:
        draft = save_document_draft(
            connection,
            user_email=current_user,
            document_key=document_key,
            payload=draft_payload,
        )
    return ChatTurnResponse(
        draft=draft,
        assistantMessage=result.assistantMessage,
        readyForReview=result.readyForReview,
    )


@app.post("/api/document-drafts/{document_key}/review", response_model=ReviewDraftResponse)
def review_document_draft(
    document_key: DocumentKey,
    payload: SaveDocumentDraftRequest,
    prelegal_session: str | None = Cookie(default=None),
) -> ReviewDraftResponse:
    get_current_user_email(prelegal_session)
    field_errors = validate_draft_for_review(payload.draft)

    return ReviewDraftResponse(
        fieldErrors=field_errors,
        readyForDownload=len(field_errors) == 0,
    )


def apply_draft_updates(draft: DocumentDraft, updates: dict[str, Any]) -> DocumentDraft:
    if isinstance(draft, MutualNdaDraft):
        return _apply_mutual_nda_updates(draft, updates)
    if isinstance(draft, GenericDocumentDraft):
        return _apply_generic_updates(draft, updates)
    return draft


def _apply_mutual_nda_updates(draft: MutualNdaDraft, updates: dict[str, Any]) -> MutualNdaDraft:
    draft_data = draft.model_dump(mode="json")
    for field, value in updates.items():
        if value is None:
            continue
        if field in {"partyOne", "partyTwo"} and isinstance(value, dict):
            draft_data[field] = {
                **draft_data[field],
                **{nested_field: nested_value for nested_field, nested_value in value.items() if nested_value is not None},
            }
        else:
            draft_data[field] = value
    return MutualNdaDraft.model_validate(draft_data)


def _apply_generic_updates(draft: GenericDocumentDraft, updates: dict[str, Any]) -> GenericDocumentDraft:
    draft_data = draft.model_dump(mode="json")
    for field, value in updates.items():
        if value is None or field == "parties":
            continue
        draft_data[field] = value
    return GenericDocumentDraft.model_validate(draft_data)


def validate_draft_for_review(draft: DocumentDraft) -> dict[str, str]:
    if isinstance(draft, MutualNdaDraft):
        return _validate_mutual_nda(draft)
    if isinstance(draft, GenericDocumentDraft):
        return _validate_generic_document(draft)
    return {}


def _validate_mutual_nda(draft: MutualNdaDraft) -> dict[str, str]:
    field_errors: dict[str, str] = {}

    if not draft.purpose.strip():
        field_errors["purpose"] = "Purpose is required"
    if not draft.effectiveDate.strip():
        field_errors["effectiveDate"] = "Effective date is required"
    if not draft.governingLaw.strip():
        field_errors["governingLaw"] = "Governing law is required"
    if not draft.jurisdiction.strip():
        field_errors["jurisdiction"] = "Jurisdiction is required"

    for prefix, party in (("partyOne", draft.partyOne), ("partyTwo", draft.partyTwo)):
        if not party.printName.strip():
            field_errors[f"{prefix}.printName"] = "Print name is required"
        if not party.title.strip():
            field_errors[f"{prefix}.title"] = "Title is required"
        if not party.company.strip():
            field_errors[f"{prefix}.company"] = "Company is required"
        if not party.noticeAddress.strip():
            field_errors[f"{prefix}.noticeAddress"] = "Notice address is required"
        if not party.signatureDate.strip():
            field_errors[f"{prefix}.signatureDate"] = "Signature date is required"

    return field_errors


def _validate_generic_document(draft: GenericDocumentDraft) -> dict[str, str]:
    field_errors: dict[str, str] = {}

    if not draft.documentTitle.strip():
        field_errors["documentTitle"] = "Document title is required"
    if not draft.effectiveDate.strip():
        field_errors["effectiveDate"] = "Effective date is required"
    if not draft.businessPurpose.strip():
        field_errors["businessPurpose"] = "Business purpose is required"
    if not draft.governingLaw.strip():
        field_errors["governingLaw"] = "Governing law is required"
    if not draft.keyTerms.strip():
        field_errors["keyTerms"] = "Key terms are required"

    if len(draft.parties) < 2:
        field_errors["parties"] = "At least two parties are required"

    for index, party in enumerate(draft.parties):
        prefix = f"parties.{index}"
        if not party.name.strip():
            field_errors[f"{prefix}.name"] = "Name is required"
        if not party.company.strip():
            field_errors[f"{prefix}.company"] = "Company is required"

    return field_errors
