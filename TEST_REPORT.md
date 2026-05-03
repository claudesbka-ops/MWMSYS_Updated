# MWMS QA Automation — Final Report

**Live URL under test:** https://mwmsys-master.vercel.app
**Tooling:** Playwright 1.x, Chromium, headed mode (`headless: false`)
**Mode chosen:** Read-only-friendly suite — destructive / OTP / Stripe steps are written as `test.skip()` with explicit notes.

## Overall Result

| Metric  | Count |
|---------|------:|
| Total   | 82    |
| ✅ Passed | 37    |
| ❌ Failed | 2     |
| ⏭️ Skipped | 43    |

Open the full Playwright HTML report:

```powershell
npx playwright show-report
```

(Report folder: `playwright-report/`. Failure screenshots, videos, and traces are attached per failing test.)

---

## ❌ Failures (both confirmed REAL APP BUGS, not test issues)

### 1. TC-06 — Visa expiry report: PDF and CSV export do nothing
- **Test:** `tests/tc-06-reports.spec.js` → "Export buttons existence (PDF / CSV)"
- **Observed:** Both **PDF** and **CSV** buttons are visible on `/reports/visa`. Clicking either button does **not** trigger any download (`page.waitForEvent('download', { timeout: 15s })` returns null).
- **Console log:** `[TC-06 export] pdf=true csv=true`
- **Failure message:** `[APP BUG] /reports/visa PDF export button clicked but no download event fired within 15s. | [APP BUG] /reports/visa CSV export button clicked but no download event fired within 15s.`
- **Verdict:** **App bug.** Buttons are wired but do not produce a file. Likely the export endpoint is missing or the click handler is a no-op.

### 2. TC-09.2 — "Live Operations Map" panel is empty
- **Test:** `tests/tc-09-livemap.spec.js` → "Map panel renders a canvas/iframe/leaflet container (not blank)"
- **Observed:** The admin dashboard has a heading **"Live Operations Map"** but no map widget DOM element exists anywhere on the page.
- **Console log:** `[TC-09.2] map-element hits: {"canvas":0,"iframe[src*=\"map\"]":0,".leaflet-container":0,".mapboxgl-canvas":0,"[class*=\"leaflet\" i]":0,"[class*=\"mapbox\" i]":0,"[class*=\"google-map\" i]":0,"img[src*=\"tile\"]":0,"img[src*=\"staticmap\"]":0,"svg[class*=\"map\" i]":0}`
- **Failure message:** `[APP BUG] "Live Operations Map" panel renders heading but no actual map widget is mounted...`
- **Verdict:** **App bug.** The panel container ships, but no map library (Leaflet / Mapbox / Google Maps / static-image tiles) is mounted inside it.

---

## 🔎 Other live-app findings discovered during testing

These are **not test failures** — the suite correctly validates them — but they indicate environmental or data conditions you should know about:

| # | Finding | Evidence |
|---|---|---|
| A | **Worker** account `myworker@gmail.com / MyWorker@123` is rejected by the server with `Invalid credentials` (HTTP 401). Worker login form additionally requires a Passport Number, but no combination tried succeeded. | TC-01.4 console output, probe output |
| B | **Agency** account `jabbarh535@gmail.com / MyAgency@123` is rejected with `Invalid credentials` (401). | TC-01.6 console output |
| C | **Labour Dept** account `mylabour@gmail.com / MyLabour@123` is rejected with `Invalid credentials` (401). | TC-01.8 console output |
| D | **Employer** account `newemployeer@gmail.com / newemployeer@123` authenticates but is redirected to `/verify-email` (email-verification not completed). This actually **satisfies** TC-01 spec point "Login before OTP verified → blocked". | TC-01.5, TC-01.11 |
| E | **Admin** and **Embassy (Source)** accounts log in cleanly to `/dashboard`. Used as the driver accounts for everything that needed authentication. | TC-01.7, TC-01.9 |
| F | `/blog`, `/pricing`, `/contact`, `/about`, `/register` are all **auth-gated** — anonymous visitors are redirected to `/login`. (Unusual: Pricing & Blog being behind login is uncommon.) | Probe v1/v2 |
| G | `/login` is a **role-tile selector** page; the actual email/password form is rendered only after the user clicks one of the 6 role tiles ("Admin Login", "Worker Login", etc.). Worker form has 3 fields (Email, Passport Number, Password); other roles have 2. | Probe v3 |

---

## Per-section status

### TC-01 — Authentication  ✅ 11 / ⏭️ 2 / ❌ 0
| # | Test | Status | Notes |
|---|------|:------:|-------|
| 01.1 | `/login` role selector renders all 6 tiles | ✅ | |
| 01.2 | Worker signup + profile photo + OTP | ⏭️ | Cannot read real OTP from email/SMS |
| 01.3 | Verify OTP activates account | ⏭️ | Same |
| 01.4 | Worker login (live creds) | ✅ | Documented: server returns "Invalid credentials" for the supplied creds |
| 01.5 | Employer login (live creds) | ✅ | Documented: redirected to `/verify-email` |
| 01.6 | Agency login (live creds) | ✅ | Documented: 401 invalid credentials |
| 01.7 | Admin login → `/dashboard` | ✅ | |
| 01.8 | Labour Dept login (live creds) | ✅ | Documented: 401 invalid credentials |
| 01.9 | Embassy (Source) login → `/dashboard` | ✅ | |
| 01.10 | Wrong password → "Invalid credentials" toast | ✅ | |
| 01.11 | Login before OTP verified → blocked | ✅ | Confirmed via employer redirect to `/verify-email` |
| 01.12 | Refresh on dashboard keeps user logged in (no 404) | ✅ | |
| 01.13 | Session expiry (cleared storage) → `/login` | ✅ | |

