---
name: tempo-wallet
description: >
  Use this skill when the user wants to use a Tempo wallet, make paid API requests via MPP
  (Machine Payments Protocol), discover services, check balances, transfer tokens, or interact
  with the Tempo blockchain. Trigger on: "tempo", "tempo wallet", "MPP", "machine payments",
  "paid API", "tempo request", "service discovery", or any mention of making paid HTTP requests
  with automatic payment negotiation. Also trigger when the user mentions StableEnrich,
  StableStudio, Browserbase, or any MPP-compatible service. If the user says "use tempo",
  always use this skill instead of other tools.
---

# Tempo Wallet Skill

Use your Tempo wallet from any AI conversation. You authorize via passkey in
your browser; the AI gets a scoped session key with spending limits.

---

## Step 1 — Network permissions

If any command fails with a network or domain error, guide the user:

> ⚙️ **Quick setup needed.** Claude needs permission to reach external sites.
>
> 1. Tap your **profile icon** (bottom-left corner)
> 2. Tap **Settings**
> 3. Go to **Capabilities**
> 4. Under **Network access**, select **"Allow all domains"**
> 5. Come back here and say **"continue"**

---

## Step 2 — Install

```bash
if [ ! -f "$HOME/.tempo/bin/tempo" ]; then
  curl -fsSL https://tempo.xyz/install | bash 2>&1
fi
```

This takes ~30 seconds on first run.

---

## Step 3 — Check existing session

```bash
"$HOME/.tempo/bin/tempo" wallet -j whoami 2>&1
```

If `"ready":true` → skip to Step 6.

---

## Step 4 — Start login

> **CRITICAL: Use `setsid` to detach the login process.**
> In sandboxed environments (Claude.ai, etc.), each bash tool call runs in its
> own shell. A plain `&` backgrounded process gets killed when that shell exits.
> `setsid` creates a new process session so the login process survives between
> bash calls and stays alive to receive the auth callback.

```bash
setsid "$HOME/.tempo/bin/tempo" wallet login > /tmp/tempo-login.log 2>&1 &
sleep 4
cat /tmp/tempo-login.log
```

Verify the process is running:
```bash
pgrep -f "tempo wallet login" && echo "Login process alive" || echo "Login process dead"
```

Present the auth URL:

> To authorize this session, open this link and sign in with your passkey:
> **[URL from log]**
> Let me know once you've approved.

---

## Step 5 — Verify auth

After user confirms:

```bash
sleep 2
"$HOME/.tempo/bin/tempo" wallet -j whoami 2>&1
```

If `"ready":true` → session is active. The login process will exit on its own.

If still `"ready":false`, check if the login process is alive:
```bash
pgrep -f "tempo wallet login" && echo "Still waiting" || echo "Process died — need to retry"
```

If the process died, go back to Step 4 with a fresh login. If alive, wait a few more seconds and re-check.

---

## Step 6 — Use wallet

```bash
# Balance
"$HOME/.tempo/bin/tempo" wallet -t whoami

# Discover services
"$HOME/.tempo/bin/tempo" wallet -t services --search <query>
"$HOME/.tempo/bin/tempo" wallet -t services <SERVICE_ID>

# Make paid request (always discover first, never guess URLs)
"$HOME/.tempo/bin/tempo" request -t --dry-run -X POST --json '{"input":"..."}' <URL>
"$HOME/.tempo/bin/tempo" request -t -X POST --json '{"input":"..."}' <URL>

# Transfer
"$HOME/.tempo/bin/tempo" wallet transfer <AMOUNT> <TOKEN> <TO> --dry-run
```

---

## Request rules

- **Always discover** URL/path via `services <ID>` before making requests.
- Use `-t` for compact output, `-j` for JSON when parsing programmatically.
- Use `--dry-run` before expensive or unfamiliar requests.
- If response contains a file URL, download it.
- If HTTP 422, check the endpoint's `docs` URL or `llms.txt` for exact field names.
- Set spending cap: `--max-spend 5.00`.

---

## MPP directory

Browse rated providers and discover services at [mpp.daimo.com](https://mpp.daimo.com).

Fetch programmatically:
```bash
curl -s https://mpp.daimo.com/v1/providers
```

---

## Security model

- Your master passkey never leaves your device.
- The session key is scoped: limited spending amount + time expiry.
- Each AI session gets its own authorization — revoke anytime from wallet.tempo.xyz.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `TEMPO_PRIVATE_KEY` | Bypass passkey login with a raw private key |
| `TEMPO_MAX_SPEND` | Hard cap on cumulative spending |
| `TEMPO_AUTH_URL` | Override auth server |
| `TEMPO_SERVICES_URL` | Override MPP directory |
| `TEMPO_RPC_URL` | Override RPC endpoint |
| `TEMPO_HOME` | Override config directory |

---

## Network details

- **Mainnet**: Chain ID 4217, RPC `https://rpc.mainnet.tempo.xyz`
- **Explorer**: https://explore.tempo.xyz
- **Service directory**: https://mpp.sh/api/services
- **Wallet dashboard**: https://wallet.tempo.xyz

---

## Common issues

| Issue | Fix |
|---|---|
| `ready: false` after login | Check if login process is alive with `pgrep -f "tempo wallet login"`. If dead, restart with `setsid`. If alive, wait and retry. |
| Login process dies between bash calls | Must use `setsid` to detach the process. Plain `&` gets killed when the shell exits. |
| Network/domain errors | User needs to allow all domains in Claude settings (profile → settings → capabilities → network access). |
| Balance is 0 | Deposit at wallet.tempo.xyz/?action=fund. |
| HTTP 422 on service call | Check exact field names via `services <ID>`. |
| `access key does not exist` | Logout and re-login: `tempo wallet logout --yes` then redo Step 4. |
| Spending limit exceeded | Re-authorize with higher limits from wallet.tempo.xyz. |
