# NCA Clinic — Nyein Chan Aung Clinic Management System

A full-stack clinic management system: patients, appointments, billing,
pharmacy inventory, and staff accounts, plus a self-service patient portal.
Bilingual (English / Burmese).

## Stack

- Next.js 16 (App Router, TypeScript, Server Actions)
- PostgreSQL + Prisma ORM
- Auth.js (NextAuth v5) — credentials login, JWT sessions, role-based access
- next-intl — `/en` and `/my` locales
- Tailwind CSS + shadcn/ui

## Roles

- **Admin** — full access, manages staff accounts
- **Doctor** — own appointments, patient charts, writes prescriptions
- **Receptionist** — patients, appointments, billing
- **Pharmacist** — inventory, fulfills prescriptions
- **Lab Technician** — test catalog, sample collection, result entry
- **Patient** — self-registers, requests appointments, views own invoices

## Local development

1. Start the dev database:
   ```bash
   docker compose up -d
   ```
2. Copy env vars (already done if `.env` exists) and adjust as needed:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies and apply migrations:
   ```bash
   npm install
   npx prisma migrate dev
   npx prisma db seed
   ```
4. Run the app:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000.

### Seeded accounts (password: `password123`)

| Role         | Email                     |
| ------------ | ------------------------- |
| Admin        | admin@nca.clinic          |
| Doctor       | doctor@nca.clinic         |
| Receptionist | receptionist@nca.clinic   |
| Pharmacist   | pharmacist@nca.clinic     |
| Lab Technician | lab@nca.clinic          |
| Patient      | patient@example.com       |

### Running the test suite

