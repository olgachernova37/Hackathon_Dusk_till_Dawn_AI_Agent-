import { signRequest } from "@worldcoin/idkit-server";
import { clientEnv, serverEnv } from "@/lib/env";
import type { RpContext } from "@/lib/types";

/*
 * Signs the relying-party context the IDKit widget sends to the World App.
 *
 * Uses World's official signer. The signed message is a binary payload —
 * version || nonce || createdAt || expiresAt || action — with EIP-191, matching
 * the protocol verifier (`compute_rp_signature_msg` in world-id-primitives).
 * An earlier version signed JSON.stringify(context) instead: a different
 * message, so the World App would have rejected every approval request.
 */
export async function GET(): Promise<Response> {
  try {
    const env = serverEnv();
    // Uniqueness proofs must bind the action, and it must be the exact action
    // the widget requests — an empty one would sign the wrong message.
    const action = clientEnv.NEXT_PUBLIC_WLD_ACTION;
    if (!action) throw new Error("NEXT_PUBLIC_WLD_ACTION is not set; the RP signature must bind the widget's action");

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: env.WLD_RP_PRIVATE_KEY,
      action,
      ttl: 300,
    });
    return Response.json({
      rp_id: env.WLD_RP_ID,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      signature: sig,
    } satisfies RpContext);
  } catch (error) {
    // Never echo key material: signRequest's errors describe the format only.
    const message = error instanceof Error ? error.message : "RP signing failed";
    return Response.json({ error: { code: "RP_CONTEXT_FAILED", message } }, { status: 500 });
  }
}
