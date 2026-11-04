/**
 * OPTIONAL AI recommendation seam for FitMind AI (Phase 6).
 *
 * This is a DISABLED seam, not a live integration. It exists so a future AI
 * provider can be plugged in WITHOUT touching the rule/safety engine, while the
 * app ships and runs fully with NO API key and NO extra dependency. It is OFF
 * by default and is gated behind the `FITMIND_AI_ENABLED` env var.
 *
 * Hard rules this seam preserves:
 *  - AI NEVER overrides rule-based or safety logic. The service only ever
 *    APPENDS AI items AFTER the engine's rule/calculation output.
 *  - Every AI-produced item MUST carry `basis: 'ai'` so the UI can label it.
 *  - No live provider is called and NO model output is fabricated: when
 *    disabled (the default), `generate` resolves to an empty array.
 */
import type { EngineInput, Recommendation } from "@/lib/domain/recommendations";

/**
 * Produces AI-assisted recommendations from the same already-computed
 * `EngineInput` the rule engine reads. Every returned item must have
 * `basis: 'ai'`.
 */
export interface AiRecommender {
  generate(input: EngineInput): Promise<Recommendation[]>;
}

/**
 * The disabled stub. It takes no provider, performs no network call, and NEVER
 * fabricates model output — it simply resolves to no recommendations. The
 * unused `input` parameter documents the real interface a live recommender
 * would consume.
 */
const disabledAiRecommender: AiRecommender = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(_input: EngineInput): Promise<Recommendation[]> {
    // Disabled seam: no provider is configured, so there is nothing to return.
    // Returning [] (never a fabricated item) keeps the app honest with no key.
    return [];
  },
};

/**
 * Returns the configured AI recommender. AI is OPTIONAL and OFF by default:
 * only when `FITMIND_AI_ENABLED === 'true'` would a real recommender be wired
 * in. The current build ships ONLY the disabled stub (no live provider exists),
 * so this always returns the stub — but the flag check documents exactly where
 * a future provider would be selected without changing the rule/safety engine.
 */
export function getAiRecommender(): AiRecommender {
  const enabled = process.env.FITMIND_AI_ENABLED === "true";
  if (!enabled) {
    return disabledAiRecommender;
  }

  // The AI layer is a seam only: no live provider ships in this build, so even
  // when the flag is on there is no model to call and we fall back to the
  // disabled stub rather than fabricate output. A future provider would be
  // constructed and returned here.
  return disabledAiRecommender;
}
