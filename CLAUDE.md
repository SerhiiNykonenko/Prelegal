# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory. The available documents are covered in the `catalog.json` file in the project root:

@catalog.json

Current state: the project now has a working V1 foundation with a Next.js frontend, a FastAPI backend, Docker-based local orchestration, and a temporary SQLite database. The Mutual NDA workspace now offers an AI-assisted chat flow alongside the structured form, persists drafts and chat history through the backend, requires an explicit review/edit step before download, and continues to use the existing Next.js PDF generation pipeline.

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-20b:free` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There ia an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The project is currently packaged for local development with Docker Compose.  
The backend is in `backend/` as a `uv` project using FastAPI.  
The frontend is in `frontend/` as a Next.js app.  
The database uses SQLite and is reset from scratch on stack startup in the containerized flow. The current schema includes a temporary `users` table used by the fake login flow.  
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

The frontend is currently served as its own container rather than being statically served by FastAPI.

## Implementation update

Implemented so far:
- FastAPI backend foundation with `/health`, `/api/session-login`, and document draft endpoints (`GET/PUT /api/document-drafts/{key}`, `/chat-turn`, `/review`)
- SQLite initialization and reset-on-startup behavior for the local stack, including the `document_drafts` table for persisted drafts and chat history
- Fake login flow with session cookie/header and protected workspace routes
- Mutual NDA workspace with Chat/Form toggle, server-backed autosave, grouped follow-up questions, and a mandatory review/edit step before PDF download
- Existing Next.js PDF generation pipeline remains the source of truth for rendering the final Mutual NDA PDF
- Docker Compose stack plus Windows/macOS/Linux start and stop scripts
- Unit, backend, and Playwright coverage for the foundation flow and the new chat/persistence/review behavior

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