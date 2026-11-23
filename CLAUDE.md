# ระบบคลังวัสดุ DBT

Thai-language borrow/return web app for the DBT department. Next.js 15 (App Router) + TypeScript, Prisma 6 + PostgreSQL, Auth.js v5 beta, LINE Messaging API, Vitest + Playwright.

- Spec: `docs/superpowers/specs/2026-11-09-borrow-return-design.md`
- Plan: `docs/superpowers/plans/2026-11-09-borrow-return.md`
- Setup / deploy (Thai): `README.md`

## Rules
- All UI copy and error messages in Thai. Dates/"today" use Asia/Bangkok (`todayBangkok()`), never server-local time.
- Never commit, print, or copy secrets from `.env` (DB password, AUTH_SECRET, LINE token/secret, admin password) — not into git, chat, or notes.
- Work on `feat/borrow-return`; after each finished change, push it and merge into `main` (push `main` too).
- Tests: `npm run test:unit`, `npm run test:int` (uses `borrow_test`; DB name must end with `_test`), `npm run test:e2e` — run int and e2e sequentially, never in parallel.
- Local preview runs from `D:\test1-preview` (a worktree of `main`) on port 3001; after merging into `main`, refresh it with `git -C ../test1-preview reset --hard master`.

## Obsidian work log (always)
After every piece of work in this project — a fix, a feature, a setup change, a decision, or an answer the user will reuse (e.g. report text) — update the Obsidian vault before ending the turn:

- Vault: `C:\Users\ASUS\Documents\Obsidian Vault\ระบบคลังวัสดุ DBT\`
- `บันทึกการทำงาน.md` — add bullets under today's date heading (`## YYYY-MM-DD`, newest first; create the heading if missing). Write in Thai: what was done, why, commit hash if any.
- `สิ่งที่ต้องทำต่อ.md` — tick done items, add new follow-ups.
- `การตัดสินใจ.md` — add any decision made on the user's behalf.
- `การตั้งค่าและวิธีเปิดเว็บ.md` / `ภาพรวมโปรเจกต์.md` — update when setup, URLs, accounts or features change; bump `updated:` in the frontmatter.
- Never write passwords, tokens or secrets into the vault — point to the `.env` line name instead.
