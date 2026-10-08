import type { AgentAction, ChatMessage, HumanGateReceipt, RecipeRun, RiskAssessment } from "@/lib/types";

export type TrailEntry =
  | { id: string; kind: "approval"; timestamp: number; action: AgentAction; receipt: HumanGateReceipt }
  | { id: string; kind: "execution"; timestamp: number; action: AgentAction; result: RecipeRun }
  | { id: string; kind: "rejection"; timestamp: number; action: AgentAction; message: string };

export type DashboardState = {
  assessment: RiskAssessment | null;
  messages: ChatMessage[];
  pendingAction: AgentAction | null;
  receipt: HumanGateReceipt | null;
  trail: TrailEntry[];
  isMock: boolean;
  linkNotice: string | null;
};