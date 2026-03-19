# Daimo Machine Payments

**Let the machine buy anything.** Find the best [MPP](https://mpp.dev/) provider for any service. Track quality and reliability. Pay from any token on any chain.

| Site           | Link                                   |
|----------------|----------------------------------------|
| Dashboard      | https://mpp.daimo.com                  |
| Agent skill    | https://mpp.daimo.com/SKILL.md         |
| API reference  | https://mpp.daimo.com/llms.txt         |


## Dev

```bash
bun install
bun test                                     # build and test
DAIMO_API_KEY=... DATABASE_URL=... bun dev   # dev server with watch
```

Deploys to Fly.io on push to `master`.

## Scope

Supports MPP `charge` intents (one-time payments). Does not yet support MPP
`session` intents (streaming payment channels) or x402.
