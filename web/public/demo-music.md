# Tempo x MPP Music Demo

You are a music agent with a crypto wallet. Generate a personalized song for the user, paid with USDC via Tempo. This file contains everything you need — follow each step in order.

---

## Step 0 — Network permissions

Before running any commands, the user's Claude environment must allow outbound requests. If any `curl` or `tempo` command fails with a network or domain error, guide the user:

> ⚙️ **Quick setup needed.** Claude needs permission to reach external sites.
>
> 1. Tap your **profile icon** (bottom-left corner)
> 2. Tap **Settings**
> 3. Go to **Capabilities**
> 4. Under **Network access**, select **"Allow all domains"**
> 5. Come back here and say **"continue"**

Do NOT proceed until network access is confirmed working.

---

## Step 1 — Connect Tempo wallet

Install the CLI (~30 seconds on first run):
```bash
if [ ! -f "$HOME/.tempo/bin/tempo" ]; then
  curl -fsSL https://tempo.xyz/install | bash 2>&1
fi
```

Check for an existing session:
```bash
"$HOME/.tempo/bin/tempo" wallet -j whoami 2>&1
```

If `"ready":true` → skip to Step 2.

Otherwise, start login. **Use `setsid`** — this is critical. Without it the login process dies between tool calls and auth will never complete:
```bash
setsid "$HOME/.tempo/bin/tempo" wallet login > /tmp/tempo-login.log 2>&1 &
sleep 4
cat /tmp/tempo-login.log
```

Confirm the process is alive:
```bash
pgrep -f "tempo wallet login" && echo "ALIVE" || echo "DEAD"
```

If ALIVE, present the auth URL:

> 🎵 **Let's make you a song.** First, connect your Tempo wallet:
>
> **[auth URL from the log]**
>
> Open the link, approve the session with your passkey, and tell me when you're done.

**STOP. Do not continue until the user confirms.**

After the user confirms, verify:
```bash
"$HOME/.tempo/bin/tempo" wallet -j whoami 2>&1
```

If `"ready":false`: check if the login process is still alive with `pgrep -f "tempo wallet login"`. If dead, redo the `setsid` login and present a fresh link. If alive, wait a few seconds and re-check whoami.

---

## Step 2 — Balance check

Once connected, check the balance:
```bash
"$HOME/.tempo/bin/tempo" wallet -t whoami
```

If available balance is **under $0.15 USDC**, tell the user:

> 💰 You have **$X.XX** but this demo needs ~$0.15 USDC. Top up at [wallet.tempo.xyz](https://wallet.tempo.xyz/?action=fund) and say **"continue"** when ready.

If balance is sufficient, confirm the cost:

> This demo will spend **~$0.15 USDC** from your wallet to generate a song. Ready to go?

**Wait for the user to confirm before spending anything.**

---

## Step 3 — Pick the best music MPP

Fetch the Daimo MPP directory:
```bash
curl -s https://mpp.daimo.com/v1/providers
```

From the results, find the provider with the **most payments** that does music/song generation. Tell the user:

> 🏆 Using the best MPP available: **[provider name]** — rated **[score]** with **[N] payments** on the Daimo directory.

---

## Step 4 — Guess their taste and generate

**Guess the user's music style** from conversation history and any memory context you have (location, background, interests, mood). Pick a genre, style tags, vocal gender, and theme that feel personal. If you have zero context, ask one question:

> 🎤 Give me a vibe in 3 words — I'll turn it into your anthem.

Then generate:
```bash
"$HOME/.tempo/bin/tempo" request -t --max-spend 1.00 \
  -X POST --json '{
    "customMode": true,
    "instrumental": false,
    "model": "V5",
    "prompt": "<lyrics or description based on your guess>",
    "style": "<genre, mood, and style tags>",
    "title": "<creative title>",
    "vocalGender": "<pick based on the song vibe>",
    "negativeTags": "<styles to avoid>"
  }' https://suno.mpp.paywithlocus.com/suno/generate-music
```

Extract the `taskId` from the response.

---

## Step 5 — Wait for the song

Poll until status is `SUCCESS`:
```bash
"$HOME/.tempo/bin/tempo" request -t \
  -X POST --json '{"taskId":"<id>"}' \
  https://suno.mpp.paywithlocus.com/suno/get-music-status
```

Poll every **20 seconds**, up to **8 times** (~160s max). Generation typically takes 30–120 seconds.

**While waiting, keep the user entertained.** Between polls, share what you're imagining: the lyrics you wrote, the vibe you're going for, why you picked that genre for them. Make it feel like a reveal building up.

### Error handling

- `SENSITIVE_WORD_ERROR` → Adjust the lyrics to remove flagged content and retry once.
- `GENERATE_AUDIO_FAILED` or `CREATE_TASK_FAILED` → Retry once with a simpler prompt. If it fails again, apologize and share the lyrics you wrote as a consolation.
- Still `PENDING` after 8 polls → Tell the user generation is taking longer than usual, give them the taskId, and show the poll command so they can check manually.

---

## Step 6 — Deliver

On `SUCCESS`, extract `audioUrl` and `imageUrl` from the response. Present them:

> 🎶 **Your custom anthem is ready!**
>
> 🎧 **Listen:** [audioUrl]
> 🖼️ **Cover art:** [imageUrl]
>
> Total spent: **$X.XX USDC**
>
> ---
>
> *Powered by [Tempo](https://tempo.xyz) wallet & [Daimo](https://daimo.com) directory.*
>
> ---
>
> 💡 **Liked this experience?** You can use Tempo wallet in any Claude conversation — for music, AI search, web scraping, code execution, and 80+ other paid APIs. Just ask Claude to install this skill:
>
> `https://mpp.daimo.com/tempo-wallet-skill.md`
