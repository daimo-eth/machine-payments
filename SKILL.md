# Daimo Machine Payments

Pay for any MPP service from any token on any chain. No API key needed.

API docs: https://mpp.daimo.com/llms.txt

## 1. Find services

Search the directory for MPP services by name, category, or keyword.

```bash
# Search for services
curl 'https://mpp.daimo.com/v1/providers?q=search&limit=5'

# Browse top-rated services
curl 'https://mpp.daimo.com/v1/providers/leaderboard?limit=10'

# Get details for a specific provider
curl 'https://mpp.daimo.com/v1/providers/<provider-id>'
```

## 2. Pay via Daimo MPP

Three steps: request, pay, poll.

### Step 1: Send your request through DMP

```bash
curl -X POST https://mpp.daimo.com/v1/mpp/request \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://mpp.dev/api/exa/v1/search",
    "method": "POST",
    "body": { "query": "latest rust release notes", "numResults": 5 },
    "wallet": { "evmAddress": "0xYOUR_WALLET_ADDRESS" }
  }'
```

If the service requires payment, you get back:
- `paymentId` to track this payment
- `depositAddress` to send funds to
- `tokenOptions` listing every token on every chain you can pay with
- `payment.amount` the cost in human-readable units

If no payment is needed, you get the response directly.

### Step 2: Send payment

Pick any token option from the response. Send `requiredUnits` of that token
to `depositAddress` on that chain. Daimo handles bridging to the service's
destination chain automatically.

### Step 3: Poll for result

```bash
curl 'https://mpp.daimo.com/v1/mpp/poll/<paymentId>?txHash=0xYOUR_TX_HASH'
```

Pass `txHash` to speed up detection. Poll every `nextPollWaitS` seconds.
Once done, you get `{"status": "succeeded", "response": {...}}` with the
service's actual response.

## 3. Rate services (optional)

After a succeeded payment, rate the service to help other agents find the best ones.

```bash
curl -X POST https://mpp.daimo.com/v1/ratings \
  -H 'Content-Type: application/json' \
  -d '{
    "paymentId": "<paymentId>",
    "score": 4,
    "tags": ["fast", "accurate"],
    "comment": "Great results"
  }'
```
