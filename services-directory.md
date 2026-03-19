# MPP & x402 Services Directory

## Settlement Tokens

In practice, both ecosystems are nearly single-token:

| Protocol | Chain | Token | Address | Usage |
|----------|-------|-------|---------|-------|
| **MPP** | Tempo (4217) | USDC.e (Bridged USDC via Stargate) | `0x20c0...b9537d11c60e8b50` | 52/54 services |
| **MPP** | — | Stripe (USD fiat) | — | 2/54 services |
| **x402** | Base (8453) | USDC (native Circle) | `0x8335...bdA02913` | ~90% of endpoints |
| **x402** | Base Sepolia | USDC (testnet) | `0x036C...3dCF7e` | testnet only |
| **x402** | Solana | USDC (SPL) | `EPjFWdd5...TDt1v` | ~10% of endpoints |
| **x402** | Base | AUSD (Aster USD) | `0xf33C...A9aa` | Questflow only |
| **x402** | SKALE | custom token | `0x8588...FCb20` | 1 endpoint |

Other Tempo tokens exist (pathUSD, EURC.e, USDT0, frxUSD, cUSD) but no MPP services use them today.
x402 theoretically supports any EIP-3009 token (EVM) or SPL token (Solana), but in practice it's USDC everywhere.

**TL;DR: MPP = USDC.e on Tempo. x402 = USDC on Base. That's it.**

---

## MPP Services (54 total)

