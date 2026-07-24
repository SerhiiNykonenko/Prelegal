import os
import re
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schema import (
    DEFAULT_GENERIC_DOCUMENT_TITLES,
    ChatQuestion,
    ChatQuestionGroup,
    ChatTurnRequest,
    ChatTurnResult,
    DocumentDraft,
    DocumentKey,
    GenericDocumentDraft,
    GenericDocumentParty,
    MutualNdaDraft,
    PartialMutualNdaDraft,
)


SECTION_FIELDS: list[tuple[str, str, list[tuple[str, str]]]] = [
    (
        "Agreement basics",
        "Fill in the key business context for the agreement.",
        [
            ("purpose", "What is the purpose of the NDA?"),
            ("effectiveDate", "What should the effective date be?"),
        ],
    ),
    (
        "Terms",
        "Pick the term rules.",
        [
            ("mndaTermType", "Should the NDA expire after a fixed term or run until terminated?"),
            ("mndaTermYears", "If a fixed term, for how many years?"),
            ("confidentialityTermType", "Should confidentiality end after a fixed term or run in perpetuity?"),
            ("confidentialityTermYears", "If a fixed term, for how many years?"),
        ],
    ),
    (
        "Legal settings",
        "Confirm the governing law text.",
        [
            ("governingLaw", "Which state law should govern the NDA?"),
            ("jurisdiction", "What is the jurisdiction?"),
            ("modifications", "List any modifications to the standard MNDA terms."),
        ],
    ),
    (
        "Party 1",
        "Capture the first party.",
        [
            ("partyOne.printName", "What is the print name of Party 1?"),
            ("partyOne.title", "What is the title of Party 1?"),
            ("partyOne.company", "What is the company of Party 1?"),
            ("partyOne.noticeAddress", "What is the notice address of Party 1?"),
            ("partyOne.signatureDate", "What is the signature date for Party 1?"),
        ],
    ),
    (
        "Party 2",
        "Capture the second party.",
        [
            ("partyTwo.printName", "What is the print name of Party 2?"),
            ("partyTwo.title", "What is the title of Party 2?"),
            ("partyTwo.company", "What is the company of Party 2?"),
            ("partyTwo.noticeAddress", "What is the notice address of Party 2?"),
            ("partyTwo.signatureDate", "What is the signature date for Party 2?"),
        ],
    ),
]


GENERIC_SECTION_FIELDS: list[tuple[str, str, list[tuple[str, str]]]] = [
    (
        "Agreement details",
        "Capture the core agreement context.",
        [
            ("documentTitle", "What is the title of this agreement?"),
            ("effectiveDate", "What should the effective date be?"),
            ("businessPurpose", "What is the business purpose of this agreement?"),
            ("governingLaw", "Which jurisdiction should govern this agreement?"),
        ],
    ),
    (
        "Parties",
        "Capture each party.",
        [
            ("parties.0.role", "What role does Party 1 play?"),
            ("parties.0.name", "Who is Party 1?"),
            ("parties.0.company", "What is Party 1's company?"),
            ("parties.1.role", "What role does Party 2 play?"),
            ("parties.1.name", "Who is Party 2?"),
            ("parties.1.company", "What is Party 2's company?"),
        ],
    ),
    (
        "Key terms",
        "Summarize the key terms.",
        [
            ("keyTerms", "What are the key terms of this agreement?"),
            ("specialTerms", "Are there any special or additional terms?"),
        ],
    ),
]


DOCUMENT_ALIASES: dict[str, DocumentKey] = {
    "mutual nda": "mutual-nda",
    "mutual-nda": "mutual-nda",
    "nda": "mutual-nda",
    "non-disclosure": "mutual-nda",
    "non-disclosure agreement": "mutual-nda",
    "cloud service agreement": "cloud-service-agreement",
    "csa": "cloud-service-agreement",
    "cloud": "cloud-service-agreement",
    "service level agreement": "service-level-agreement",
    "sla": "service-level-agreement",
    "service level": "service-level-agreement",
    "professional services agreement": "professional-services-agreement",
    "psa": "professional-services-agreement",
    "professional services": "professional-services-agreement",
    "consulting": "professional-services-agreement",
    "data processing agreement": "data-processing-agreement",
    "dpa": "data-processing-agreement",
    "data processing": "data-processing-agreement",
    "gdpr": "data-processing-agreement",
    "design partner agreement": "design-partner-agreement",
    "design partner": "design-partner-agreement",
    "ai addendum": "ai-addendum",
    "ai": "ai-addendum",
    "pilot agreement": "pilot-agreement",
    "pilot": "pilot-agreement",
    "software license agreement": "software-license-agreement",
    "software license": "software-license-agreement",
    "license": "software-license-agreement",
    "partnership agreement": "partnership-agreement",
    "partnership": "partnership-agreement",
    "business associate agreement": "business-associate-agreement",
    "baa": "business-associate-agreement",
    "business associate": "business-associate-agreement",
    "hipaa": "business-associate-agreement",
}


