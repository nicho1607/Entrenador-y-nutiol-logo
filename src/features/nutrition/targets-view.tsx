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
      return "Consult a qualified professional — automatic targeting is disabled.";
    case "MISSING_INPUT":
      return "Add the missing inputs to compute this.";
    default:
      return "Not available with the current inputs.";
  }
}

export function NutritionTargetsView({ targets }: { targets: NutritionTargets }) {
  const { derived, waterTargetMl } = targets;

  return (
    <div className="flex flex-col gap-4">
      <DerivedValuesList derived={derived} />
      <div className="flex flex-col gap-0.5 border-t border-border pt-3">
        <span className="text-sm font-medium">Daily water target (orientational)</span>
        {waterTargetMl.ok ? (
          <span className="text-sm text-foreground">
            {Math.round(waterTargetMl.value)} ml (~{(waterTargetMl.value / 1000).toFixed(1)} L)
            <span className="text-muted-foreground"> — ~35 ml per kg body weight</span>
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
