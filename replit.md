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

- **users** — email, username (unique, one-time change), passwordHash, avatarUrl (base64), failedAttempts, lockedUntil
- **refresh_tokens** — hashed refresh tokens per user (revocable, 7d TTL, token rotation)
- **orders** — per-order TRON deposit addresses (encrypted PK), phone, network, amount, ugxAmount, status, txid
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