class LlmExtractionNn(BaseModel):
    fieldUpdates: PartialMutualNdaDraft = Field(default_factory=PartialMutualNdaDraft)
    assistantMessage: str = ""


class LlmExtractionGeneric(BaseModel):
    documentTitle: Optional[str] = None
    effectiveDate: Optional[str] = None
    businessPurpose: Optional[str] = None
    governingLaw: Optional[str] = None
    keyTerms: Optional[str] = None
    specialTerms: Optional[str] = None
    assistantMessage: str = ""


class DocumentChatService:
    def __init__(self) -> None:
        self._model = "openrouter/openai/gpt-oss-20b:free"
        self._extra_body: dict[str, Any] = {"provider": {"order": ["cerebras"]}}
        self._api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    @property
    def model_enabled(self) -> bool:
        return bool(self._api_key)

    def process_chat_turn(self, request: ChatTurnRequest) -> ChatTurnResult:
        switch_target = detect_document_switch(request.message)

        if switch_target is not None:
            return self._build_switch_result(switch_target)

        assistant_message = ""
        field_updates: PartialMutualNdaDraft = PartialMutualNdaDraft()

        if self.model_enabled:
            try:
                if isinstance(request.draft, MutualNdaDraft):
                    extraction = self._run_llm_extraction_nda(request)
                    field_updates = extraction.fieldUpdates
                    assistant_message = extraction.assistantMessage
                elif isinstance(request.draft, GenericDocumentDraft):
                    extraction = self._run_llm_extraction_generic(request)
                    field_updates = _generic_to_partial_updates(extraction)
                    assistant_message = extraction.assistantMessage
            except Exception as error:
                assistant_message = (
                    f"I couldn't reach the AI model right now ({error}). "
                    "Continue filling in the form while I keep your draft saved."
                )

        merged_draft = apply_partial_updates(request.draft, field_updates)
        question_groups = build_question_groups(merged_draft)
        ready_for_review = len(question_groups) == 0

        if not assistant_message:
            if not ready_for_review:
                assistant_message = (
                    "I saved your latest answer. I still need a few grouped details to complete the draft."
                )
            else:
                assistant_message = "I have enough information to prepare the draft for review."

        if not assistant_message and not question_groups:
            assistant_message = "I have enough information to prepare the draft for review."

        return ChatTurnResult(
            assistantMessage=assistant_message,
            fieldUpdates=field_updates,
            questionGroups=question_groups,
            readyForReview=ready_for_review,
        )

    def _build_switch_result(self, target: DocumentKey) -> ChatTurnResult:
        title = title_for_key(target)
        message = (
            f"I can help you start a {title} instead. I've loaded a fresh draft for that agreement. "
            "Use the chat and form to add the parties and terms."
        )
        return ChatTurnResult(
            assistantMessage=message,
            fieldUpdates=PartialMutualNdaDraft(),
            questionGroups=_default_groups_for_key(target),
            readyForReview=False,
            switchTo=target,
        )

    def _run_llm_extraction_nda(self, request: ChatTurnRequest) -> LlmExtractionNn:
        from litellm import completion

        system_prompt = (
            "You extract Mutual NDA fields from a chat conversation. "
            "Only populate fields that the user has clearly stated; leave others null. "
            "Respond with JSON matching the provided schema."
        )
        user_prompt = (
            f"Current draft JSON:\n{request.draft.model_dump_json(indent=2)}\n\n"
            f"Latest user message:\n{request.message}\n\n"
            "Extract any newly stated Mutual NDA fields and provide a short assistant reply."
        )

        response = completion(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=LlmExtractionNn,
            reasoning_effort="low",
            extra_body=self._extra_body,
            api_key=self._api_key,
        )

        content = response["choices"][0]["message"]["content"]
        return LlmExtractionNn.model_validate(content)

    def _run_llm_extraction_generic(self, request: ChatTurnRequest) -> LlmExtractionGeneric:
        from litellm import completion

        system_prompt = (
            "You extract generic document fields from a chat conversation. "
            "Only populate fields that the user has clearly stated; leave others null. "
            "Respond with JSON matching the provided schema."
        )
        user_prompt = (
            f"Current draft JSON:\n{request.draft.model_dump_json(indent=2)}\n\n"
            f"Latest user message:\n{request.message}\n\n"
            "Extract any newly stated document fields and provide a short assistant reply."
        )

        response = completion(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=LlmExtractionGeneric,
            reasoning_effort="low",
            extra_body=self._extra_body,
            api_key=self._api_key,
        )

        content = response["choices"][0]["message"]["content"]
        return LlmExtractionGeneric.model_validate(content)


def _generic_to_partial_updates(extraction: LlmExtractionGeneric) -> PartialMutualNdaDraft:
    return PartialMutualNdaDraft()