End-to-end tests ([Playwright](https://playwright.dev)) live in `tests/e2e/` and cover
the money- and access-sensitive paths: login/password reset, invoice payments and
edits (including the PAID lock and admin payment void), prescription → auto-invoice
creation, and cross-account access control (a patient or doctor can't view another's
records). They run against your local dev database — a fresh `next dev` server is
started automatically if one isn't already running — and each test creates and
cleans up its own fixture data, so it's safe to run against a database with real
seeded/demo data in it.

```bash
npm test          # run the full suite headlessly
npm run test:ui   # interactive UI mode, useful while writing new tests
```

## Environment variables

| Variable       | Required | Notes                                                                 |
| -------------- | -------- | ---------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | Postgres connection string.                                            |
| `AUTH_SECRET`  | Yes      | Generate with `npx auth secret`. Must be set in production.            |
| `AUTH_URL`     | Prod only | Set to your deployed URL (e.g. `https://nca-clinic.vercel.app`) if Auth.js can't infer it from request headers. |
| `TELEGRAM_BOT_TOKEN` | Optional | Enables Telegram notifications. Create a bot via [@BotFather](https://t.me/BotFather) (`/newbot`) and paste the token it gives you. |
| `TELEGRAM_BOT_USERNAME` | Optional | The bot's `@username` (without the `@`), used to build the patient "Connect Telegram" deep link. |
| `TELEGRAM_WEBHOOK_SECRET` | Recommended | Any random string. Verifies incoming webhook calls really come from Telegram (checked against the `X-Telegram-Bot-Api-Secret-Token` header). |
| `CRON_SECRET` | Recommended | Any random string. Protects `/api/cron/pill-reminders`; Vercel automatically sends it as `Authorization: Bearer <value>` for its own Cron Jobs. |

## Telegram notifications (optional)

When configured, the bot sends:
- **To patients** (once they connect their account): appointment confirmed / cancelled, appointment
  reminders, pill reminders, password reset links, lab results ready.
- **To a staff chat** (set by an Admin on the Settings page): new appointment requests, low-stock
  alerts, lab results ready, patient-initiated cancellations (see below).

A connected patient can also reply with one of three commands, without logging into the portal
([src/app/api/telegram/webhook/route.ts](src/app/api/telegram/webhook/route.ts)):

- **CANCEL** — cancels their own next upcoming confirmed appointment.
- **CHECK IN** — self-check-in for an appointment that's within the same 30-minutes-before /
  60-minutes-after window used on the portal (`src/lib/queue.ts`), replying with their queue position.
- **CHAT \<message\>** — forwards the message to the clinic's shared staff Telegram chat, prefixed
  with the patient's name. Staff reply by using Telegram's native **Reply** on that specific message;
  the bot detects the reply and relays it back to that same patient's chat — no separate app or login
  needed on the staff side either.

For all three, if there's more than one matching appointment the bot lists them and asks the patient
to use the portal instead, rather than guessing which one they meant. Any other message gets a
generic "I didn't understand that" reply listing the available commands.

Setup:
1. Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and `TELEGRAM_WEBHOOK_SECRET` to your env.
2. Register the webhook so Telegram knows where to send updates — needs a public HTTPS URL pointing at `/api/telegram/webhook`:
   - **Production**: once deployed, run this once (replace values):
     ```bash
     curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
       -H "Content-Type: application/json" \
       -d '{"url":"https://<your-domain>/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
     ```
   - **Local dev**: Telegram can't reach `localhost`, so use a tunnel (e.g. `ngrok http 3000`) and point `setWebhook` at the tunnel's HTTPS URL instead. Free ngrok URLs change every restart, so you'll need to re-run `setWebhook` each session.
3. Patients connect their own account from the "Telegram notifications" card on their portal dashboard (only shows once `TELEGRAM_BOT_USERNAME` is set).
4. For the staff chat: message your bot directly (or add it to a group), find that chat's ID via a helper bot like [@userinfobot](https://t.me/userinfobot), and paste it into **Settings → Staff Telegram chat ID** as an Admin.

Everything degrades gracefully if unset — no env vars means no Telegram UI shown and notifications are silently skipped.

## Pill reminders

When a doctor writes a prescription, they can optionally set **"times per day"** and
**"for how many days"** per medicine. As soon as the prescription is saved, reminder
times are pre-computed (e.g. 3x/day → 8am, 2pm, 8pm) and stored as `PillReminder` rows —
the patient can see the full dosing schedule on their Calendar right away, regardless of
whether the pharmacist has fulfilled it yet or the patient has connected Telegram. A cron
endpoint (`/api/cron/pill-reminders`) additionally sends any reminder whose time has
passed to the patient's connected Telegram (if any), then marks it sent — so running it
repeatedly never double-sends, and skipping Telegram setup entirely just means no chat
message goes out while the calendar schedule still works.

**Scheduling it:**
- `vercel.json` includes a daily cron (`0 8 * * *`) as a safe default that won't fail
  deployment on Vercel's free Hobby plan (which only allows once-a-day cron jobs).
- For reminders to actually land near their intended time during the day, point a
  free external scheduler — e.g. [cron-job.org](https://cron-job.org) or a scheduled
  GitHub Actions workflow — at `GET https://<your-domain>/api/cron/pill-reminders`
  every 15–30 minutes, with header `Authorization: Bearer <CRON_SECRET>`. This works
  regardless of your Vercel plan. (Vercel Pro also supports finer-grained cron directly
  in `vercel.json` if you'd rather not use an external service.)
- Locally, just `curl` it with the same header to test.

## Appointment reminders

A cron endpoint (`/api/cron/appointment-reminders`) finds `CONFIRMED` appointments
scheduled within the next 24 hours that haven't had a reminder sent yet, sends a
Telegram message to the patient (if connected), and marks them so the same reminder
is never sent twice. Uses the same `CRON_SECRET`-protected pattern and Vercel Hobby-safe
daily schedule as pill reminders — see that section above for the external-scheduler
recommendation if you want it to actually fire close to 24 hours out.

## Password reset

Patients can request a reset link from **Forgot your password?** on the login page.
If their account has Telegram connected, a one-hour reset link is sent there; the
response is intentionally generic either way, so it never reveals whether an email
is registered. Staff accounts (and patients without Telegram) don't have a self-service
path — an Admin can set a new password directly for any staff member from **Staff**,
or for a patient from that patient's detail page.

## Calendar

Staff (Admin/Doctor/Receptionist) get a **List / Calendar** toggle on the Appointments
page — the calendar view is a month grid with appointments plotted on their date,
color-coded by status, click through to the appointment. Doctors see only their own;
Admin/Receptionist see the whole clinic. Patients get the same toggle on their own
"My Appointments" page, scoped to their own appointments.

## Patient self-cancel

Patients can cancel their own **requested** or **confirmed** appointments directly from the
portal (dashboard, "My Appointments" list, and the appointment detail page) — no staff
involvement or Telegram required. Once an appointment is checked in, the Cancel option
disappears; from that point only staff can cancel it, since the patient is already at the
clinic. Cancelling notifies the staff Telegram chat (if configured) rather than the patient
themselves, mirroring the existing Telegram **CANCEL** command.

## Queue & no-shows

Confirmed appointments only enter the doctor-facing "in queue" list once checked in — the
`/staff/queue` page's "Waiting to check in" section just lists `CONFIRMED` appointments
scheduled today, and there's no automatic timeout. If a patient doesn't show up, Admin/
Receptionist (or the assigned doctor, from the appointment page) can mark the appointment as
**No-show** instead of leaving it `CONFIRMED` indefinitely or using Cancel (which is meant for
appointments the patient/clinic called off ahead of time). No-show is a distinct terminal status
so it's never confused with a cancellation in the patient's history or the Reports page's
appointments-by-status breakdown, and — like Cancel — it's only available while the appointment
is still `CONFIRMED`.

## Doctor availability

Each doctor has a weekly schedule (working days + optional start/end time override) and a
list of specific leave days. The weekly schedule is Admin-managed from **Staff → \[doctor\]
→ Manage availability** — it changes rarely and is treated like other business-level settings
(e.g. consultation fee). Leave days are the time-sensitive case, so a doctor can also manage
their own from **My Availability** in their own console — no Admin needed to block off a sick
day or vacation. Both surfaces edit the same data; a doctor can only add/remove their own leave
days, not another doctor's. Patients can see a doctor's specialty, consultation fee, and
working days/hours themselves — click through from **Find Doctors** to a doctor's profile
(`/portal/doctors/[id]`), which also links straight to requesting an appointment with them.
Booking respects all of this:

- **Leave days** are a hard block for everyone — neither a patient requesting an appointment
  nor staff booking one directly can schedule a doctor on a day they're marked as on leave.
- **Working days / hours** are enforced for patient self-service booking only (in addition to
  the clinic's own opening hours) — a patient can't request a slot on a day the doctor doesn't
  work, or outside that doctor's hours if one is set (otherwise it falls back to the clinic's
  default hours). Staff booking on a patient's behalf can still override this for flexibility
  (e.g. a genuine exception), same as the existing clinic-hours behavior.

## Reports: no-show tracking & CSV export

The Reports page (Admin only) includes a **No-show rate** stat and a **No-shows by doctor**
breakdown, computed from the `NO_SHOW` appointment status above. An **Export CSV** button
downloads the full report (revenue by month, appointments by status, top medicines, no-shows
by doctor) as a single CSV file via `GET /api/reports/export` — also Admin-only.

## Medical records

Every record (a doctor's note, or an uploaded document) tracks who authored it. Patients see
their full record in **Settings → Profile** and can upload their own documents there (e.g.
prior medical history from before they were a patient here). A patient can remove a record
only if they authored it themselves — a doctor's note or a document staff uploaded on their
behalf shows no Remove option, so the clinic's own record of a visit can't be edited away by
the patient.

## Laboratory

A full lab workflow, run by the **Lab Technician** role (also usable by Admin):

- **Test catalog** — `/staff/lab` lists available tests (name, price, unit, normal
  range); new ones are added at `/staff/lab-tests/new`.
- **Ordering** — a doctor orders one or more catalog tests for a patient from the
  appointment page (same-day-only, mirroring the prescription cutoff), creating a
  `LabOrder` with one `LabOrderItem` per test.
- **Sample collection** — the Lab console's Pending Orders section has a one-click
  "Collect sample" action per order, moving it from `ORDERED` to `SAMPLE_COLLECTED`.
- **Result entry** — once collected, the lab tech enters a result value and optional
  note per test at `/staff/lab/[id]`, which marks the order `COMPLETED`.
- **Report printing** — a shared, chrome-free report view at `/lab-report/[id]`
  (with a Print button) is reachable by the ordering doctor, Admin/Receptionist/Lab
  Tech, and the patient themselves (via **Lab Results** in their portal) — anyone
  else gets a 404.
- **Doctor notifications** — completing an order sends a Telegram message to the
  shared staff chat (naming the ordering doctor) and to the patient directly, via
  the same Telegram setup used elsewhere in this app.

## Deploying (Vercel + Neon/Supabase)

1. **Database**: create a free Postgres instance on [Neon](https://neon.tech) or [Supabase](https://supabase.com). Copy its pooled connection string.
2. **Vercel project**: import this repo, set the environment variables above (`DATABASE_URL`, `AUTH_SECRET`) in the Vercel dashboard.
3. **Migrations**: run `npx prisma migrate deploy` against the production `DATABASE_URL` (e.g. from your local machine or a CI step) before/after the first deploy — this applies committed migrations without generating new ones.
4. **Seed (optional)**: run `npx prisma db seed` once against production if you want the same demo accounts; otherwise create your first `ADMIN` user directly via a one-off script or by temporarily relaxing the staff-creation route.
5. Deploy. Vercel builds with `next build` automatically; no extra config needed beyond the env vars.

## Project structure

- `prisma/schema.prisma` — data model
- `src/auth.ts` — Auth.js config (Credentials provider, JWT session, role claims)
- `src/proxy.ts` — locale routing + auth/role route protection (Next.js 16 renamed `middleware.ts` → `proxy.ts`)
- `src/i18n/` — next-intl routing/navigation config; `messages/en.json`, `messages/my.json`
- `src/actions/` — Server Actions per module (patients, appointments, billing, inventory, prescriptions, staff, auth)
- `src/app/[locale]/staff/**` — staff-facing pages (role-gated per page)
- `src/app/[locale]/portal/**` — patient-facing pages
