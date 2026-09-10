import type { Evaluator } from "../domain/evaluator.ts";
import { CompositeEvaluator } from "./composite-evaluator.ts";
import { HeuristicDesignEvaluator } from "./heuristic-evaluator.ts";
import { StructureEvaluator } from "./structure-evaluator.ts";

export function buildDefaultEvaluator(): Evaluator {
  // LLM judging can sit beside these later. Until then the composite is the product.
  return new CompositeEvaluator([new StructureEvaluator(), new HeuristicDesignEvaluator()]);
}
