# Daimo Machine Payments

Pay for any MPP service from any token on any chain. No API key needed.

Full API reference: https://mpp.daimo.com/llms.txt

## Find services

Search the directory by keyword, or browse top-rated services.

```
GET https://mpp.daimo.com/v1/providers?q=web+search&limit=5
GET https://mpp.daimo.com/v1/providers/leaderboard?limit=10
GET https://mpp.daimo.com/v1/providers/<id>
```

Each provider includes `avg_score`, `total_ratings`, and `total_payments`.

## Make a payment

### 1. Send your request

POST the target URL, method, body, and your wallet address.

```json
POST https://mpp.daimo.com/v1/mpp/request
{
  "url": "https://mpp.dev/api/exa/v1/search",
  "method": "POST",
  "body": { "query": "latest rust release notes", "numResults": 5 },
  "wallet": { "evmAddress": "0xYOUR_WALLET" }
}
```

If no payment is needed, the response comes back immediately under
`{"status": "success", "response": {...}}`.

If the service returns 402, you get `{"status": "payment_required", ...}` with:
- `paymentId` -- tracks this payment
- `depositAddress` -- where to send funds
- `tokenOptions` -- every token/chain you can pay with, each with `chainId`,
  `tokenAddress`, `tokenSymbol`, `requiredUnits`, and your `balanceUnits`
- `payment.amount` -- cost in human-readable units

### 2. Send payment on-chain

Pick any token option. Send `requiredUnits` of that token to `depositAddress`
on that chain. Daimo bridges to the service's destination automatically.

### 3. Poll for completion

```
GET https://mpp.daimo.com/v1/mpp/poll/<paymentId>?txHash=0xYOUR_TX
```

Pass `txHash` to speed up detection. The response tells you what to do:

- `{"status": "pending", "nextPollWaitS": 2}` -- wait `nextPollWaitS` seconds,
  then poll again.
- `{"status": "pending", "completionAttempts": 2, "lastAttemptError": "HTTP 500",
  "nextPollWaitS": 4}` -- DMP is retrying the request. Wait and poll again.
- `{"status": "succeeded", "response": {"status": 200, "body": {...}}}` -- done.
  The service's response is in `response.body`.
- `{"status": "failed", "error": "..."}` -- terminal failure.

DMP retries the completion request up to 10 times with backoff.

## Rate services

After a succeeded payment, rate the service to help other agents.

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
