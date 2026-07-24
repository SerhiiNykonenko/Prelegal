import os
from typing import Any

from pydantic import BaseModel, Field

from app.schema import (
    ChatQuestion,
    ChatQuestionGroup,
    ChatTurnRequest,
    ChatTurnResult,
    MutualNdaDraft,
    PartialMutualNdaDraft,
    PartialMutualNdaParty,
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
        "Confirm the NDA and confidentiality term settings.",
        [
            ("mndaTermType", "Should the NDA term be fixed or continue until terminated?"),
            ("mndaTermYears", "If fixed, how many years should the NDA term last?"),
            (
                "confidentialityTermType",
                "Should the confidentiality obligation be fixed-term or perpetual?",
            ),
            (
                "confidentialityTermYears",
                "If fixed, how many years should confidentiality obligations last?",
            ),
        ],
    ),
    (
        "Legal settings",
        "Set the governing law, jurisdiction, and any modifications.",
        [
            ("governingLaw", "Which state's law should govern the NDA?"),
            ("jurisdiction", "Which courts should have jurisdiction?"),
            ("modifications", "Are there any modifications beyond the standard Mutual NDA?"),
        ],
    ),
    (
        "Party 1 signer details",
        "Add the signer and notice information for party 1.",
        [
            ("partyOne.printName", "What is party 1's signer full name?"),
            ("partyOne.title", "What is party 1 signer's title?"),
            ("partyOne.company", "What is party 1 company name?"),
            ("partyOne.noticeAddress", "What is party 1 notice address?"),
            ("partyOne.signatureDate", "What is party 1 signature date?"),
        ],
    ),
    (
        "Party 2 signer details",
        "Add the signer and notice information for party 2.",
        [
            ("partyTwo.printName", "What is party 2's signer full name?"),
            ("partyTwo.title", "What is party 2 signer's title?"),
            ("partyTwo.company", "What is party 2 company name?"),
            ("partyTwo.noticeAddress", "What is party 2 notice address?"),
            ("partyTwo.signatureDate", "What is party 2 signature date?"),
        ],
    ),
]


class LlmExtraction(BaseModel):
    assistantMessage: str = Field(default="I saved your latest answer.")
    fieldUpdates: PartialMutualNdaDraft = Field(default_factory=PartialMutualNdaDraft)


class DocumentChatService:
    def __init__(self) -> None:
        self._model = "openrouter/openai/gpt-oss-20b:free"
        self._extra_body: dict[str, Any] = {"provider": {"order": ["cerebras"]}}
        self._api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    @property
    def model_enabled(self) -> bool:
        return bool(self._api_key)

    def process_chat_turn(self, request: ChatTurnRequest) -> ChatTurnResult:
        question_groups = build_question_groups(request.draft)
        ready_for_review = len(question_groups) == 0

        if self.model_enabled:
            try:
                extraction = self._run_llm_extraction(request)
                assistant_message = extraction.assistantMessage or (
                    "I saved your latest answer. I still need a few grouped details to complete the draft."
                    if not ready_for_review
                    else "I have enough information to prepare the Mutual NDA draft for review."
                )
                return ChatTurnResult(
                    assistantMessage=assistant_message,
                    fieldUpdates=extraction.fieldUpdates,
                    questionGroups=question_groups,
                    readyForReview=ready_for_review,
                )
            except Exception as error:
                assistant_message = (
                    "I had trouble reaching the AI model, so I kept your existing draft values. "
                    f"({error})\n\n"
                    + (
                        "I have enough information to prepare the Mutual NDA draft for review."
                        if ready_for_review
                        else "Please continue answering the grouped questions below."
                    )
                )
                return ChatTurnResult(
                    assistantMessage=assistant_message,
                    fieldUpdates=PartialMutualNdaDraft(),
                    questionGroups=question_groups,
                    readyForReview=ready_for_review,
                )

        if ready_for_review:
            assistant_message = (
                "I have enough information to prepare the Mutual NDA draft. "
                "Please review the structured fields before downloading the PDF."
            )
        else:
            assistant_message = (
                "I saved your latest answer. I still need a few grouped details to complete the draft."
            )

        return ChatTurnResult(
            assistantMessage=assistant_message,
            fieldUpdates=PartialMutualNdaDraft(),
            questionGroups=question_groups,
            readyForReview=ready_for_review,
        )

    def _run_llm_extraction(self, request: ChatTurnRequest) -> LlmExtraction:
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
            response_format=LlmExtraction,
            reasoning_effort="low",
            extra_body=self._extra_body,
            api_key=self._api_key,
        )

        content = response["choices"][0]["message"]["content"]
        return LlmExtraction.model_validate(content)


def build_question_groups(draft: MutualNdaDraft) -> list[ChatQuestionGroup]:
    groups: list[ChatQuestionGroup] = []

    for title, _description, field_prompts in SECTION_FIELDS:
        questions = [
            ChatQuestion(key=field_key, prompt=prompt)
            for field_key, prompt in field_prompts
            if _is_missing(draft, field_key)
        ]
        if questions:
            groups.append(ChatQuestionGroup(title=title, questions=questions))

    return groups


def _is_missing(draft: MutualNdaDraft, field_key: str) -> bool:
    value = _get_value(draft, field_key)
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _get_value(draft: MutualNdaDraft, field_key: str):
    current = draft
    for segment in field_key.split("."):
        current = getattr(current, segment)
    return current