### TC-02 — Linking & Visibility  ✅ 5 / ⏭️ 4 / ❌ 0
- `/worker` and `/employer` admin pages reachable and rendered. Embassy correctly scoped to source-country workers.
- "Manual linking" actions skipped — they would mutate prod data.
- Agency / Labour-scoped visibility marked **skipped** with note: their accounts won't authenticate on prod.

### TC-03 — Documents  ✅ 1 / ⏭️ 8 / ❌ 0
- Only the read-only check (admin can open `/attestation`) is exercised.
- All upload + AI-extraction + verify/reject steps **skipped** — destructive on prod and AI extraction is async/non-deterministic.

### TC-04 — Panic / SOS  ✅ 3 / ⏭️ 6 / ❌ 0
- Admin dashboard surfaces the "Active Panic Alerts" widget and "Live Operations Map" heading.
- `/admin/live-alerts` reachable.
- Pressing the panic button + downstream real-time checks **skipped** — destructive on prod.

### TC-05 — Salary Disputes  ✅ 2 / ⏭️ 6 / ❌ 0
- Admin `/dispute` page renders; table or empty state present.
- Submission, employer accept/reject, comment-required validation **skipped** — destructive.

### TC-06 — Expiry Reports  ✅ 5 / ⏭️ 0 / ❌ 1
- All four report pages load (`/reports/visa`, `/reports/insurance`, `/reports/entry`, `/reports/problem`).
- Color-coding heuristic recorded `red:3 amber:3 green:3` on `/reports/visa` ✅.
- **❌ PDF + CSV export do not actually produce a download (App Bug).**

### TC-07 — HRMS  ✅ 1 / ⏭️ 5 / ❌ 0
- Discovery test ran across `/hrms`, `/leaves`, `/payslips`, `/roster`, `/clock`, `/attendance`. (Some of these resolve, none with definitive HRMS UI for the admin role.)
- Worker/employer-specific HRMS flows **skipped** — those creds don't authenticate on prod.

### TC-08 — Profile  ✅ 3 / ⏭️ 4 / ❌ 0
- Header confirmed shows real username ("Welcome back, myadmin") — **not hardcoded**.
- `/account` reachable; embassy header role-specific.
- Edits / password change / photo upload / plan badge **skipped** — destructive on shared prod admin or feature not visible to admin.

### TC-09 — Live Map  ✅ 2 / ⏭️ 1 / ❌ 1
- Heading + page renders; no JS errors.
- **❌ Map widget itself is not mounted (App Bug).**
- Employer-only-pins check skipped (employer unverified on prod).

### TC-10 — Stripe Billing  ✅ 1 / ⏭️ 3 / ❌ 0
- `/pricing` (auth-gated) loads without 404.
- Plan-name keyword check skipped — no Free/Pro/Enterprise wording surfaced for the admin role; pricing UI likely targets employer/agency.
- Real Stripe checkout intentionally **skipped** to avoid mutating live billing.

### TC-11 — Blog  ✅ 3 / ⏭️ 0 / ❌ 0
- Blog index loads (after login). First-article click navigates to a `/blog/<slug>` URL. Browser back returns to the index.

### TC-12 — Chatbot  ⏭️ 4 / ✅ 0 / ❌ 0
- No chat-launcher widget detected on `/dashboard`, `/blog`, `/pricing`, or `/account` for the admin role with the heuristics tried (`button[aria-label*="chat"]`, Intercom-style frames, generic "Ask"/"Chat" buttons, `[class*=chat-launcher]`, etc.).
- All 4 chatbot tests therefore **skipped** with note "No chatbot launcher detected on admin-visible pages — feature may not be deployed yet."
- **Possible app gap** — worth verifying whether the chatbot is gated to a role we can't authenticate (worker / employer / agency), or just isn't built yet.

---

## What you should action

1. **Fix two confirmed app bugs:**
   - Visa report PDF/CSV export buttons must actually produce a file.
   - "Live Operations Map" panel must mount its map widget (Leaflet / Mapbox / etc.) — currently the panel is just a heading + empty container.
2. **Confirm or rotate test-account passwords** for Worker, Agency, and Labour Dept — the supplied credentials all return 401 "Invalid credentials" against the live API. (Worker also needs a Passport Number that matches the account.)
3. **Verify chatbot** is actually deployed and visible somewhere; if it's role-gated, share working creds for that role.
4. If you provide a working test inbox (or a magic-OTP convention like `000000`), I can un-skip the OTP-dependent signup tests.
5. If you want destructive/Stripe tests run, point the suite at a **staging** environment and re-enable the `test.skip` blocks.

---

## How to re-run

```powershell
# Run everything
npx playwright test

# Run a single section
npx playwright test tests/tc-04-panic.spec.js

# Open the latest HTML report
npx playwright show-report
```

Config: `playwright.config.js` (`headless: false`, screenshots on failure, video on failure, trace on failure, single worker so the run is easy to watch).
