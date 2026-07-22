# Mutual NDA manual test checklist

## Goal
Use this checklist when validating the Mutual NDA creator after renderer, form, login, routing, or download changes.

## Login and workspace shell
- [ ] Open `http://localhost:3000` and confirm unauthenticated access redirects to `/login`.
- [ ] Submit empty login fields and confirm an inline validation error appears.
- [ ] Submit any non-empty email/password and confirm the app redirects to `/app`.
- [ ] Confirm the dashboard shows an action to open the Mutual NDA workflow.
- [ ] Click into the Mutual NDA page and confirm the existing form loads inside the workspace shell.
- [ ] Use **Sign out** and confirm the app returns to `/login`.


## Environment
- Start the app from `frontend/` with `npm run dev`.
- Open the site at `http://localhost:3000`.
- Prefer a clean browser profile or private window.

## Hydration and initial render
- [ ] Load the home page and confirm there are no hydration mismatch warnings in the browser console.
- [ ] Confirm the effective date field auto-populates with today’s date after mount.
- [ ] Confirm both signature date fields auto-populate with today’s date after mount.
- [ ] Refresh several times and confirm there are no controlled/uncontrolled input warnings.
- [ ] Confirm the preview card updates immediately as text fields, radio buttons, and number inputs change.

## Validation
- [ ] Click **Download Mutual NDA PDF** with empty party details and confirm inline errors appear.
- [ ] Confirm no download starts when validation fails.
- [ ] Enter whitespace-only values in required text fields and confirm validation rejects them.
- [ ] Set MNDA term years to `0`, negative, decimal, and `26`; confirm validation rejects each invalid value.
- [ ] Set confidentiality term years to `0`, negative, decimal, and `26`; confirm validation rejects each invalid value.
- [ ] Confirm boundary values `1` and `25` are accepted for both year fields.
- [ ] Clear effective date and signature dates and confirm validation rejects them.
- [ ] Press Enter in a text field and confirm it does not unexpectedly trigger a PDF download.

## Successful download flow
- [ ] Fill in all required fields for both parties.
- [ ] Click **Download Mutual NDA PDF** and confirm the button changes to **Generating PDF...** while the request is in flight.
- [ ] Confirm the button is disabled while generation is running.
- [ ] Confirm the downloaded filename is `mutual-nda.pdf`.
- [ ] Confirm the UI shows **PDF generated successfully.** after completion.

## PDF content and layout
- [ ] Open the downloaded PDF and confirm it is a valid PDF that opens without repair warnings.
- [ ] Confirm purpose, effective date, governing law, jurisdiction, modifications, and both party identities appear correctly.
- [ ] Confirm the selected MNDA term option is reflected correctly.
- [ ] Confirm the selected confidentiality term option is reflected correctly.
- [ ] Confirm there are no unresolved template placeholders such as `{{token}}`.
- [ ] Confirm every page shows a footer like `Mutual NDA · Page N`.
- [ ] Confirm there are no blank pages and no footer-only pages.
- [ ] Confirm long documents still paginate cleanly without trailing empty pages.

## API and error handling
- [ ] In DevTools Network, confirm the client sends `POST /api/download` with JSON.
- [ ] Confirm successful responses return `200`, `Content-Type: application/pdf`, and `Content-Disposition: attachment; filename="mutual-nda.pdf"`.
- [ ] Simulate or trigger a server error and confirm the UI shows a readable error message.
- [ ] If the server returns field errors, confirm they are surfaced inline in the form.

## Cross-browser matrix
Repeat the successful-download and validation smoke tests in:
- [ ] Chromium / Chrome / Edge
- [ ] Firefox
- [ ] Playwright WebKit smoke coverage
- [ ] Real Safari manual verification, if Safari support is a release requirement

For each browser/engine, also confirm:
- [ ] Blob download starts correctly from the synthetic anchor click.
- [ ] Immediate `URL.revokeObjectURL()` does not interrupt the download.
- [ ] Date inputs remain usable.
- [ ] Radio controls are keyboard accessible.
- [ ] Number inputs still respect the validation flow.
