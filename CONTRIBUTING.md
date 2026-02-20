# Contributing to ABDUCTR 🛸

Thanks for your interest in helping abduct more leads! Here's how to get involved.

---

## 🚀 Getting Started

1. **Fork** the repo on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ABDUCTR.git
   cd ABDUCTR/abductr
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Copy the env template and fill in your own Supabase keys:**
   ```bash
   cp .env.example .env.local
   ```
5. **Run the DB schema** in your Supabase SQL Editor:
   ```
   supabase/schema.sql
   ```
6. **Start the dev server:**
   ```bash
   npm run dev
   ```

---

## 🌿 Branch Naming

Use a clear, descriptive branch name:

| Type | Format | Example |
|---|---|---|
| Bug fix | `fix/short-description` | `fix/proxy-crash-on-refresh` |
| New feature | `feat/short-description` | `feat/linkedin-enrichment` |
| Docs | `docs/short-description` | `docs/update-env-guide` |
| Refactor | `refactor/short-description` | `refactor/cron-singleton` |

---

## 📋 Submitting a Pull Request

1. Make sure your branch is up to date with `main`:
   ```bash
   git fetch origin
   git rebase origin/master
   ```
2. Run the TypeScript check before pushing:
   ```bash
   npx tsc --noEmit
   ```
3. Push your branch and open a PR on GitHub
4. Fill out the PR template — describe what changed and why
5. Link any related issues (e.g. `Closes #12`)

---

## 🐛 Reporting Bugs

Open an [Issue](https://github.com/itsRabb/ABDUCTR/issues) using the **Bug Report** template.  
Include steps to reproduce, expected vs actual behavior, and your OS/Node version.

---

## 💡 Requesting Features

Open an [Issue](https://github.com/itsRabb/ABDUCTR/issues) using the **Feature Request** template.  
Explain the use case — why would this help ABDUCTR users?

---

## 🧠 Code Style

- TypeScript — no `any` unless absolutely necessary
- Tailwind for all styling — no inline styles
- Keep API routes thin; move logic to `lib/`
- Comment anything non-obvious

---

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).  
Be respectful. We're all just trying to abduct some leads. 👽
