/**
 * Presentation of the nutrition targets. Reuses the profile feature's
 * `DerivedValuesList` for BMI/BMR/TDEE/calorie-target/macros (so BMI stays
 * labeled orientational, the BMR safety-floor clamp is shown, and the
 * missing-input / consult-a-professional signals render as the existing copy —
 * never a fabricated number) and adds the orientational water target. It never
 * invents a value the domain library declined to produce.
 */
import { DerivedValuesList } from "@/features/profile/derived-values";
import type { NutritionTargets } from "./service";

function signalText(reason: string): string {
  switch (reason) {
    case "PROFESSIONAL_REVIEW_REQUIRED":
      return "Consulta a un profesional cualificado — el cálculo automático está desactivado.";
    case "MISSING_INPUT":
      return "Añade los datos que faltan para calcular esto.";
    default:
      return "No disponible con los datos actuales.";
  }
}

export function NutritionTargetsView({ targets }: { targets: NutritionTargets }) {
  const { derived, waterTargetMl } = targets;

  return (
    <div className="flex flex-col gap-4">
      <DerivedValuesList derived={derived} />
      <div className="flex flex-col gap-0.5 border-t border-border pt-3">
        <span className="text-sm font-medium">Objetivo diario de agua (orientativo)</span>
        {waterTargetMl.ok ? (
          <span className="text-sm text-foreground">
            {Math.round(waterTargetMl.value)} ml (~{(waterTargetMl.value / 1000).toFixed(1)} L)
            <span className="text-muted-foreground"> — ~35 ml por kg de peso corporal</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {signalText(waterTargetMl.reason)}
          </span>
        )}
      </div>
    </div>
  );
}
