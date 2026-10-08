import type { RecipeRef } from "../types.ts";

export const recipes: RecipeRef[] = [
  {
    recipeId: "wallet-risk-trace",
    name: "Human-gated wallet check",
    description: "Read live wallet activity, score its risk, create a pending approval action, and wait for a human decision before any paid follow-up.",
  },
];

export function findRecipe(recipeId: string): RecipeRef | undefined {
  return recipes.find((recipe) => recipe.recipeId === recipeId);
}