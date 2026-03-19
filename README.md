# Daimo Machine Payments

Pay for any MPP service from any token on any chain.

- Humans: https://mpp.daimo.com
- Agents: https://mpp.daimo.com/SKILL.md
- API reference: https://mpp.daimo.com/llms.txt

## Dev

```bash
bun install
DAIMO_API_KEY=... DATABASE_URL=... bun dev   # dev server with watch
bun tsc --noEmit                              # typecheck
bun build --target=bun src/index.ts           # build
```

Deploys to Fly.io on push to `master`.

## Scope

Supports MPP `charge` intent (one-time payments). Does not yet support MPP
`session` intent (streaming payment channels) or x402.
