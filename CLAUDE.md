# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory. The available documents are covered in the `catalog.json` file in the project root:

@catalog.json

Current state: the project now has a working V1 foundation, the KAN-5 AI-assisted Mutual NDA workspace, and the KAN-6 expansion to all Common Paper template-backed document types on `main`. The Next.js frontend, FastAPI backend, Docker Compose stack, and reset-on-startup SQLite database are in place. Every supported agreement now runs through one shared generic workspace: the chat and the form are visible side by side, draft is autosaved through the backend, chat history is persisted, the user must explicitly review/edit before PDF download, the user can ask the chat to switch to a different supported document, and an unsupported request returns the closest supported document (deterministic alias match). The Mutual NDA workspace keeps the rich per-field editor and the existing tokenized PDF pipeline; every other agreement uses the generic draft schema and renders a summary section plus the static template body into the same PDF generator.

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-20b:free` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root. The backend falls back to a deterministic grouped-question scaffold when the key is absent so local startup still works.

## Technical design

The project is currently packaged for local development with Docker Compose.  
The backend is in `backend/` as a `uv` project using FastAPI, structured as `app/` (FastAPI entrypoint, Pydantic schema), `app/repositories/` (SQLite data access), and `app/services/` (`document_chat` LLM orchestration).  
The frontend is in `frontend/` as a Next.js app, with `src/components/document-workspace/` housing the new Chat/Form/Review workspace and `src/lib/` carrying the API client, document registry, and persisted-draft helpers.  
The database uses SQLite and is reset from scratch on stack startup in the containerized flow. The current schema includes a temporary `users` table used by the fake login flow and a `document_drafts` table keyed by `(user_email, document_key)` that stores status, input mode, the NDA draft JSON, and chat history.  
Platform start/stop scripts are present in `scripts/`:  
```bash
# Mac
scripts/start-mac.sh
scripts/stop-mac.sh

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

Local URLs:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

The frontend is currently served as its own container rather than being statically served by FastAPI. The frontend calls the FastAPI backend directly via `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000`) and forwards the fake session email through the `x-session-email` header alongside the `prelegal_session` cookie.

## Implementation update

Implemented so far:
- FastAPI backend foundation with `/health`, `/api/session-login`, and document draft endpoints (`GET/PUT /api/document-drafts/{key}`, `POST /api/document-drafts/{key}/chat-turn`, `POST /api/document-drafts/{key}/review`)
- SQLite initialization and reset-on-startup behavior for the local stack, including the `document_drafts` table for persisted drafts and chat history
- Fake login flow with session cookie/header and protected workspace routes
- Shared document registry that backs every supported agreement, including the Mutual NDA tokenized editor and a generic draft schema for every other Common Paper template (Cloud Service Agreement, SLA, Professional Services Agreement, Data Processing Agreement, Design Partner Agreement, AI Addendum, Pilot Agreement, Software License Agreement, Partnership Agreement, Business Associate Agreement)
- Generic side-by-side chat + form workspace with document-key aware autosave, follow-up questions (after extracted updates), review/edit step, and PDF download
- In-chat detection of document switches and unsupported requests, with a one-click Switch button that loads the closest supported document
- Chat textarea auto-refocus after the assistant response
- Generic PDF route at `/api/download` that renders the Mutual NDA through the existing tokenized pipeline and renders every other agreement as a generated summary section plus the static template body
- Docker Compose stack plus Windows/macOS/Linux start and stop scripts
- Polished UI spacing so the login card, dashboard cards, and workspace sidebar/header share the same 30px internal padding as the document workspace
- Stable `Draft saved` autosave indicator on the Mutual NDA workspace (no Saving/Saved flicker on idle or after edits)
- Backend pytest coverage in `tests/test_document_chat.py`, `tests/test_document_drafts.py`, and `tests/test_database_reset.py`
- Vitest coverage in `frontend/src/test/` (form, schema, render, pdf, download route, login form, workspace DOM)
- Playwright coverage in `frontend/src/test/e2e/` for the foundation login/dashboard flow, the Mutual NDA hydration, chat, review gating, refresh persistence, and PDF download flows, the side-by-side chat and form, the in-chat document switch, the unsupported closest-match suggestion, and the chat textarea focus behavior

Not implemented yet:
- Real authentication
- Per-document dedicated schemas (non-NDA documents use the generic schema)
- Production-grade persistence/migration tooling for the SQLite schema

Keep `CLAUDE.md` aligned with the actual implemented product state as features land.

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`