# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory. The available documents are covered in the `catalog.json` file in the project root:

@catalog.json

Current state: the project now has a working V1 foundation, the KAN-5 AI-assisted Mutual NDA workspace, the KAN-6 expansion to all Common Paper template-backed document types, and the KAN-7 multi-user polish on `main`. The Next.js frontend, FastAPI backend, Docker Compose stack, and reset-on-startup SQLite database are in place. Every supported agreement runs through one shared generic workspace: the chat and the form are visible side by side, draft is autosaved through the backend, chat history is persisted, the user must explicitly review/edit before PDF download, the user can ask the chat to switch to a different supported document, and an unsupported request returns the closest supported document (deterministic alias match). The Mutual NDA workspace keeps the rich per-field editor and the existing tokenized PDF pipeline; every other agreement uses the generic draft schema and renders a summary section plus the static template body into the same PDF generator. Sign in and Create account are separate flows backed by real email + scrypt-hashed passwords and a server-managed HttpOnly session cookie; the dashboard shows a "Continue your documents" section listing the latest saved draft per template, and a text-only legal disclaimer appears in the review step before PDF download.

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
The database uses SQLite and is reset from scratch on stack startup in the containerized flow. The current schema includes a `users` table that stores scrypt-hashed passwords (`password_hash`), a `sessions` table that holds hashed session tokens for HttpOnly cookie sessions, and a `document_drafts` table keyed by `(user_email, document_key)` that stores status, input mode, the NDA draft JSON, and chat history.  
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

The frontend is currently served as its own container rather than being statically served by FastAPI. The frontend calls the FastAPI backend directly via `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000`) and authenticates via the server-managed HttpOnly `prelegal_session` cookie sent with `credentials: "include"`; no client-side auth header is sent.

## Implementation update

Implemented so far:
- FastAPI backend foundation with `/health`, real auth endpoints (`POST /api/auth/sign-up`, `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, `GET /api/auth/session`), a recent-drafts endpoint (`GET /api/document-drafts`), and document draft endpoints (`GET/PUT /api/document-drafts/{key}`, `POST /api/document-drafts/{key}/chat-turn`, `POST /api/document-drafts/{key}/review`)
- SQLite initialization and reset-on-startup behavior for the local stack, including `users`, `sessions`, and `document_drafts` tables
- Real sign up / sign in flow with scrypt-hashed passwords, server-managed HttpOnly session cookies (`prelegal_session`), and protected workspace routes; the old fake email header and JS-written auth cookie are gone
- Shared document registry that backs every supported agreement, including the Mutual NDA tokenized editor and a generic draft schema for every other Common Paper template (Cloud Service Agreement, SLA, Professional Services Agreement, Data Processing Agreement, Design Partner Agreement, AI Addendum, Pilot Agreement, Software License Agreement, Partnership Agreement, Business Associate Agreement)
- Generic side-by-side chat + form workspace with document-key aware autosave, follow-up questions (after extracted updates), review/edit step, and PDF download
- Generic document chat extraction applies supported field updates back into the draft and filters mixed model output so the user sees only natural-language assistant text instead of raw JSON/debug-like payloads
- In-chat detection of document switches and unsupported requests, with a one-click Switch button that loads the closest supported document
- Chat textarea auto-refocus after the assistant response
- Generic PDF route at `/api/download` that renders the Mutual NDA through the existing tokenized pipeline and renders every other agreement as a generated summary section plus the static template body
- Dashboard "Continue your documents" section that lists the latest saved draft per document type, ordered by `updated_at`, linked back to the workspace
- Text-only legal disclaimer rendered in both review panels directly above the PDF download action
- Docker Compose stack plus Windows/macOS/Linux start and stop scripts
- Polished UI spacing so the login card, dashboard cards, and workspace sidebar/header share the same 30px internal padding as the document workspace
- Stable `Draft saved` autosave indicator on the Mutual NDA workspace (no Saving/Saved flicker on idle or after edits)
- Backend pytest coverage in `tests/test_session_login.py`, `tests/test_document_chat.py`, `tests/test_document_drafts.py`, and `tests/test_database_reset.py`
- Vitest coverage in `frontend/src/test/` (form, schema, render, pdf, download route, login form incl. sign-up mode, workspace DOM, dashboard recents)
- Playwright coverage in `frontend/src/test/e2e/` for the foundation login/dashboard flow, the Mutual NDA hydration, chat, review gating, refresh persistence, and PDF download flows, the side-by-side chat and form, the in-chat document switch, the unsupported closest-match suggestion, the chat textarea focus behavior, and the new sign-up flow + disclaimer visibility

Not implemented yet:
- Per-document dedicated schemas (non-NDA documents still use the generic schema)
- Production-grade persistence/migration tooling for the SQLite schema
- Multi-instance document history per user (KAN-7 ships "latest draft per template"; a true archive is a future iteration)

Keep `CLAUDE.md` aligned with the actual implemented product state as features land.

## Frontend context

Frontend styling is centralized in `frontend/src/app/globals.css`. Dashboard document links live in `frontend/src/app/app/page.tsx`, and the shared document workspace components live under `frontend/src/components/document-workspace/`.

## Color Scheme

Use the uploaded BWT logo palette:

- Orange Accent: `#e85a00`
- Purple Primary: `#461157`
- Blue Secondary: `#00509a`
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`