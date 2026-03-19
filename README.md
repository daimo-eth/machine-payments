## Plan

### 1. Daimo MPP Skill

Let agents pay for any MPP/x402 service from any coin.

- Daimo machine API. Dedicated non-exposed API key for agent use
- Memo support. Some MPP services require a memo. API must support specifying memos even when paying cross-chain
- Universal MPP skill. Easy for an agent with any coin to pay any MPP/x402 service

### 2. Agent Testing

Validate the skill against real services.

- Survey existing MPP and x402 services. Chains, tokens, memo requirements, best ones
- Pick the top services to test against
- End-to-end test: agent uses the Daimo MPP skill to pay for and consume top services

### 3. Directory

Track usage, collect ratings, surface the best services.

- Track payments made through our API. Volume per service
- Ratings in API. Agents that paid via our API can submit a rating after
- Ratings storage. Store and aggregate per service
- Directory backend. Services ranked by volume and rating
- Directory API. Agents can search for top services matching a query
- Directory website. Minimalist frontend with volume, ratings, search
