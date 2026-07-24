# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory. The available documents are covered in the `catalog.json` file in the project root:

@catalog.json

Current state: the project now has a working V1 foundation plus the KAN-5 AI-assisted Mutual NDA workspace on `main`. The Next.js frontend, FastAPI backend, Docker Compose stack, and reset-on-startup SQLite database are in place. The Mutual NDA workspace offers a Chat/Form toggle around a shared draft that is autosaved through the backend, persists chat history, requires an explicit review/edit step before PDF download, and reuses the existing Next.js PDF generation pipeline. Two polish commits land on top of KAN-5: matching 30px internal padding on the login card, dashboard cards, and workspace sidebar/header, and stopping the `Draft saved` indicator flicker on the Mutual NDA workspace.

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
- Mutual NDA workspace with Chat/Form toggle, server-backed autosave, grouped follow-up questions, and a mandatory review/edit step before PDF download
- Existing Next.js PDF generation pipeline at `/api/download` remains the source of truth for rendering the final Mutual NDA PDF
- Docker Compose stack plus Windows/macOS/Linux start and stop scripts
- Polished UI spacing so the login card, dashboard cards, and workspace sidebar/header share the same 30px internal padding as the document workspace
- Stable `Draft saved` autosave indicator on the Mutual NDA workspace (no Saving/Saved flicker on idle or after edits)
- Backend pytest coverage in `tests/test_document_chat.py` and `tests/test_document_drafts.py`
- Vitest coverage in `frontend/src/test/` (form, schema, render, pdf, download route, login form, workspace DOM)
- Playwright coverage in `frontend/src/test/e2e/` for the foundation login/dashboard flow and the Mutual NDA hydration, chat, review gating, refresh persistence, and PDF download flows

Not implemented yet:
- Real authentication
- Multi-document AI flow beyond the Mutual NDA prototype
- Production-grade persistence/migration tooling for the SQLite schema

Keep `CLAUDE.md` aligned with the actual implemented product state as features land.

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`