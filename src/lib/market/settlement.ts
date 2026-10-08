import { createPublicClient, createWalletClient, erc20Abi, http, isAddress, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { baseSepolia, sepolia, type Chain } from "viem/chains";

/**
 * Settlement rails: where escrowed money actually moves.
 *
 * - "base-sepolia" (default) or "sepolia" (MARKET_CHAIN=sepolia): real USDC
 *   transfers on that testnet.
 *     lock    buyer agent wallet  → escrow agent wallet
 *     release escrow agent wallet → provider's payout address
 *     refund  escrow agent wallet → buyer agent wallet
 *   The escrow is CUSTODIAL: an agent-held wallet, not a smart contract.
 * - "simulated": no keys configured; nothing moves and every deal says so.
 *
 * Keys come only from environment variables, never from the repository:
 *   MARKET_BUYER_PRIVATE_KEY, MARKET_ESCROW_PRIVATE_KEY, MARKET_CHAIN, MARKET_RPC_URL.
 *
 * Every transfer is simulated against the chain before it is sent, so a
 * transfer that would fail (no USDC, no gas) is refused BEFORE broadcast and
 * is safe to retry. A failure after broadcast is reported as possibly sent
 * and is never retried automatically.
 */

/** Circle's USDC on Base Sepolia (developers.circle.com/stablecoins/usdc-contract-addresses). */
export const USDC_BASE_SEPOLIA: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export type Network = "base-sepolia" | "sepolia";

/** MARKET_CHAIN picks the testnet; Circle's USDC contract on each. */
export const NETWORKS: Record<Network, { chain: Chain; usdc: Address; explorer: string; label: string }> = {
  "base-sepolia": { chain: baseSepolia, usdc: USDC_BASE_SEPOLIA, explorer: "https://sepolia.basescan.org", label: "Base Sepolia" },
  sepolia: { chain: sepolia, usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", explorer: "https://sepolia.etherscan.io", label: "Ethereum Sepolia" },
};

export function selectedNetwork(): Network {
  return process.env.MARKET_CHAIN?.trim().toLowerCase() === "sepolia" ? "sepolia" : "base-sepolia";
}

export interface TxRecord {
  network: Network;
  hash: string;
  url: string;
  from: string;
  to: string;
  amountUsd: number;
  at: number;
}

export type TransferResult =
  | { ok: true; tx: TxRecord | null }
  | { ok: false; reason: string; broadcast: boolean };

export interface SettlementRail {
  mode: "simulated" | Network;
  /** Block explorer base URL, null when simulated. */
  explorer: string | null;
  buyerAddress: string | null;
  escrowAddress: string | null;
  lock(amountUsd: number): Promise<TransferResult>;
  release(to: string, amountUsd: number): Promise<TransferResult>;
  refund(amountUsd: number): Promise<TransferResult>;
}

export const simulatedRail: SettlementRail = {
  mode: "simulated",
  explorer: null,
  buyerAddress: null,
  escrowAddress: null,
  lock: async () => ({ ok: true, tx: null }),
  release: async () => ({ ok: true, tx: null }),
  refund: async () => ({ ok: true, tx: null }),
};

function accountFrom(name: string): PrivateKeyAccount | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    console.warn(`[market] ${name} is not a 32-byte hex private key; settlement stays simulated`);
    return null;
  }
  return privateKeyToAccount(key);
}

function testnetRail(network: Network, buyer: PrivateKeyAccount, escrow: PrivateKeyAccount): SettlementRail {
  const { chain, usdc, explorer } = NETWORKS[network];
  // viem's default Sepolia RPC needs a thirdweb client id, so use a public node instead.
  const rpc = process.env.MARKET_RPC_URL?.trim()
    || (network === "base-sepolia" ? process.env.BASE_SEPOLIA_RPC_URL?.trim() : "https://ethereum-sepolia-rpc.publicnode.com");
  const transport = http(rpc || undefined);
  const publicClient = createPublicClient({ chain, transport });

  async function transfer(from: PrivateKeyAccount, to: string, amountUsd: number): Promise<TransferResult> {
    if (!isAddress(to)) return { ok: false, reason: `Not a valid address: ${to}`, broadcast: false };
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return { ok: false, reason: "Amount must be positive", broadcast: false };
    const value = parseUnits(amountUsd.toFixed(6), 6);
    const wallet = createWalletClient({ account: from, chain, transport });

    let hash: Hex;
    try {
      // Dry run first: insufficient USDC or gas fails here, before anything is sent.
      const { request } = await publicClient.simulateContract({
        account: from, address: usdc, abi: erc20Abi, functionName: "transfer", args: [to as Address, value],
      });
      hash = await wallet.writeContract(request);
    } catch (error) {
      return { ok: false, reason: `Transfer refused before sending: ${shortError(error)}`, broadcast: false };
    }
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success") return { ok: false, reason: `Transaction ${hash} reverted`, broadcast: true };
    } catch (error) {
      return { ok: false, reason: `Transaction ${hash} was sent but not confirmed yet: ${shortError(error)}`, broadcast: true };
    }
    return { ok: true, tx: { network, hash, url: `${explorer}/tx/${hash}`, from: from.address, to, amountUsd, at: Date.now() } };
  }

  return {
    mode: network,
    explorer,
    buyerAddress: buyer.address,
    escrowAddress: escrow.address,
    lock: (amountUsd) => transfer(buyer, escrow.address, amountUsd),
    release: (to, amountUsd) => transfer(escrow, to, amountUsd),
    refund: (amountUsd) => transfer(escrow, buyer.address, amountUsd),
  };
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? (error as { shortMessage?: string }).shortMessage ?? error.message : String(error);
  return message.split("\n")[0].slice(0, 200);
}

let override: SettlementRail | null = null;
let cached: SettlementRail | null = null;

/** The active rail: Base Sepolia when both keys are set, otherwise simulated. */
export function settlementRail(): SettlementRail {
  if (override) return override;
  if (cached) return cached;
  const buyer = accountFrom("MARKET_BUYER_PRIVATE_KEY");
  const escrow = accountFrom("MARKET_ESCROW_PRIVATE_KEY");
  cached = buyer && escrow ? testnetRail(selectedNetwork(), buyer, escrow) : simulatedRail;
  return cached;
}

/** Tests only: swap the rail (null restores the environment-based one). */
export function setSettlementRail(rail: SettlementRail | null): void {
  override = rail;
}
