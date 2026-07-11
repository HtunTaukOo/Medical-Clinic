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
| Patient      | patient@example.com       |

## Environment variables

| Variable       | Required | Notes                                                                 |
| -------------- | -------- | ---------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | Postgres connection string.                                            |
| `AUTH_SECRET`  | Yes      | Generate with `npx auth secret`. Must be set in production.            |
| `AUTH_URL`     | Prod only | Set to your deployed URL (e.g. `https://nca-clinic.vercel.app`) if Auth.js can't infer it from request headers. |

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
