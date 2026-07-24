from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


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


DocumentKey = Literal[
    "mutual-nda",
    "cloud-service-agreement",
    "service-level-agreement",
    "professional-services-agreement",
    "data-processing-agreement",
    "design-partner-agreement",
    "ai-addendum",
    "pilot-agreement",
    "software-license-agreement",
    "partnership-agreement",
    "business-associate-agreement",
]
DraftStatus = Literal["draft", "review"]
InputMode = Literal["chat", "form"]
ChatMessageRole = Literal["assistant", "user"]


class MutualNdaParty(BaseModel):
    printName: str = ""
    title: str = ""
    company: str = ""
    noticeAddress: str = ""
    signatureDate: str = ""


class MutualNdaDraft(BaseModel):
    purpose: str
    effectiveDate: str
    mndaTermType: Literal["fixed", "until-terminated"]
    mndaTermYears: int
    confidentialityTermType: Literal["fixed", "perpetual"]
    confidentialityTermYears: int
    governingLaw: str
    jurisdiction: str
    modifications: str
    partyOne: MutualNdaParty
    partyTwo: MutualNdaParty


class GenericDocumentParty(BaseModel):
    role: str = ""
    name: str = ""
    title: str = ""
    company: str = ""
    email: str = ""
    address: str = ""


class GenericDocumentDraft(BaseModel):
    documentTitle: str
    effectiveDate: str
    businessPurpose: str
    governingLaw: str
    keyTerms: str
    specialTerms: str
    parties: list[GenericDocumentParty] = Field(default_factory=list)


class PartialMutualNdaParty(BaseModel):
    printName: str | None = None
    title: str | None = None
    company: str | None = None
    noticeAddress: str | None = None
    signatureDate: str | None = None


class PartialMutualNdaDraft(BaseModel):
    purpose: str | None = None
    effectiveDate: str | None = None
    mndaTermType: Literal["fixed", "until-terminated"] | None = None
    mndaTermYears: int | None = None
    confidentialityTermType: Literal["fixed", "perpetual"] | None = None
    confidentialityTermYears: int | None = None
    governingLaw: str | None = None
    jurisdiction: str | None = None
    modifications: str | None = None
    partyOne: PartialMutualNdaParty | None = None
    partyTwo: PartialMutualNdaParty | None = None


DocumentDraft = MutualNdaDraft | GenericDocumentDraft
PartialDocumentDraft = PartialMutualNdaDraft


class ChatQuestion(BaseModel):
    key: str
    prompt: str


class ChatQuestionGroup(BaseModel):
    title: str
    questions: list[ChatQuestion] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: ChatMessageRole
    content: str


class DocumentDraftChatState(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    questionGroups: list[ChatQuestionGroup] = Field(default_factory=list)


class DocumentDraftSnapshot(BaseModel):
    documentKey: DocumentKey
    status: DraftStatus
    inputMode: InputMode
    draft: DocumentDraft
    chat: DocumentDraftChatState = Field(default_factory=DocumentDraftChatState)


class SaveDocumentDraftRequest(BaseModel):
    status: DraftStatus
    inputMode: InputMode
    draft: DocumentDraft
    chat: DocumentDraftChatState = Field(default_factory=DocumentDraftChatState)


class DocumentDraftResponse(BaseModel):
    draft: DocumentDraftSnapshot


class ChatTurnRequest(BaseModel):
    message: str
    draft: DocumentDraft
    chat: DocumentDraftChatState = Field(default_factory=DocumentDraftChatState)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Message is required")
        return message


class ChatTurnResult(BaseModel):
    assistantMessage: str
    fieldUpdates: PartialMutualNdaDraft = Field(default_factory=PartialMutualNdaDraft)
    questionGroups: list[ChatQuestionGroup] = Field(default_factory=list)
    readyForReview: bool = False
    switchTo: DocumentKey | None = None


class ChatTurnResponse(BaseModel):
    draft: DocumentDraftSnapshot
    assistantMessage: str
    readyForReview: bool
    switchTo: DocumentKey | None = None


class ReviewDraftResponse(BaseModel):
    fieldErrors: dict[str, str]
    readyForDownload: bool


def create_default_mutual_nda_draft(initial_date: str = "") -> MutualNdaDraft:
    today = initial_date or ""
    return MutualNdaDraft(
        purpose="Evaluating whether to enter into a business relationship with the other party.",
        effectiveDate=today,
        mndaTermType="fixed",
        mndaTermYears=1,
        confidentialityTermType="fixed",
        confidentialityTermYears=1,
        governingLaw="Delaware",
        jurisdiction="courts located in New Castle, DE",
        modifications="None.",
        partyOne=MutualNdaParty(signatureDate=today),
        partyTwo=MutualNdaParty(signatureDate=today),
    )


def create_default_generic_document_draft(document_title: str, initial_date: str = "") -> GenericDocumentDraft:
    return GenericDocumentDraft(
        documentTitle=document_title,
        effectiveDate=initial_date,
        businessPurpose="",
        governingLaw="",
        keyTerms="",
        specialTerms="",
        parties=[
            GenericDocumentParty(role="Party 1"),
            GenericDocumentParty(role="Party 2"),
        ],
    )


DEFAULT_GENERIC_DOCUMENT_TITLES: dict[DocumentKey, str] = {
    "cloud-service-agreement": "Cloud Service Agreement",
    "service-level-agreement": "Service Level Agreement",
    "professional-services-agreement": "Professional Services Agreement",
    "data-processing-agreement": "Data Processing Agreement",
    "design-partner-agreement": "Design Partner Agreement",
    "ai-addendum": "AI Addendum",
    "pilot-agreement": "Pilot Agreement",
    "software-license-agreement": "Software License Agreement",
    "partnership-agreement": "Partnership Agreement",
    "business-associate-agreement": "Business Associate Agreement",
}


def create_default_document_draft(document_key: DocumentKey) -> DocumentDraftSnapshot:
    if document_key == "mutual-nda":
        draft: DocumentDraft = create_default_mutual_nda_draft()
    else:
        draft = create_default_generic_document_draft(DEFAULT_GENERIC_DOCUMENT_TITLES[document_key])

    return DocumentDraftSnapshot(
        documentKey=document_key,
        status="draft",
        inputMode="form",
        draft=draft,
    )
