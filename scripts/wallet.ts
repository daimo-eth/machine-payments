/** Test wallet for sending EVM transfers. Uses EVM_TEST_WALLET_PRIVATE_KEY. */

import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  type Hex,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, arbitrum } from "viem/chains";

// -- Token config --

type TokenDef = {
  symbol: string;
  address: Hex;
  decimals: number;
  chain: typeof base | typeof arbitrum;
};

const TOKENS: Record<string, TokenDef> = {
  "base-usdc": { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, chain: base },
  "arb-usdc": { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, chain: arbitrum },
  "base-eth": { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18, chain: base },
  "arb-eth": { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18, chain: arbitrum },
};

const ERC20_ABI = [
  { name: "balanceOf", type: "function", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "transfer", type: "function", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

function isNative(token: TokenDef) {
  return token.address === "0x0000000000000000000000000000000000000000";
}

// -- Load wallet --

function loadWallet() {
  let pk = process.env.EVM_TEST_WALLET_PRIVATE_KEY;
  if (!pk) { console.error("error: EVM_TEST_WALLET_PRIVATE_KEY not set"); process.exit(1); }
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  return privateKeyToAccount(pk as Hex);
}

// -- Commands --

/** Print wallet address and balances across all configured tokens. */
async function balances() {
  const account = loadWallet();
  console.log(`wallet: ${account.address}\n`);

  for (const [key, token] of Object.entries(TOKENS)) {
    const client = createPublicClient({ chain: token.chain, transport: http() });
    let bal: bigint;
    if (isNative(token)) {
      bal = await client.getBalance({ address: account.address });
    } else {
      bal = await client.readContract({
        address: token.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });
    }
    console.log(`${key.padEnd(12)} ${formatUnits(bal, token.decimals)} ${token.symbol}`);
  }
}

/** Send a transfer. */
async function send(to: Hex, amount: number, tokenKey: string, checkOnly: boolean) {
  const account = loadWallet();
  const token = TOKENS[tokenKey];
  if (!token) {
    console.error(`error: unknown token "${tokenKey}". Available: ${Object.keys(TOKENS).join(", ")}`);
    process.exit(1);
  }

  const client = createPublicClient({ chain: token.chain, transport: http() });

  console.log(`chain:   ${token.chain.name}`);
  console.log(`token:   ${token.symbol}`);
  console.log(`from:    ${account.address}`);
  console.log(`to:      ${to}`);
  console.log(`amount:  ${amount} ${token.symbol}`);
  console.log();

  // Check balance
  let bal: bigint;
  if (isNative(token)) {
    bal = await client.getBalance({ address: account.address });
  } else {
    bal = await client.readContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
  }
  console.log(`balance: ${formatUnits(bal, token.decimals)} ${token.symbol}`);

  const units = parseUnits(amount.toString(), token.decimals);
  if (bal < units) {
    console.error(`error: insufficient balance (need ${amount}, have ${formatUnits(bal, token.decimals)})`);
    process.exit(1);
  }

  if (checkOnly) { console.log("\n--check: balance OK, not sending"); return; }

  // Send
  const wallet = createWalletClient({ account, chain: token.chain, transport: http() });
  console.log("\nsending...");

  let txHash: Hex;
  if (isNative(token)) {
    txHash = await wallet.sendTransaction({ to, value: units });
  } else {
    txHash = await wallet.writeContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, units],
    });
  }
  console.log(`tx:      ${txHash}`);

  console.log("waiting for confirmation...");
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  console.log(`status:  ${receipt.status === "success" ? "success" : "failed"}`);
}

// -- CLI --

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "balance" || cmd === "balances") {
  await balances();
} else if (cmd === "send") {
  const checkOnly = args.includes("--check");
  const positional = args.slice(1).filter(a => !a.startsWith("--"));
  if (positional.length < 2) {
    console.log("Usage: bun scripts/wallet.ts send <to> <amount> [token] [--check]");
    console.log("Tokens: base-usdc (default), arb-usdc, base-eth, arb-eth");
    process.exit(1);
  }
  const [toRaw, amountRaw, tokenKey = "base-usdc"] = positional;
  await send(getAddress(toRaw) as Hex, parseFloat(amountRaw), tokenKey, checkOnly);
} else {
  console.log("Usage: bun scripts/wallet.ts [balance|send <to> <amount> [token] [--check]]");
  process.exit(1);
}
