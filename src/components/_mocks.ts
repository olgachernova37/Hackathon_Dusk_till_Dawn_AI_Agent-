import type {
  AgentAction,
  ChatMessage,
  HumanGateReceipt,
  RecipeRun,
  RiskAssessment,
} from "@/lib/types";

const now = Date.now();

export const lowRiskAssessment: RiskAssessment = {
  score: 18,
  reasons: ["Wallet has 148 transactions across 39 counterparties", "Wallet first seen 402 days ago (2025-08-05)"],
  evidence: {
    address: "0x742d...44e",
    firstSeen: now - 402 * 86400000,
    txCount: 148,
    uniqueCounterparties: 39,
    totalVolumeUsd: 184230.42,
    topCounterparties: [{ address: "0x1f98...91c", count: 18 }],
    source: { subgraphId: "QmUniswapV3Mainnet", queriedAt: now - 3200 },
  },
};

export const highRiskAssessment: RiskAssessment = {
  score: 78,
  reasons: ["Wallet first seen 3 days ago (2026-09-08)", "Only 4 transactions across 2 counterparties", "92% of volume routes through one counterparty"],
  evidence: {
    address: "0x8b3a...c21",
    firstSeen: now - 3 * 86400000,
    txCount: 4,
    uniqueCounterparties: 2,
    totalVolumeUsd: 12500,
    topCounterparties: [{ address: "0xdead...beef", count: 3 }],
    source: { subgraphId: "QmUniswapV3Mainnet", queriedAt: now - 3200 },
  },
};

export const pendingAction: AgentAction = {
  id: "action-demo-001",
  kind: "recipe_run",
  summary: "Trace the proposed swap and screen the destination before settlement",
  payload: { wallet: "0x8b3a...c21", amount: "5 ETH", destination: "0xdead...beef" },
  riskScore: 78,
  riskReasons: highRiskAssessment.reasons,
  costUsd: 0.05,
  requiresHuman: true,
  createdAt: now - 18000,
};

export const approvedReceipt: HumanGateReceipt = {
  actionId: pendingAction.id,
  actionHash: "0x9e2f1a7c...b102",
  nullifierHash: "0x4a71f9c2...88de",
  credentialType: "selfie_check",
  verifiedAt: now - 86400000,
  expiresAt: now + 240000,
  continuity: { isReturning: true, firstSeenAt: now - 12 * 86400000, approvalCount: 4, daysKnown: 12 },
};

export const approvedAndExecuted: RecipeRun = {
  recipeId: "wallet-risk-trace",
  status: "success",
  steps: [
    { name: "risk evidence", service: "The Graph", ok: true, output: "live assessment attached" },
    { name: "settlement", service: "Bazantic x402", ok: true, output: "gateway receipt accepted" },
  ],
  costUsd: pendingAction.costUsd,
  txHash: "0xsettled-demo-7f2a",
};

export const messages: ChatMessage[] = [
  { id: "m1", role: "user", content: "Is this wallet safe to send 5 ETH to?" },
  { id: "m2", role: "assistant", content: "The wallet is high risk. I found a young address with concentrated counterparties and prepared a gated trace." , action: pendingAction },
];

export const rejectedReceipt: HumanGateReceipt = {
  ...approvedReceipt,
  actionId: "action-rejected-002",
  nullifierHash: "0x19aa02fd...c441",
  continuity: { isReturning: false, firstSeenAt: now, approvalCount: 1, daysKnown: 0 },
};