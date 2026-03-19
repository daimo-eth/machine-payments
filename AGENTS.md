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
