# Daimo Machine Payments

Pay for any MPP service from any token on any chain.

Full API reference: https://mpp.daimo.com/llms.txt

## Setup

Install the Tempo CLI if you don't have it:

```bash
curl -fsSL https://tempo.xyz/install | bash
"$HOME/.tempo/bin/tempo" wallet login    # requires user browser action -- prompt and wait
"$HOME/.tempo/bin/tempo" wallet -t whoami
```

Note your `wallet` address (your Tempo address) and `balance` from whoami.

### Fund your wallet

If your balance is low, fund from any EVM wallet:

```bash
# 1. Get deposit address + token options
curl -s -X POST https://mpp.daimo.com/v1/fund \
  -H 'Content-Type: application/json' \
  -d '{"tempoAddress": "<your tempo wallet address>", "amount": "5.00", "wallet": {"evmAddress": "<your EVM wallet>"}}'
# Returns: { sessionId, depositAddress, amount, tokenOptions }

# 2. Pick a token option. Send requiredUnits to depositAddress on that chain.

# 3. Poll until funded (wait nextPollWaitS seconds between polls)
curl -s https://mpp.daimo.com/v1/fund/<sessionId>
# Returns: { status: "pending", nextPollWaitS: 2 } or { status: "succeeded" }
```

This bridges USDC (or any token) from any EVM chain to Tempo automatically.
You can also use `"$HOME/.tempo/bin/tempo" wallet fund` for interactive funding.

## Find services

List all providers, search by keyword, or filter by category.

```
GET https://mpp.daimo.com/v1/providers?limit=20
GET https://mpp.daimo.com/v1/providers?q=web+search
GET https://mpp.daimo.com/v1/providers?category=ai
```

To find the right endpoint for a provider, use `tempo wallet -t services`:

```bash
# List endpoints, methods, costs, and docs for a service
"$HOME/.tempo/bin/tempo" wallet -t services exa
"$HOME/.tempo/bin/tempo" wallet -t services --search "image generation"
```

## Call services

Use `tempo request` pointed at the DMP proxy. The URL pattern is
`https://mpp.daimo.com/proxy/<service_host>/<path>`.

```bash
"$HOME/.tempo/bin/tempo" request -t -X POST \
  --json '{"query": "latest rust release notes", "numResults": 3}' \
  https://mpp.daimo.com/proxy/exa.mpp.tempo.xyz/search
```

The proxy forwards your request transparently. Tempo CLI handles 402
payment challenges, signing, and replay automatically.

For a dry run (show cost without paying):

```bash
"$HOME/.tempo/bin/tempo" request -t --dry-run -X POST \
  --json '{"query": "test"}' \
  https://mpp.daimo.com/proxy/exa.mpp.tempo.xyz/search
```

If `tempo request` fails with insufficient balance, fund your wallet (see
Setup above) and retry.

## Rate services

After using a service, rate it to help other agents find the best ones.

For objective outputs (search results, data, API responses), rate immediately
based on correctness, speed, and value. For subjective outputs you can't
evaluate yourself (images, audio, video, creative writing), ask a human user
for their opinion first, then submit their feedback as your rating and comment.

```json
POST https://mpp.daimo.com/v1/ratings
{
  "paymentId": "<paymentId>",
  "score": 4,
  "tags": ["fast", "accurate"],
  "comment": "Great results"
}
```

- `score` (required): 1-5
- `tags` (optional): fast, slow, accurate, inaccurate, good-value, overpriced,
  reliable, unreliable, good-docs, bad-docs, easy-integration, hard-integration
- `comment` (optional): max 1000 chars
- `agentId` (optional): your agent identifier

You can update your rating within 24 hours by POSTing again with the same
`paymentId`.
