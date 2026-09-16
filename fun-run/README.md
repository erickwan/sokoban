# Peninsula Bridge Fun Run 2026 — Registration Site

A registration website for the Peninsula Bridge Fun Run on **Sunday, October 4, 2026 at Menlo School**. It runs as a Google Apps Script web app bound to a Google Sheet, so it is free to host, publicly accessible, and every registration lands directly in the spreadsheet.

## What it does

- Registers **multiple participants** in one submission (name, category, t-shirt size per runner, plus one contact per group). The category dropdown covers Student Grades 6–12, Alum, Faculty/Staff, Parent/Guardian, Sibling Under/Over 10, and Other with a fill-in field.
- Assigns each participant a **unique bib number starting at 1**. Assignment happens server-side under a `LockService` lock, so simultaneous submissions can never receive duplicate bibs. The last-assigned number is tracked in Script Properties *and* cross-checked against the sheet, so bibs are never reused even if rows are deleted or edited.
- After submitting, shows a confirmation with a **suggested donation of $25 per participant**, with a button to Peninsula Bridge's donation page (`https://givebutter.com/peninsula-bridge-fun-run-2026`).
- **Free T-shirts for the first 100 participants**: once 100 participants are registered, the shirt-size picker is replaced with a friendly "all free tees claimed" note. The cutoff uses a dedicated participant counter (`participantCount` in Script Properties, cross-checked against the sheet's row count) — deliberately independent of bib numbers, so bib allocation logic can change freely. Eligibility is enforced server-side under the same lock as bib assignment, so the 100th shirt can't be double-claimed; if shirts run out mid-submission, the confirmation screen says which runners missed out.
- **Confirmation email**: after a successful registration the contact receives a branded HTML email (plain-text fallback) with the event details, their runners (category and shirt size on the public form), the suggested-donation link (public only), and who to contact for changes — Janice/Kavya for public registrations, Suzanne for `?pb=1`. Sent via `MailApp` after the rows are written; a mail failure never fails the registration. Note: deploying this adds a mail permission (re-authorize when prompted), and consumer accounts can send ~100/day.
- **Duplicate guard**: a submission whose runners are already registered under the same contact email is rejected with a friendly message naming them (and pointing to the organizers for changes), so double-clicks and re-submissions can't create duplicate rows or consume extra shirt slots. Enforced server-side under the same lock as bib assignment.
- Appends one row per participant to the Google Sheet: `Bib #, First Name, Last Name, Mother's Maiden Name, Category, T-Shirt Size, Contact Name, Contact Email, Contact Phone, Registered At`. The header row is kept in sync automatically (`ensureHeader_`), so column changes in `Code.gs` show up in the sheet on the next submission.

- **Peninsula Bridge family variant** at `<web app URL>?pb=1`: the runner card asks for first name, **father's surname**, and **mother's maiden name** (no last-name field), the category is hidden and recorded as `Peninsula Bridge`, there is no T-shirt picker, and no suggested donation is shown anywhere. Father's surname is stored in the Last Name column; the maiden name goes in its own column. PB registrations get bibs and count as participants, but do **not** consume the 100 free-tee slots (they can never claim one).
- **Password-protected organizer dashboard** at `<web app URL>?page=admin`: number of families (unique contact emails), total participants, a cumulative sign-ups-over-time chart, runners by category, claimed T-shirts by size, and a **sponsor manager** — organizers add a sponsor (name, website link, and a logo URL or an uploaded image, auto-compressed in the browser) or remove one, and the public page updates immediately. Sponsors live in a `Sponsors` tab of the spreadsheet (auto-created and seeded with the launch sponsors on first use); row order there is display order. The password is checked server-side (stats are never sent to the browser without it) and lives in Script Properties, not in the code.

## Files

- `Index.html` — the registration page (form + confirmation screen). Also works standalone as a design preview: when not served by Apps Script it simulates bib numbers and saves nothing.
- `Admin.html` — the organizer dashboard (login + summary). Standalone it shows clearly-labeled sample data.
- `Code.gs` — the Apps Script backend: serves both pages, records submissions, and computes dashboard stats.

## Deploying (one-time, ~5 minutes)

1. Open the registration spreadsheet: **Peninsula Bridge Fun Run 2026 - Registrations** (already created, with the header row in place).
2. In the sheet, go to **Extensions → Apps Script**.
3. In the editor, replace the contents of `Code.gs` with this repo's `Code.gs`.
4. Click **+** next to *Files* → **HTML**, name it exactly `Index`, and paste in this repo's `Index.html` (the whole file). Repeat for a second HTML file named exactly `Admin` with this repo's `Admin.html`.
5. Set the dashboard password: **Project Settings (gear icon) → Script properties → Add script property** — name `ADMIN_PASSWORD`, value = the password to share with organizers.
6. Click **Deploy → New deployment → Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
7. Authorize when prompted, then copy the web app URL — that's the public registration link to share with participants. The organizer dashboard is the same URL with `?page=admin` appended.

## Making changes

- **Donation amount**: `DONATION_PER_RUNNER` in both `Code.gs` and `Index.html`.
- **Shirt limit**: `SHIRT_LIMIT` in both `Code.gs` and `Index.html`.
- **Donation link**: the `donateLink` anchor in `Index.html`.
- **Shirt sizes / categories**: `SHIRT_SIZES` and `CATEGORIES` in `Index.html` (category columns also flow through `HEADERS` and `submitRegistration` in `Code.gs`).
- **Sponsors**: no code change needed — use the dashboard's Sponsors panel (or edit the `Sponsors` sheet tab directly).
- After editing code, redeploy via **Deploy → Manage deployments → Edit → New version** (the URL stays the same).

## Static hosting on GitHub Pages (optional)

Some signed-in Google users hit a Drive "unable to open the file" page on `script.google.com` URLs (Google's multi-account session routing). Both pages also run from any static host: copy `Index.html` -> `index.html` and `Admin.html` -> `admin.html` into a public GitHub Pages repo and set the `SCRIPT_URL` constant near the top of each file's script to the web app `/exec` URL. The pages then call the backend's JSON API (`doPost` in `Code.gs`) over anonymous `fetch()`, which bypasses Google's account routing entirely. The Apps Script URLs keep working unchanged; `?pb=1` works on the static copy too, and the dashboard becomes `admin.html`.

## Team testing before launch

Two isolation options — the staging copy is the recommended one:

1. **Staging deployment (recommended).** A test copy of the sheet exists in Drive: **TEST - Peninsula Bridge Fun Run 2026 - Registrations**. Follow the same deploy steps inside *that* copy (Extensions → Apps Script → paste both files → deploy as web app) and share the resulting URL with the team. Counters live in each Apps Script project's own Script Properties plus its own sheet, so the test deployment's bib numbers and shirt count are completely independent — the real site still launches at bib 1 with all 100 shirts. To rehearse the shirt cutoff, temporarily set `SHIRT_LIMIT` to something small (e.g. 3) in both files of the test copy only.

2. **`resetForLaunch()`.** If test registrations ever land in the real sheet, open its Apps Script editor, pick `resetForLaunch` in the function dropdown, and click Run. It deletes all registration rows and resets the bib and shirt counters to their starting state — so run it only before launch, never after real registrations exist.

## Sharing results

Share the Google Sheet with coworkers as usual (the web app keeps working regardless of who the sheet is shared with). Only the sheet owner's deployment writes to it — visitors never need Google accounts.
