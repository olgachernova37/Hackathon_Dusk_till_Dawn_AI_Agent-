import type {
  AgentAction,
  HumanGateReceipt,
  RecipeRef,
  RecipeRun,
  RiskAssessment,
  SubgraphRef,
  WalletActivity,
} from "@/lib/types";
// Relative, not "@/lib/worldid": the alias only exists inside the bundler, so an
// aliased value import breaks `node --test`. Relative resolves in both.
import * as worldid from "../worldid/index.ts";
import * as graph from "../graph/index.ts";
import * as bazantic from "../bazantic/index.ts";

/*
 * Dependency seam for the agent. Each module is wired with a STATIC import once
 * it is merged into main; until then it resolves to a stub.
 *
 * Why not a runtime dynamic import? An earlier version hid `import("@/lib/x")`
 * from Turbopack via `new Function`. That passed the build but could never work:
 * plain Node cannot resolve the `@/` alias, so the real module never loaded and
 * the `.catch(() => stub)` reported "not merged" even after it was. Static
 * imports make a missing module a build error instead of a silent stub.
 *
 * Integration checklist:
 *   [x] @/lib/worldid  — T3 merged, wired statically below
 *   [x] @/lib/graph    — T2 merged, wired statically below
 *   [x] @/lib/bazantic — T4 merged, wired statically below
 *
 * All three modules are live; no stubs remain.
 */

type GraphDeps = {
  searchSubgraphs(keyword: string): Promise<SubgraphRef[]>;
  runGraphQL<T>(deploymentId: string, query: string, vars?: object): Promise<T>;
  getWalletActivity(address: string): Promise<WalletActivity>;
  assessRisk(activity: WalletActivity): RiskAssessment;
};
type WorldDeps = { assertValidReceipt(receipt: HumanGateReceipt, action: AgentAction): Promise<void> };
type BazanticDeps = { listRecipes(): Promise<RecipeRef[]>; runRecipe(recipeId: string, input: object, receipt: HumanGateReceipt): Promise<RecipeRun> };

const world: WorldDeps = { assertValidReceipt: worldid.assertValidReceipt };
const liveGraph: GraphDeps = {
  searchSubgraphs: graph.searchSubgraphs,
  runGraphQL: graph.runGraphQL,
  getWalletActivity: graph.getWalletActivity,
  assessRisk: graph.assessRisk,
};

// Async signatures are kept so callers need no change when a stub is swapped out.
export async function graphDeps(): Promise<GraphDeps> { return liveGraph; }
export async function worldDeps(): Promise<WorldDeps> { return world; }
const liveBazantic: BazanticDeps = { listRecipes: bazantic.listRecipes, runRecipe: bazantic.runRecipe };
export async function bazanticDeps(): Promise<BazanticDeps> { return liveBazantic; }
