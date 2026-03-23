# MBIO PAY — USDT (TRC-20) → UGX Mobile Money Remittance

## Overview

pnpm workspace monorepo using TypeScript. Converts USDT on the TRON network to UGX mobile money (MTN/Airtel Uganda) via Flutterwave.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **TRON**: tronweb (externalized from bundle, CJS via `require("tronweb")`)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── remittance-ui/      # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── pnpm-workspace.yaml
```

## Database Schema

- **users** — email, username (unique, one-time change), passwordHash, avatarUrl (base64), failedAttempts, lockedUntil, **riskScore**, **isFrozen**, **frozenAt**, **frozenReason**
- **refresh_tokens** — hashed refresh tokens per user (revocable, 7d TTL, token rotation)
- **orders** — per-order TRON deposit addresses (encrypted PK), phone, network, amount, ugxAmount, status, txid, expiresAt
- **fraud_events** — audit log for all fraud signals (userId, orderId, phone, eventType, severity, details JSON, createdAt)
- **phone_blocklist** — manually or auto-blocked phone numbers with reason and timestamp
- `encryptedPk` is AES-256-CBC encrypted with `ENCRYPTION_KEY` env var; never returned in API responses

## Auth System

- JWT — access token 15min (`JWT_SECRET`), refresh token 7d (`REFRESH_SECRET`)
- Refresh tokens stored as SHA-256 hashes in `refresh_tokens` table — fully revocable
- Token rotation: each `/auth/refresh` issues a new refresh token, old one deleted
- Logout revokes all refresh tokens for the user in DB
- Account lockout: 10 failed login attempts → 15-minute lock, reset on success
- Frontend: `localStorage` (`mbio_access`, `mbio_refresh`); auto-refreshes on 401
- Logout sends refresh token to server for DB revocation

## Backend Security

- `helmet` with CSP, HSTS (1yr), referrer policy
- CORS locked to `REPLIT_DOMAINS` / `REPLIT_DEV_DOMAIN`; localhost in dev only
- Rate limiting: 120 req/min global, 10 req/min on login/signup (per IP+UA fingerprint)
- Body limit: 50KB global; 4MB only on `PATCH /api/profile` (avatar upload)
- `trust proxy: 1` for Replit reverse proxy
- MAX_TX_AMOUNT: 500 USDT; TRADE_LIMIT_PER_MIN: 10 orders/min per user
- Per-order unique TRON deposit addresses — exact payment matching, no shared wallet ambiguity
- Sweep retry: 3 attempts with 30s/60s/90s backoff; failure logged for manual recovery
- Phone validation (Uganda `256XXXXXXXXX`) enforced on backend
- `/orders/:id` and `/orders/recent` require auth + ownership check
- `encryptedPk` column excluded from all API responses via explicit column select

## Fraud Detection System

Runs on every order creation (`src/lib/fraudDetector.ts`). 7-layer check pipeline:

| Check | Rule | Response |
|-------|------|----------|
| Phone blocklist | Phone is on admin blocklist | Hard block (403) |
| Frozen account | User `isFrozen = true` | Hard block (403) |
| Phone velocity | > 5 completed payouts to same phone in 24h | Hard block (403) |
| Cross-user phone | > 3 distinct users sending to same phone in 1h | Hard block (403) |
| User daily velocity | > 20 orders by same user in 24h | Hard block (403) |
| Repeated failures | > 3 failed orders in 24h | Flagged (allowed, risk +25) |
| High-value order | Single order ≥ 200 USDT | Flagged (allowed, risk +10) |

**Risk scoring**: each fraud event adds points to `users.risk_score`. At 100 points the user is auto-frozen.  
**Login guard**: frozen users cannot log in at all — returns 403 with reason.

## Admin Panel

- URL: `/api/admin-panel` (served from the API server, no secret in URL — session-based auth)
- **Auth**: email + bcrypt password + TOTP (speakeasy) + device fingerprint (SHA-256 of UA+screen+language)
- **First-time setup**: `/api/admin-panel` → "First-time Setup" tab → generates QR code → scan with authenticator app → register. Only works when no admin exists.
- **Device binding**: first login binds device hash; new devices are rejected (admin must call `POST /api/admin/reset-device` with TOTP to clear)
- **Session**: 4-hour httpOnly cookie (`mbio_admin_sid`), uses `ADMIN_SECRET` as session secret
- Tabs: Overview, Users (risk scores, freeze/unfreeze), Orders, Fraud Events, Blocklist

Admin API endpoints (all require active admin session cookie):
- `GET /api/admin/session` — check session status
- `POST /api/admin/login` — email + password + TOTP token + device fingerprint
- `POST /api/admin/logout` — destroy session
- `GET /api/admin/setup-totp` — generate TOTP secret + QR code (registration only)
- `POST /api/admin/register` — create admin account (only if none exist)
- `POST /api/admin/reset-device` — clear device binding (requires TOTP)
- `GET /api/admin/overview` — system stats
- `GET /api/admin/users` — all users sorted by risk score
- `GET /api/admin/orders` — last 200 orders
- `GET /api/admin/fraud-events` — full fraud audit log
- `GET /api/admin/blocklist` — blocked phones
- `POST /api/admin/block-phone` — add phone to blocklist
- `DELETE /api/admin/block-phone/:phone` — remove from blocklist
- `POST /api/admin/freeze/:id` — freeze user account
- `POST /api/admin/unfreeze/:id` — unfreeze user account
- `POST /api/admin/reset-risk/:id` — reset risk score to 0

Admin DB table: `admins` — email, password_hash (bcrypt), totp_secret, device_hash, is_active, last_login_at

## Wallet / Finance Architecture

- **Dynamic rate engine**: base 3700 UGX/USDT, ±1–6% margin based on hot wallet balance + pending demand
- **Per-order deposit wallets**: TronWeb creates fresh wallet per order; PK AES-encrypted in DB
- **Sweep**: after deposit confirmed (3+ confirmations), funds swept to `HOT_WALLET`
- **Rebalance**: every 60s — if hot wallet > `MAX_HOT_BALANCE` (5000 USDT), excess sent to `COLD_WALLET`; if < `MIN_HOT_BALANCE` (1000 USDT), alert logged
- **Payout**: Flutterwave `/v3/transfers` to UGX mobile money (MTN=MPS, Airtel=AIN)

## Required Secrets

| Key | Purpose |
|-----|---------|
| `JWT_SECRET` | Sign access tokens |
| `REFRESH_SECRET` | Sign refresh tokens |
| `FLW_SECRET_KEY` | Flutterwave API key |
| `ENCRYPTION_KEY` | AES-256 encrypt deposit wallet private keys |
| `HOT_WALLET` | Operational TRON hot wallet address |
| `HOT_PRIVATE_KEY` | Hot wallet private key (sweeps + payouts) |
| `COLD_WALLET` | Cold storage address for excess funds |

## Required Env Vars (non-secret)

| Key | Default | Purpose |
|-----|---------|---------|
| `USDT_CONTRACT` | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | USDT TRC-20 contract (mainnet) |
| `BASE_RATE` | `3700` | Base UGX per USDT |
| `MIN_HOT_BALANCE` | `1000` | Minimum hot wallet USDT |
| `MAX_HOT_BALANCE` | `5000` | Maximum before rebalancing to cold |
| `MAX_TX_AMOUNT` | `500` | Per-order USDT cap |
| `MIN_TX_AMOUNT` | `1` | Minimum per-order USDT |
| `TRADE_LIMIT_PER_MIN` | `10` | Max orders per user per minute |

## Important Notes

- `tronweb` must be in `build.mjs` externals list (CJS, cannot be bundled by ESBuild)
- Use `require("tronweb")` not ES `import` in walletWatcher.ts (CJS interop)
- Zod imports: use `"zod"` (not `"zod/v4"`) in api-server routes
- Avatar stored as base64 data URL (max 2MB), resized to 256px JPEG on client
- Username: one-time change enforced via `usernameSet` boolean
- `bcryptjs` (pure JS) — avoids native build issues with `bcrypt`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from root: `pnpm run typecheck`.

- `emitDeclarationOnly` — only `.d.ts` files emitted during typecheck; JS bundling via esbuild/vite
- When adding cross-package imports, add to `references` in that package's `tsconfig.json`