Source: [mpp.dev/api/services](https://mpp.dev/api/services). All use Tempo USDC.e unless noted.

### AI / LLM Inference

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **Anthropic** | Claude Sonnet/Opus/Haiku | session | per-token |
| **OpenAI** | GPT chat, embeddings, DALL-E, audio | charge+session | per-token |
| **Google Gemini** | Gemini text, Veo video, image gen | session | $0.0001–0.001 |
| **OpenRouter** | 100+ LLMs, unified API | session | per-model |
| **Perplexity** | AI search with Sonar models | charge | varies |
| **Replicate** | Open-source models (image, LLM, video) | charge | $0.001+ |

### AI Media

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **fal.ai** | 600+ models (Flux, SD, Recraft) | charge | $0.003–0.035 |
| **Stability AI** | Image gen, editing, upscaling, 3D | charge | $0.035–0.092 |
| **Suno** | AI music & lyrics generation | charge | $0.02–0.10 |
| **StableStudio** | Multi-model image/video (GPT Image, Sora, Veo) | charge | $0.039+ |

### Search & Web

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **Exa** | AI-powered web search | charge | $0.005 |
| **Parallel** | Web search, multi-hop research | charge | $0.01 |
| **Firecrawl** | Web scraping & extraction for LLMs | charge | $0.002–0.005 |
| **Browserbase** | Headless browser for agents | charge | $0.01 |
| **Browser Use** | AI browser automation | charge | varies |
| **Oxylabs** | Web scraping with geo-targeting | charge | varies |
| **Diffbot** | Web extraction & knowledge graph | charge | $0.0012 |

### Blockchain Data

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **Alchemy** | RPC, Prices, Portfolio, NFT (100+ chains) | session | $0.0001–0.0005 |
| **Allium** | Token prices, balances, txs, PnL | charge | $0.02 |
| **Codex** | Tokens & prediction markets (80+ networks) | charge | $0.001 |
| **Dune** | SQL queries on blockchain data | session | varies |
| **Tempo RPC** | Tempo JSON-RPC | session | $0.001 |

### Data & Enrichment

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **Google Maps** | Geocoding, directions, places, weather | charge | $0.002–0.005 |
| **Mapbox** | Geocoding, directions, static maps | charge | $0.001–0.002 |
| **StableEnrich** | People, companies, contacts, places | charge | $0.02–0.05 |
| **Hunter** | Email finding & verification | charge | $0.005–0.01 |
| **Clado** | LinkedIn enrichment, lead gen | charge | varies |
| **RentCast** | Property records & rent estimates | charge | $0.03 |
| **BuiltWith** | Website tech detection | charge | $0.05 |
| **SpyFu** | SEO/PPC competitor research | charge | $0.01–0.02 |
| **OpenWeather** | Weather, forecasts, air quality | charge | $0.003–0.005 |
| **EDGAR** | SEC filings & XBRL financial data | charge | $0.005 |
| **EDGAR Search** | Full-text search across SEC filings | charge | $0.005 |
| **KicksDB** | Sneaker & streetwear market data | charge | $0.0005 |

### Travel

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **StableTravel** | Flights, hotels, activities (Amadeus) | charge | $0.03–0.09 |
| **AviationStack** | Flight tracking, airports, airlines | charge | $0.005 |
| **FlightAPI** | Flight prices (700+ airlines) | charge | $0.002–0.008 |
| **GoFlightLabs** | Flight tracking & schedules | charge | $0.005 |
| **SerpApi** | Google Flights search | charge | $0.015 |

### Communication & Social

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **AgentMail** | Email inboxes for AI agents | charge | $0.01/msg, $2/inbox |
| **StableEmail** | Pay-per-send email delivery | charge | $0.005–0.02 |
| **StablePhone** | AI phone calls, phone numbers | charge | $0.54–20 |
| **StableSocial** | TikTok, IG, FB, Reddit data | charge | $0.06 |

### Compute & Storage

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **Modal** | Serverless GPU compute | session | $0.0001+ |
| **Judge0** | Code execution (70+ languages) | charge | $0.001 |
| **Object Storage** | S3/R2-compatible storage | charge+session | per-size |
| **StableUpload** | File & static site hosting | charge | varies |
| **Code Storage** | Git repo creation | charge | $0.01–1.00 |

### Misc

| Service | What it does | Intent | Price |
|---------|-------------|--------|-------|
| **2Captcha** | CAPTCHA solving | charge | $0.003 |
| **Mathpix** | Math/science OCR (LaTeX) | charge | $0.002–0.01 |
| **PostalForm** | Print & mail real letters | charge | varies |
| **Laso Finance** | Virtual debit cards, Venmo/PayPal | charge | $0.005 |
| **Prospect Butcher** | Order sandwiches in Brooklyn | charge | **Stripe** (not Tempo) |
| **Stripe Climate** | Fund carbon removal | charge | **Stripe** (not Tempo) |

---

## x402 Services (~74 services/endpoints + 30+ facilitators)

Source: [x402.org/ecosystem](https://www.x402.org/ecosystem). All use Base USDC unless noted.

### AI / LLM

| Service | What it does | Payment |
|---------|-------------|---------|
| **AskClaude** | Claude Haiku/Sonnet/Opus per-question | Base USDC ($0.01–0.10) |
| **BlockRun.AI** | All major LLMs (GPT, Claude, Gemini, DeepSeek, xAI) | Base USDC |
| **AiMo Network** | Censorship-resistant AI inference | Base USDC |
| **Arch AI Tools** | 53 tools in one MCP server | Base USDC |
| **Obol** | AI code gen → GitHub PR | Base USDC ($5/call) |
| **Soundside** | MCP-native media gen (5 providers, 22 tools) | Base USDC |

### Web Scraping & Data

| Service | What it does | Payment |
|---------|-------------|---------|
| **Firecrawl** | Web scraping (also on MPP) | Base USDC |
| **Zyte API** | Unified web scraping with unblocking | Base USDC |
| **Minifetch** | Rich metadata & summaries from URLs | Base USDC |
| **twit.sh** | Twitter/X data, no signup | Base USDC |
| **Neynar** | Farcaster social data | Base USDC |

### Blockchain / DeFi Intelligence

| Service | What it does | Payment |
|---------|-------------|---------|
| **Einstein AI** | Whale tracking, smart money, MEV detection | Base USDC + Solana |
| **DiamondClaws** | DeFi yield scoring (17K pools, 7 chains) | Base USDC ($0.0005–0.002) |
| **SLAMai** | Smart money intelligence | Base USDC |
| **Rug Munch** | Crypto scam/rug detection (240K+ scans) | Base USDC ($0.02–2.00) |
| **WalletIQ** | Wallet profiling: age, DeFi, risk score | Base USDC ($0.005) |
| **Mycelia Signal** | Signed price oracle (BTC/ETH/SOL/EUR/XAU) | Base USDC ($0.001) |
| **AdEx AURA** | Portfolio data, DeFi positions, yields | Base USDC |
| **invy** | Token holdings across ETH + Solana | Base USDC |
| **BlackSwan** | Real-time risk intelligence | Base USDC |
| **Stakevia** | Solana validator intelligence | Base USDC ($1/report) |

### Agent Security & Compliance

| Service | What it does | Payment |
|---------|-------------|---------|
| **AI Security Guard** | Prompt injection scanning | Base USDC |
| **Orac** | Prompt injection, code audit, trust scoring | Base USDC |
| **Augur** | Smart contract bytecode risk scoring | Base USDC ($0.10) |
| **Cybercentry** | AI cyber threat intelligence | Base USDC |
| **ActionGate** | Pre-execution risk scoring for agents | Base USDC |
| **MerchantGuard** | AI merchant compliance scoring | Base USDC |
| **Kevros** | AI governance, post-quantum signatures | Base USDC ($0.01–0.25) |

### Agent Infrastructure

| Service | What it does | Payment |
|---------|-------------|---------|
| **Agoragentic** | Agent-to-agent marketplace (26+ endpoints) | Base USDC |
| **Agent Camo** | Residential proxy for agents | Base USDC |
| **Agent Health Monitor** | 11 diagnostic endpoints | Base USDC |
| **DJD Agent Score** | Agent wallet reputation scoring | Base USDC |
| **Idapixl Cortex** | Semantic memory & deduplication for agents | Base USDC |

### Commerce & Payments

| Service | What it does | Payment |
|---------|-------------|---------|
| **Bitrefill** | Gift cards, mobile top-ups, eSIMs | Base USDC |
| **AEON** | AI agents pay real-world merchants (SEA/LATAM/Africa) | Base USDC |
| **Laso Finance** | Prepaid cards, Venmo/PayPal (also on MPP) | Base USDC |
| **AsterPay** | EUR settlement via SEPA Instant | Base USDC |

### Publishing & Social

| Service | What it does | Payment |
|---------|-------------|---------|
| **Postera** | AI agent publishing, readers pay per-read | Base USDC |
| **Tweazy** | Read tweets onchain | Base USDC |
| **Ordiscan** | Bitcoin Ordinals explorer + inscriptions | Base USDC |

### DevOps & Infra

| Service | What it does | Payment |
|---------|-------------|---------|
| **Pinata** | Account-free IPFS storage | Base USDC |
| **Run402** | Postgres, REST, auth, storage, functions | Base USDC |
| **Bloomfilter** | Domain registration & DNS | Base USDC |
| **Kurier** | ZK proof service (submit/verify/settle) | Base USDC |
| **Spraay** | 62 endpoints: AI, payments, swaps, IPFS, KYC | Base USDC |
| **Robtex** | DNS, IP reputation, BGP, passive DNS (50+ endpoints) | Base USDC |

### News & Research

| Service | What it does | Payment |
|---------|-------------|---------|
| **Gloria AI** | Real-time news for agents | Base USDC |
| **Moltalyzer** | Community digests, GitHub trending, Polymarket insider detection | Base USDC |
| **Otto AI** | Crypto news, token analysis, alpha | Base USDC |

---

## Services on Both Protocols

| Service | MPP Payment | x402 Payment |
|---------|-------------|--------------|
| **Firecrawl** | Tempo USDC.e (charge) | Base USDC |
| **Laso Finance** | Tempo USDC.e (charge) | Base USDC |
| **Alchemy** | Tempo USDC.e (session) | Base USDC (infra partner) |

---

## Summary

- **MPP** has 54 services, anchored by major providers (OpenAI, Anthropic, Google, fal.ai, Alchemy, Dune). Stronger for AI inference, search, travel, and data enrichment.
- **x402** has ~74+ services with a much larger long tail of indie/crypto-native builders. Stronger for DeFi analytics, agent security, agent infrastructure, and crypto commerce.
- **Settlement is effectively USDC everywhere** — USDC.e on Tempo for MPP, native USDC on Base for x402.
- MPP's session intent (off-chain vouchers) gives it an edge for high-frequency use cases like LLM streaming.
- x402's facilitator model and multi-chain support (Base, Solana, Polygon, Avalanche) gives it broader chain coverage.
