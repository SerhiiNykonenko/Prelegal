# Prelegal

Prelegal is currently in progress.

The project is under active development and is expected to be completed in one week.

## Status

- Development status: in progress
- Expected completion: one week from now

## Getting started

The legacy data assets live at the repository root:

- `catalog.json` and `templates/` contain Common Paper legal agreement templates curated as part of KAN-2.

The current V1 foundation includes:

- `frontend/` — Next.js workspace UI, fake login flow, and Mutual NDA creator with Chat/Form toggle, review step, and persisted draft state
- `backend/` — FastAPI foundation with SQLite user storage, persisted draft APIs, and AI chat orchestration via LiteLLM/OpenRouter (Cerebras provider)
- `scripts/` — platform start/stop helpers for the full stack

### Full stack startup

Use the platform script from the repository root:

- Windows: `scripts/start-windows.ps1`
- macOS: `scripts/start-mac.sh`
- Linux: `scripts/start-linux.sh`

The stack exposes:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

Use any non-empty email and password on the login screen to enter the prototype workspace.

### Stop the stack

- Windows: `scripts/stop-windows.ps1`
- macOS: `scripts/stop-mac.sh`
- Linux: `scripts/stop-linux.sh`

### End-to-end tests

From `frontend/`:

```bash
npm install
npm run test:e2e:install
npm run test:e2e
```

`test:e2e:install` downloads the Playwright browser binaries needed by the suite.

## Documentation

More detailed documentation will be added once the initial project structure and implementation are finalized.
