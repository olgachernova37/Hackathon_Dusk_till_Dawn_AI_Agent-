import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, type Signer } from "x402-fetch";

/** The EchoBrief gateway's 402 challenge asks for USDC on Base mainnet (network "base"). */
const settlementChain = base;

/**
 * Bazantic's v1 402 body sends `resource` as a path and omits `description`
 * and `mimeType`, which x402-fetch v1's schema requires. None of these are
 * signed, so fill them in before x402-fetch validates the challenge.
 */
function normalizeChallenges(fetchImplementation: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await fetchImplementation(input, init);
    if (response.status !== 402) return response;
    const body = await response.clone().json().catch(() => null) as { accepts?: Record<string, unknown>[] } | null;
    if (!Array.isArray(body?.accepts)) return response;
    const requestUrl = input instanceof Request ? input.url : String(input);
    const accepts = body.accepts.map((requirement) => ({
      ...requirement,
      resource: new URL(typeof requirement.resource === "string" ? requirement.resource : "", requestUrl).href,
      description: typeof requirement.description === "string" ? requirement.description : "",
      mimeType: typeof requirement.mimeType === "string" ? requirement.mimeType : "application/json",
    }));
    return Response.json({ ...body, accepts }, { status: 402, headers: response.headers });
  };
}

export function createPaidFetch(fetchImplementation: typeof globalThis.fetch = globalThis.fetch): typeof globalThis.fetch {
  const privateKey = process.env.X402_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing X402_PRIVATE_KEY: configure a burner wallet for paid Bazantic requests");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Invalid X402_PRIVATE_KEY: expected a 32-byte 0x-prefixed private key");
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: settlementChain, transport: http() });
  // TODO(bazantic): migrate to @x402/fetch when Bazantic confirms v2 support.
  // x402-fetch v1's Signer declaration predates the current viem client types;
  // the runtime API is the documented wallet-client adapter.
  return wrapFetchWithPayment(normalizeChallenges(fetchImplementation), walletClient as unknown as Signer) as typeof globalThis.fetch;
}