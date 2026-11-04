/**
 * Presentation-only recommendation card (Phase 6).
 *
 * No 'use server', no data access, no business logic: it renders a single
 * already-computed `Recommendation`. The basis badge makes HOW the advice was
 * produced explicit ('Calculation' | 'Rule-based' | 'AI-assisted'), and the
 * severity + rationale + evidence make the uncertainty and the supporting facts
 * visible. It reuses the shared Card primitives and theme classes.
 */
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type {
  Recommendation,
  RecommendationBasis,
  RecommendationSeverity,
} from "@/lib/domain/recommendations";

/** Human label for each basis. */
const BASIS_LABEL: Record<RecommendationBasis, string> = {
  calculation: "Cálculo",
  rule: "Basado en reglas",
  ai: "Asistido por IA",
};

/** Badge styling per basis (only the project's defined theme tokens). */
const BASIS_BADGE: Record<RecommendationBasis, string> = {
  calculation: "border-border bg-muted text-muted-foreground",
  rule: "border-primary bg-primary text-primary-foreground",
  ai: "border-border bg-muted text-foreground",
};

/** Human label for each severity. */
const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
  info: "Información",
  warning: "Merece atención",
  critical: "Importante",
};

/** Left-border accent per severity (only the project's defined theme tokens). */
const SEVERITY_ACCENT: Record<RecommendationSeverity, string> = {
  info: "border-l-border",
  warning: "border-l-primary",
  critical: "border-l-foreground",
};

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const { basis, severity, title, rationale, evidence } = recommendation;

  return (
    <Card className={cn("border-l-4", SEVERITY_ACCENT[severity])}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              BASIS_BADGE[basis],
            )}
          >
            {BASIS_LABEL[basis]}
          </span>
          <span className="text-xs text-muted-foreground">{SEVERITY_LABEL[severity]}</span>
        </div>

        <h3 className="text-base font-semibold leading-snug text-foreground">{title}</h3>

        <p className="text-sm text-muted-foreground">{rationale}</p>

        {evidence.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evidencia
            </p>
            <ul className="flex flex-col gap-1 text-sm text-foreground">
              {evidence.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted-foreground">
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
