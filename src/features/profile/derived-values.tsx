/**
 * Presentation of the computed nutrition values. Reads a `DerivedValues` bag
 * (each entry a DomainResult) and renders either the number or the domain
 * library's "missing input" / "consult a professional" signal. It never
 * fabricates a value when the library declined to produce one.
 */
import type { DerivedValues } from "./service";
import type { DomainResult } from "@/lib/domain/types";

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

function Row({
  label,
  result,
  render,
  note,
}: {
  label: string;
  result: DomainResult<unknown>;
  render: () => string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0">
      <span className="text-sm font-medium">{label}</span>
      {result.ok ? (
        <span className="text-sm text-foreground">
          {render()}
          {note ? <span className="text-muted-foreground"> — {note}</span> : null}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">{signalText(result.reason)}</span>
      )}
    </div>
  );
}

export function DerivedValuesList({ derived }: { derived: DerivedValues }) {
  const { bmi, bmr, tdee, calorieTarget, macros } = derived;

  return (
    <div className="flex flex-col">
      <Row
        label="BMI (orientational, not a diagnosis)"
        result={bmi}
        render={() =>
          bmi.ok ? `${bmi.value.bmi.toFixed(1)} — ${categoryLabel(bmi.value.category)}` : ""
        }
      />
      <Row
        label="BMR (Mifflin-St Jeor)"
        result={bmr}
        render={() => (bmr.ok ? `${Math.round(bmr.value)} kcal/day` : "")}
      />
      <Row
        label="TDEE (maintenance estimate)"
        result={tdee}
        render={() => (tdee.ok ? `${Math.round(tdee.value)} kcal/day` : "")}
      />
      <Row
        label="Daily calorie target (for your goal)"
        result={calorieTarget}
        render={() => (calorieTarget.ok ? `${calorieTarget.value.calories} kcal/day` : "")}
        note={
          calorieTarget.ok && calorieTarget.value.clampedToFloor
            ? "clamped to the BMR safety floor"
            : undefined
        }
      />
      <Row
        label="Macro split (30% protein / 40% carbs / 30% fat)"
        result={macros}
        render={() =>
          macros.ok
            ? `${Math.round(macros.value.proteinG)}g protein · ${Math.round(
                macros.value.carbsG,
              )}g carbs · ${Math.round(macros.value.fatG)}g fat`
            : ""
        }
      />
    </div>
  );
}

function categoryLabel(category: string): string {
  switch (category) {
    case "UNDERWEIGHT":
      return "underweight";
    case "NORMAL":
      return "normal";
    case "OVERWEIGHT":
      return "overweight";
    case "OBESE":
      return "obese";
    default:
      return category.toLowerCase();
  }
}
