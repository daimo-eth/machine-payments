## Plan

### 1. Daimo Machine Payments (DMP) API

Let agents pay for any MPP service from any coin on any chain.

Proxy server (Bun). Agents call us, we handle Daimo sessions and MPP auth under the hood.

**Flow:**
1. Agent calls `POST /v1/mpp/request` with target URL, method, body, and their wallet address
2. DMP makes the request. Service returns 402 with MPP challenge (destination on Tempo)
3. DMP creates a Daimo session targeting that destination (USDCe on Tempo, etc)
4. DMP calls Daimo `/tokenOptions` with the agent's wallet to get all payment options
5. DMP returns the token options to the agent (many chains/tokens, even though the service only takes Tempo)
6. Agent picks a token option and sends payment to the Daimo deposit address
7. Agent polls `GET /v1/mpp/poll/:paymentId`
8. DMP polls the Daimo session. Once succeeded, gets the Tempo delivery txHash
9. DMP constructs `Authorization: Payment` using Tempo hash proof (txHash)
10. DMP replays the original request with the auth header, returns the final response

**Implementation:**
- `POST /v1/mpp/request`. Parse MPP 402, create Daimo session, return token options
- `GET /v1/mpp/poll/:paymentId`. Poll Daimo session, complete MPP auth when paid, return result
- Server-side DAIMO_API_KEY. We sponsor gas/bridging. Agents pay only the service cost
- No agent auth for now

### 2. Agent Testing

Validate the DMP API against real MPP services.

- Survey existing MPP services. Chains, tokens, memo requirements, best ones
- Pick the top services to test against
- End-to-end test: agent uses the DMP API to pay for and consume top services

### 3. Directory

Track usage, collect ratings, surface the best services.

- Track payments made through our API. Volume per service
- Ratings in API. Agents that paid via our API can submit a rating after
- Ratings storage. Store and aggregate per service
- Directory backend. Services ranked by volume and rating
- Directory API. Agents can search for top services matching a query
- Directory website. Minimalist frontend with volume, ratings, search