def apply_partial_updates(draft: DocumentDraft, updates: PartialMutualNdaDraft) -> DocumentDraft:
    if isinstance(draft, MutualNdaDraft):
        return _apply_partial_mutual_nda(draft, updates)

    if isinstance(draft, GenericDocumentDraft):
        return draft.model_copy(deep=True)

    return draft


def _apply_partial_mutual_nda(draft: MutualNdaDraft, updates: PartialMutualNdaDraft) -> MutualNdaDraft:
    update_data = updates.model_dump(exclude_unset=True)
    party_one = updates.partyOne.model_dump(exclude_unset=True) if updates.partyOne else {}
    party_two = updates.partyTwo.model_dump(exclude_unset=True) if updates.partyTwo else {}

    merged = draft.model_copy(deep=True)
    for field, value in update_data.items():
        if field in {"partyOne", "partyTwo"}:
            continue
        setattr(merged, field, value)

    for field, value in party_one.items():
        setattr(merged.partyOne, field, value)
    for field, value in party_two.items():
        setattr(merged.partyTwo, field, value)

    return merged


def build_question_groups(draft: DocumentDraft) -> list[ChatQuestionGroup]:
    if isinstance(draft, MutualNdaDraft):
        return _build_mutual_nda_question_groups(draft)
    if isinstance(draft, GenericDocumentDraft):
        return _build_generic_question_groups(draft)
    return []


def _build_mutual_nda_question_groups(draft: MutualNdaDraft) -> list[ChatQuestionGroup]:
    groups: list[ChatQuestionGroup] = []

    for title, _description, field_prompts in SECTION_FIELDS:
        questions = [
            ChatQuestion(key=field_key, prompt=prompt)
            for field_key, prompt in field_prompts
            if _is_mutual_nda_field_missing(draft, field_key)
        ]
        if questions:
            groups.append(ChatQuestionGroup(title=title, questions=questions))

    return groups


def _build_generic_question_groups(draft: GenericDocumentDraft) -> list[ChatQuestionGroup]:
    groups: list[ChatQuestionGroup] = []

    for title, _description, field_prompts in GENERIC_SECTION_FIELDS:
        questions = [
            ChatQuestion(key=field_key, prompt=prompt)
            for field_key, prompt in field_prompts
            if _is_generic_field_missing(draft, field_key)
        ]
        if questions:
            groups.append(ChatQuestionGroup(title=title, questions=questions))

    return groups


def _default_groups_for_key(document_key: DocumentKey) -> list[ChatQuestionGroup]:
    today = ""
    default_draft = _default_for_key(document_key, today)
    return build_question_groups(default_draft)


def _default_for_key(document_key: DocumentKey, today: str) -> DocumentDraft:
    if document_key == "mutual-nda":
        from app.schema import create_default_mutual_nda_draft

        return create_default_mutual_nda_draft(today)
    return GenericDocumentDraft(
        documentTitle=DEFAULT_GENERIC_DOCUMENT_TITLES[document_key],
        effectiveDate=today,
        businessPurpose="",
        governingLaw="",
        keyTerms="",
        specialTerms="",
        parties=[
            GenericDocumentParty(role="Party 1"),
            GenericDocumentParty(role="Party 2"),
        ],
    )


def _is_mutual_nda_field_missing(draft: MutualNdaDraft, field_key: str) -> bool:
    value = _get_nested_attribute(draft, field_key)
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _is_generic_field_missing(draft: GenericDocumentDraft, field_key: str) -> bool:
    if field_key.startswith("parties."):
        _, index_str, subfield = field_key.split(".", 2)
        index = int(index_str)
        if index >= len(draft.parties):
            return True
        party = draft.parties[index]
        value = getattr(party, subfield, None)
        return value is None or (isinstance(value, str) and value.strip() == "")

    value = getattr(draft, field_key, None)
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _get_nested_attribute(target: Any, field_key: str) -> Any:
    current = target
    for segment in field_key.split("."):
        current = getattr(current, segment)
    return current


def title_for_key(document_key: DocumentKey) -> str:
    if document_key == "mutual-nda":
        return "Mutual NDA"
    return DEFAULT_GENERIC_DOCUMENT_TITLES[document_key]


def detect_document_switch(message: str) -> DocumentKey | None:
    text = (message or "").strip().lower()
    if not text:
        return None

    if not _looks_like_switch_request(text):
        return None

    longest_match: tuple[int, DocumentKey] | None = None
    for alias, key in DOCUMENT_ALIASES.items():
        pattern = rf"\b{re.escape(alias)}\b"
        match = re.search(pattern, text)
        if match and (longest_match is None or len(alias) > longest_match[0]):
            longest_match = (len(alias), key)

    return longest_match[1] if longest_match else None


def _looks_like_switch_request(text: str) -> bool:
    if "switch" in text or "instead" in text or "another" in text or "different" in text:
        return True
    if any(verb in text for verb in ("i want", "i need", "i would like", "open", "load", "select", "pick")):
        return True
    return False
