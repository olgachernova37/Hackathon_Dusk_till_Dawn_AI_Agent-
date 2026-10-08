import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { serverEnv } from "@/lib/env";
import { RECEIPT_TTL_MS, type HumanGateReceipt } from "@/lib/types";
// Single source of truth for pending actions and receipts: the agent store is
// where /api/agent/plan registers actions and where /api/agent/execute reads
// receipts. A separate store here meant verify could never see a pending action.
import { getPendingAction, saveReceipt } from "@/lib/agent/store";
import { recordApproval } from "@/lib/worldid/continuity";
import { hashAction } from "@/lib/worldid/hash";

type VerifyBody = { rp_id: string; idkitResponse: unknown; actionId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<Response> {
  let body: VerifyBody;
  try {
    const candidate: unknown = await request.json();
    if (!isRecord(candidate) || typeof candidate.rp_id !== "string" || typeof candidate.actionId !== "string" || !("idkitResponse" in candidate)) {
      return Response.json({ error: "Invalid verification request" }, { status: 400 });
    }
    body = { rp_id: candidate.rp_id, actionId: candidate.actionId, idkitResponse: candidate.idkitResponse };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = await getPendingAction(body.actionId);
  if (!action) return Response.json({ error: "Pending action not found" }, { status: 404 });

  const expectedHash = hashAction(action.payload);
  if (!isRecord(body.idkitResponse) || !Array.isArray(body.idkitResponse.responses) || body.idkitResponse.responses.length === 0) {
    return Response.json({ error: "IDKit response has no credential response" }, { status: 400 });
  }
  const responseItem = body.idkitResponse.responses[0];
  // The proof must be bound to THIS action's payload. IDKit normally reports
  // signal_hash as the field-element hash OF the signal (hashSignal), but
  // accept the raw signal too: either encoding proves the same thing, and the
  // exact form has varied across SDK versions. The error names both values so
  // a mismatch is diagnosable instead of mysterious.
  const expectedSignalHash = hashSignal(expectedHash);
  const receivedSignal = isRecord(responseItem) ? responseItem.signal_hash : undefined;
  if (typeof receivedSignal !== "string" || (receivedSignal !== expectedSignalHash && receivedSignal !== expectedHash)) {
    return Response.json({
      error: `World ID signal does not match pending action (expected ${expectedSignalHash} or ${expectedHash}, got ${String(receivedSignal)})`,
    }, { status: 400 });
  }

  // Verify against OUR relying party, never a client-supplied one. Otherwise a
  // proof issued for someone else's app (bound to our action hash, which is
  // public) would verify as valid for *that* app and open our gate.
  let ourRpId: string;
  try {
    ourRpId = serverEnv().WLD_RP_ID;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "WLD_RP_ID is not configured" }, { status: 500 });
  }
  if (body.rp_id !== ourRpId) {
    return Response.json({ error: "Proof was requested for a different relying party" }, { status: 400 });
  }

  try {
    // No Authorization header: World's v4 verify endpoint is unauthenticated
    // (its OpenAPI spec declares `security: []`), so no API key is needed.
    const verification = await fetch(`https://developer.world.org/api/v4/verify/${encodeURIComponent(ourRpId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.idkitResponse),
    });
    if (!verification.ok) {
      const detail = await verification.text();
      return Response.json({ error: `World ID verification failed: ${detail}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown verification error";
    return Response.json({ error: `World ID verification unavailable: ${message}` }, { status: 502 });
  }

  if (typeof responseItem.nullifier !== "string" || responseItem.nullifier.length === 0) {
    return Response.json({ error: "World ID response has no nullifier" }, { status: 400 });
  }
  const now = Date.now();
  const receipt: HumanGateReceipt = {
    actionId: action.id,
    actionHash: expectedHash,
    nullifierHash: responseItem.nullifier,
    credentialType: responseItem.identifier === "selfie" ? "selfie_check" : "device",
    verifiedAt: now,
    expiresAt: now + RECEIPT_TTL_MS,
    continuity: await recordApproval(responseItem.nullifier),
  };
  await saveReceipt(receipt);
  return Response.json(receipt);
}