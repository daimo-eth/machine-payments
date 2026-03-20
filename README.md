<img src="https://github.com/user-attachments/assets/ce06d1d8-7533-49bd-ba59-b25f7b1466e6" />

# Universal MPP

Let the bot buy anything. Agent API shows the best [MPP](https://mpp.dev/) provider for any service. Latency, quality, reliability. Agent pays from any coin, rates 1-5 star.

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
