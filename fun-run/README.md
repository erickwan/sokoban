# Peninsula Bridge Fun Run 2026 — Registration Site

A registration website for the Peninsula Bridge Fun Run on **Sunday, October 4, 2026 at Menlo School**. It runs as a Google Apps Script web app bound to a Google Sheet, so it is free to host, publicly accessible, and every registration lands directly in the spreadsheet.

## What it does

- Registers **multiple participants** in one submission (name, category, t-shirt size per runner, plus one contact per group). The category dropdown covers Student Grades 6–12, Alum, Faculty/Staff, Parent/Guardian, Sibling Under/Over 10, and Other with a fill-in field.
- Assigns each participant a **unique bib number starting at 1**. Assignment happens server-side under a `LockService` lock, so simultaneous submissions can never receive duplicate bibs. The last-assigned number is tracked in Script Properties *and* cross-checked against the sheet, so bibs are never reused even if rows are deleted or edited.
- After submitting, shows a confirmation with a **suggested donation of $25 per participant**, with a button to Peninsula Bridge's donation page (`https://givebutter.com/peninsula-bridge-fun-run-2026`).
- **Free T-shirts for the first 100 participants**: once 100 participants are registered, the shirt-size picker is replaced with a friendly "all free tees claimed" note. The cutoff uses a dedicated participant counter (`participantCount` in Script Properties, cross-checked against the sheet's row count) — deliberately independent of bib numbers, so bib allocation logic can change freely. Eligibility is enforced server-side under the same lock as bib assignment, so the 100th shirt can't be double-claimed; if shirts run out mid-submission, the confirmation screen says which runners missed out.
- **Confirmation email**: after a successful registration the contact receives a branded HTML email (plain-text fallback) with the event details, their runners (category and shirt size on the public form), the suggested-donation link (public only), and who to contact for changes — Janice/Kavya for public registrations, Suzanne for `?pb=1`. Sent via `MailApp` after the rows are written; a mail failure never fails the registration. Note: deploying this adds a mail permission (re-authorize when prompted), and consumer accounts can send ~100/day.
- **Registration kill switch**: when it's time to stop taking sign-ups, set the Script Property `REGISTRATION_CLOSED` to `true` (see *Closing registration* below) — no redeploy needed. The form is replaced by a "Registration is now closed — feel free to show up on the day of; there will be a limited number of bibs with timers for unregistered runners, first come, first served" note, with the donation link still shown for late runners (except on `?pb=1`, which never shows donations). The server also rejects submissions while closed, so a stale open tab can't sneak one in.
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

## Making changes / setting up next year

All year-specific values live in one `CONFIG` object at the top of each file:

- **`Code.gs` CONFIG** — event title/date/place/times (used in the confirmation email), donation amount and link, shirt limit, first bib, max runners per submission, organizer contacts (public + pb), category and shirt-size lists, and the sponsor rows the `Sponsors` tab is seeded with on first use.
- **`Index.html` CONFIG** — everything the registration page shows: title, hero date, event details, the blurb, contacts (public + pb), donation amount/link/button, shirt limit and sizes, categories, confirmation copy, footer. The markup contains no event text — it is all rendered from CONFIG.
- **`Admin.html` CONFIG** — just the dashboard's eyebrow line; category/size orders come from the server once logged in.

For a new year: update the three CONFIG blocks consistently (donation amount, shirt limit, sizes, and categories appear in both `Code.gs` and `Index.html`), swap the hero photos and (if the branding changes) the event logo in `Index.html` if desired — the logo is the `#heroLogo` data-URI image at the top of the race-bib card, shown on both the public and `?pb=1` pages, and a small version of it is the favicon on both pages, then `clasp push` + `clasp deploy -i <id>` and update the GitHub Pages copies. Operationally also: make a fresh registration spreadsheet (or run `resetForLaunch`), create the new year's Givebutter page, refresh the `Sponsors` tab, set `ADMIN_PASSWORD`, and regenerate the QR codes for the new links.

- **Sponsors during the season**: no code change needed — use the dashboard's Sponsors panel (or edit the `Sponsors` sheet tab directly).

## Closing registration

No code change or redeploy — it's a Script Property, read live on every request:

1. Open the registration spreadsheet → **Extensions → Apps Script** → **Project Settings (gear icon) → Script properties**.
2. **Add script property**: name `REGISTRATION_CLOSED`, value `true` (case and surrounding spaces don't matter), then **Save**.
3. Both the public page and `?pb=1` immediately hide the form and show the "Registration is now closed" note (public keeps the donation link for race-day walk-ups); the server rejects any submission while the property is set.
4. To reopen, delete the property or set it to anything other than `true`.

The closed-state wording lives in `CONFIG` (`closedMessage` in `Code.gs` for the server-side rejection; `closedTitle`/`closedHtml`/`closedDonateHeading`/`closedDonateHtml`/`pbClosedLede` in `Index.html` for the page).
- After editing code, redeploy via clasp (`clasp push` + `clasp deploy -i <id>`) or **Deploy → Manage deployments → Edit → New version** (the URL stays the same).

## Deploying with clasp (no more copy-paste)

One-time setup:

1. Enable the Apps Script API for your account: https://script.google.com/home/usersettings -> "Google Apps Script API" -> On.
2. `npm install -g @google/clasp`, then `clasp login`.
3. In a clone of this repo: `cp .clasp.json.example .clasp.json` and paste your Script ID into it (Apps Script editor -> Project Settings (gear) -> IDs).
4. `clasp pull` once — this fetches `appsscript.json` (the project manifest) into the repo; commit it. If the pull also rewrites Code.gs/Index.html/Admin.html with older content, restore them with `git checkout -- Code.gs Index.html Admin.html` (the repo is the source of truth).
5. Note your deployment ID: Deploy -> Manage deployments (the `AKfycb...` ID from the /exec URL).

Every update after that:

```bash
git pull
clasp push                     # upload Code.gs / Index.html / Admin.html
clasp deploy -i DEPLOYMENT_ID  # bump the live /exec deployment to a new version
```

`.clasp.json` is gitignored (it is per-user); `.claspignore` limits pushes to the three project files plus the manifest. Caveats: `clasp push` overwrites the online project, so stop hand-editing in the online editor; and authorization prompts for newly required permissions (like the mail scope) still need a one-time manual Run from the editor.

## Static hosting on GitHub Pages (optional)

Some signed-in Google users hit a Drive "unable to open the file" page on `script.google.com` URLs (Google's multi-account session routing). Both pages also run from any static host: copy `Index.html` -> `index.html` and `Admin.html` -> `admin.html` into a public GitHub Pages repo and set the `SCRIPT_URL` constant near the top of each file's script to the web app `/exec` URL. The pages then call the backend's JSON API (`doPost` in `Code.gs`) over anonymous `fetch()`, which bypasses Google's account routing entirely. The Apps Script URLs keep working unchanged; `?pb=1` works on the static copy too, and the dashboard becomes `admin.html`.

## Team testing before launch

Two isolation options — the staging copy is the recommended one:

1. **Staging deployment (recommended).** A test copy of the sheet exists in Drive: **TEST - Peninsula Bridge Fun Run 2026 - Registrations**. Follow the same deploy steps inside *that* copy (Extensions → Apps Script → paste both files → deploy as web app) and share the resulting URL with the team. Counters live in each Apps Script project's own Script Properties plus its own sheet, so the test deployment's bib numbers and shirt count are completely independent — the real site still launches at bib 1 with all 100 shirts. To rehearse the shirt cutoff, temporarily set `SHIRT_LIMIT` to something small (e.g. 3) in both files of the test copy only.

2. **`resetForLaunch()`.** If test registrations ever land in the real sheet, open its Apps Script editor, pick `resetForLaunch` in the function dropdown, and click Run. It deletes all registration rows and resets the bib and shirt counters to their starting state — so run it only before launch, never after real registrations exist.

## Bulk reminder emails

`Code.gs` has an editor-run reminder flow: one email per group contact with the event details, their registered runners, and a **Donate $25 × runners** button (PB family groups get Suzanne as the contact and no donation ask, like the rest of the site). From the Apps Script editor:

1. Run **`previewReminderEmails`** — logs every would-be recipient (View → Executions → the run's log) and sends nothing.
2. Optionally run **`sendTestReminderEmail`** — one sample (with the donate button) to your own inbox.
3. Run **`sendReminderEmails`** — sends for real, one per unique contact email (case-insensitive; rows with malformed emails are skipped), and logs a summary. It refuses to start if the remaining MailApp daily quota (~100/day on consumer accounts) can't cover every group; re-running after a partial failure re-emails contacts that already got one.

## Sharing results

Share the Google Sheet with coworkers as usual (the web app keeps working regardless of who the sheet is shared with). Only the sheet owner's deployment writes to it — visitors never need Google accounts.
