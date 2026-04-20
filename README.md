# ⚡ IndustrialOS

Enterprise B2B industrial operations platform — web app + mobile app, built and ready to deploy.

## What it is

IndustrialOS is a full-stack B2B operations platform for industrial and manufacturing businesses. It covers the full order-to-cash cycle: from receiving a quote request, through order management and inventory tracking, to invoicing and payment collection.

It ships as two apps:
- A **Next.js 15 web app** for desktop operations
- An **Expo React Native mobile app** for iOS and Android

Both connect to the same PostgreSQL database. One deployment covers everything.

---

## Modules (web)

| Module | What it does |
|---|---|
| Dashboard | Live KPIs — active orders, revenue, inventory alerts, queue depth |
| Orders | Kanban board — create, advance stages, delete orders |
| Inventory | Stock levels, reorder alerts, bulk CSV import, barcode scanner (Chrome) |
| Quotes & RFQ | AI-generated quotes via Claude API, accept/decline flow |
| Invoicing | Create invoices, record partial or full payments, PDF export |
| Customers | Profiles, credit limits, order history, portal access codes |
| Suppliers | Supplier list, contact details, linked purchase orders |
| Purchase Orders | Create POs, approval threshold, auto-create from low stock |
| Shipping | Shipments, tracking numbers, carrier details |
| Returns & RMA | Return requests, approval flow, stock restoration |
| Contracts | Contract records, status tracking |
| Tickets | Internal ticketing system, comments, priority, linked records |
| AI Insights | Demand forecasting, smart reorder suggestions, supplier negotiation, price comparison — all powered by Claude API |
| Analytics | Monthly revenue, top customers, top SKUs, order mix — live from DB |
| Notifications | Bell icon — overdue invoices, low stock, new portal orders |
| Report Builder | Custom reports with column picker, date filters, CSV + PDF export |
| Data Import | Bulk CSV upload for inventory, customers, suppliers |
| System Health | DB ping, API status, uptime display |
| EDI | X12 and EDIFACT partner setup, inbound/outbound transaction log |
| CRM | UI panel for Salesforce, HubSpot, Zoho — wire up via API keys in `.env.local` |

---

## Mobile app screens

Dashboard, Orders (full CRUD), Inventory, Shipments, Quotes, Customers, Suppliers, Returns, Purchase Orders, Invoicing, Analytics, Contracts, Tickets, Notifications, Profile.

Feature toggles in Profile — high-priority tabs are always on, others are user-togglable. Stored in SecureStore on native, localStorage on web.

---

## Real integrations (need API keys)

| Integration | Purpose | Env var |
|---|---|---|
| PostgreSQL / Neon | Database | `DATABASE_URL` |
| NextAuth | Auth, sessions, roles | `NEXTAUTH_SECRET` |
| Claude API (Anthropic) | AI quote generation, AI Insights | `ANTHROPIC_API_KEY` |
| Resend | Email — invoices, quotes, invites | `RESEND_API_KEY` |
| Stripe | Customer portal payments | `STRIPE_SECRET_KEY` |
| Twilio | WhatsApp order stage notifications | `TWILIO_ACCOUNT_SID` |

---

## Tech stack

- **Web:** Next.js 15, React 18, TypeScript, Tailwind CSS
- **Mobile:** Expo 51, React Native 0.74, Expo Router
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** next-auth v4 (JWT, role-based: admin / operator / viewer)
- **AI:** Anthropic Claude API
- **Payments:** Stripe
- **Email:** Resend
- **Notifications:** Twilio WhatsApp

---

## Quick Start

```bash
npm install
cp .env.example .env.local
# Fill in your DATABASE_URL, NEXTAUTH_SECRET, ANTHROPIC_API_KEY at minimum
npx prisma migrate deploy
npm run dev
# → http://localhost:3000
```

Default login after seeding: `admin@demo.com` / `admin123`

---

## Deploy to Vercel

```bash
# 1. Push repo to GitHub
# 2. Import project at vercel.com
# 3. Add environment variables in Vercel dashboard
# 4. Deploy — build command is already set to: prisma generate && next build
```

---

## Docker

```bash
docker-compose up --build
```

---

## Mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or run on simulator.

To build for production:
```bash
npx eas build --platform all
```

---

## Role system

| Role | Can do |
|---|---|
| admin | Everything — including settings, user management, danger zone |
| operator | All modules — create, edit, advance |
| viewer | Read-only across all modules |

---

## Multi-tenancy

Every database record is scoped to a `workspaceId`. Multiple companies can use the same deployment without seeing each other's data.
