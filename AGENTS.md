# Agent rules

## Testing

- `bun test` runs `tsc --noEmit` (typecheck) then `bun test` (unit tests).
- Tests live next to source files as `*.test.ts`.
- Prefer pure-function tests: tabular input/output, no mocks, no network.
- One `describe` per function, `test.each` for cases.

## Commits

- Linear history only. Rebase, never merge.
- Push to `master` when asked.

## Test wallet

Send test EVM transfers using `EVM_TEST_WALLET_PRIVATE_KEY`.

```bash
# Check address and balances
bun scripts/wallet.ts balance

# Send USDC on Base (default)
bun scripts/wallet.ts send <to> <amount>

# Send USDC on Arbitrum
bun scripts/wallet.ts send <to> <amount> arb-usdc

# Send native ETH
bun scripts/wallet.ts send <to> <amount> base-eth

# Check balance only (no send)
bun scripts/wallet.ts send <to> <amount> --check
```

Available tokens: `base-usdc` (default), `arb-usdc`, `base-eth`, `arb-eth`.

## Prod investigation

### Database

The schema is defined as idempotent `CREATE TABLE IF NOT EXISTS` statements in `src/db.ts`. **Read that file first** to understand all tables and columns before querying.

Tables: `mpp_payments`, `mpp_completion_attempts`, `mpp_providers`, `mpp_ratings`, `mpp_proxy_requests`.

**To query prod DB**, open a proxy then use psql:

```bash
# 1. Start proxy in background (maps local 15432 -> Fly Postgres 5432)
fly proxy 15432:5432 -a universal-mpp-db &
sleep 2

# 2. Run queries (password: NKKXQIFZYgZNZtc, user: universal_mpp, db: universal_mpp)
PGPASSWORD=NKKXQIFZYgZNZtc psql -h localhost -p 15432 -U universal_mpp -d universal_mpp -t -A \
  -c "SELECT row_to_json(t) FROM (SELECT * FROM mpp_payments WHERE id = '<uuid>') t;"

# 3. Kill proxy when done
pkill -f "fly proxy 15432"
```

Use `-t -A` flags for clean machine-readable output. Wrap queries in `row_to_json(t)` for JSON output of full rows.

### Logs

```bash
# Recent logs (non-streaming, exits after printing)
fly logs -a universal-mpp --no-tail

# Stream live logs
fly logs -a universal-mpp
```

### Fly apps

- `universal-mpp` -- the app (Hono server on Fly.io)
- `universal-mpp-db` -- unmanaged Fly Postgres
