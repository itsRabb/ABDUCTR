<div align="center">

# 🛸 ABDUCTR

### *Abducting B2B Leads from Planet Earth*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

> A **production-grade B2B lead generation SaaS** with alien aesthetics.  
> Scrape Google Maps → enrich data → qualify leads → close deals.

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🛸 **Abduction Bay** | Puppeteer Google Maps scraper with live SSE streaming log |
| 👽 **Leads Database** | TanStack Table v8 — sort, filter, paginate, column visibility |
| 📧 **Cold Email Pipeline** | 3-worker chain: Google Maps → Website Fetcher → Email Extractor → DB |
| 🤖 **Background Server Cron** | node-cron singleton scrapes 24/7, no browser tab needed |
| 🔄 **Auto-Pilot** | Browser-driven continuous scraping with live streaming progress |
| 🔁 **Query Rotation** | Cycle through multiple business types automatically |
| 🗺️ **City Rotation** | Cycles through all US cities/states, resuming where it left off |
| 🔮 **BANT Scoring** | Auto-calculated Budget/Authority/Need/Timing score per lead |
| 🌐 **URL Email Harvester** | Paste any URL and extract all contact emails instantly |
| 🕵️ **Hunter.io Integration** | One-click email discovery per lead |
| 🛡️ **Proxy Shield** | Rotate free proxies automatically, refreshed every 30 minutes |
| ⚡ **Supabase Realtime** | Live table updates via Supabase subscriptions |
| 📤 **CSV Export** | One-click download of filtered leads |
| 🔐 **Auth** | Supabase Auth with session middleware |
| 🌌 **Animated UI** | Canvas starfield, bobbing UFOs, Framer Motion transitions |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project
- (Optional) [Hunter.io](https://hunter.io) free API key for email lookup

### 1 — Clone & Install

\\\ash
git clone https://github.com/YOUR_USERNAME/abductr.git
cd abductr
npm install
\\\

### 2 — Environment

\\\ash
cp .env.example .env.local
\\\

Fill in .env.local:

\\\env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
HUNTER_API_KEY=your-hunter-key           # optional

# Leave blank on localhost (node-cron used automatically).
# Set to your production domain to enable Supabase pg_cron mode.
NEXT_PUBLIC_APP_URL=
\\\

### 3 — Database

Open your **Supabase SQL Editor** and run:

\\\
supabase/schema.sql
\\\

Then in **Dashboard → Database → Replication**, add `leads`, `extracted_emails`, and `scrape_jobs` to the realtime publication.

### 4 — Run

\\\ash
npm run dev
# → http://localhost:3000
\\\

---

## 🗂️ Project Structure

\\\
abductr/
├── app/
│   ├── (app)/
│   │   ├── abduction/          # 🛸 Scraper UI + Proxy Shield panel
│   │   ├── leads/              # 👽 Leads table (TanStack Table v8)
│   │   ├── dashboard/          # 📊 Stats overview
│   │   └── pipeline/           # 📧 Cold Email Pipeline + Auto-Pilot + Cron
│   └── api/
│       ├── scrape/             # Puppeteer Google Maps scraper (SSE)
│       ├── pipeline/           # 3-worker orchestrator (SSE streaming)
│       ├── enrich/             # Batch enrich existing leads without emails
│       ├── cron-control/       # Start / stop / status for background cron
│       ├── proxies/            # Proxy list management
│       └── hunter/             # Hunter.io email lookup
├── lib/
│   ├── local-cron.ts           # node-cron singleton (survives hot-reload)
│   ├── types.ts
│   ├── supabase.ts
│   └── proxy-manager.ts
├── supabase/
│   └── schema.sql              # Full DB schema (idempotent)
└── .env.example
\\\

---

## � Cold Email Pipeline

The `/pipeline` page runs a **3-worker chain** via SSE streaming:

```
Worker 1 — Google Maps Scraper
  ↓  (name, address, phone, website, rating, reviews, hours, coordinates)
Worker 2 — Website Fetcher
  ↓  (fetches homepage + contact page links)
Worker 3 — Email Extractor
  ↓  (regex-extracts mailto: + plain-text emails)
  → Saved to extracted_emails + leads tables
```

### Auto-Pilot Mode

Browser-based continuous loop — keeps scraping until stopped.

- Configurable delay between runs (1–120 min)
- **Query Rotation** — add multiple business types; ABDUCTR cycles through them automatically
- **Cities Per Query** — how many cities to run per business type before rotating (1 / 2 / 3 / 5 / 10)
- Live city counter and current-query display

### Background Server Cron

Runs inside the **Node.js process** — no browser tab required, survives page navigation.

> **Smart environment detection:**  
> On `localhost` (or `NEXT_PUBLIC_APP_URL` empty/localhost) → **node-cron** in the server process.  
> In production (real domain) → **Supabase pg_cron** triggers the pipeline via HTTP.

| Config | Description |
|---|---|
| Queries | List of business types to cycle through |
| Interval | Run frequency (5 / 10 / 20 / 35 / 60 min) |
| Max Leads/Run | Cap on leads per execution |
| Cities Per Query | Cities to scrape before rotating to the next query |

Live stats: runs completed, total leads, total emails, current query, last run time, last error.

---

## 🌐 URL Email Harvester

Paste any URL into the **URL Scraper** panel:

1. Fetches the page HTML
2. Extracts all `mailto:` links and plain-text email addresses
3. Displays results as copyable chips

---

## 🔭 Scraper Enrichment Add-Ons

Toggle from the **Abduction Bay** UI before scraping:

| Add-On | Data Points | Time Cost |
|---|---|---|
| ⭐ **Google Maps Data** | Rating, Reviews, Full Address, Hours | +2s/lead |
| 💜 **Social Media** | Instagram, Facebook, LinkedIn | +3s/lead |
| 🩵 **Tech Stack** | CMS, Hosting, Email Provider (MX) | +4s/lead |
| 💚 **Marketing Signals** | Contact Form, Blog, Email Signup | +2s/lead |

---

## 🛡️ Proxy Shield

When enabled, each scrape request is routed through a rotating free proxy:

- 3 proxy sources refreshed automatically every 30 minutes
- Toggle on/off from the Abduction Bay dashboard
- Manual refresh available anytime

> ⚠️ Free proxies are best-effort. Plug in a paid provider via `.env.local` for mission-critical scraping.

---

## ☁️ Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all env vars — set `NEXT_PUBLIC_APP_URL` to your production domain
4. Deploy — `@sparticuz/chromium-min` handles headless Chrome on serverless automatically
5. `cron-control` auto-switches to Supabase pg_cron mode in production

---

## 🧠 BANT Lead Scoring

Each lead is automatically scored 0–100 based on:

| Signal | Weight |
|---|---|
| Need Level (1–5) | 40 pts |
| Budget (Low/Medium/High) | 30 pts |
| Authority (bool) | 20 pts |
| Timing (Immediate → Not sure) | 10 pts |

Score is displayed as a color-coded badge: 🔴 Cold → 🟡 Warm → 🟢 Hot

---

## ⚖️ Responsible Scraping

ABDUCTR scrapes **publicly available** business data from Google Maps.  
Use for **legitimate B2B outreach only**. Respect Google's Terms of Service. Do not spam.

---

## 🛠️ Tech Stack

<div align="center">

| | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **Database** | Supabase (Postgres + Realtime) |
| **Auth** | Supabase Auth + SSR |
| **Scraping** | Puppeteer-extra + Stealth Plugin + @sparticuz/chromium-min |
| **Background Jobs** | node-cron v4 (localhost) / Supabase pg_cron (production) |
| **Table** | TanStack Table v8 |
| **Animation** | Framer Motion |
| **Toasts** | Sonner |
| **Icons** | Lucide React |
| **Email Discovery** | Hunter.io API |

</div>

---

<div align="center">

*The truth is out there.* 👽

</div>
