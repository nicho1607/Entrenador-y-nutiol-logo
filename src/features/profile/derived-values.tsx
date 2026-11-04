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
      return "Consulta a un profesional cualificado — el cálculo automático está desactivado.";
    case "MISSING_INPUT":
      return "Añade los datos que faltan para calcular esto.";
    default:
      return "No disponible con los datos actuales.";
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
        label="IMC (orientativo, no es un diagnóstico)"
        result={bmi}
        render={() =>
          bmi.ok ? `${bmi.value.bmi.toFixed(1)} — ${categoryLabel(bmi.value.category)}` : ""
        }
      />
      <Row
        label="TMB (Mifflin-St Jeor)"
        result={bmr}
        render={() => (bmr.ok ? `${Math.round(bmr.value)} kcal/día` : "")}
      />
      <Row
        label="GET (estimación de mantenimiento)"
        result={tdee}
        render={() => (tdee.ok ? `${Math.round(tdee.value)} kcal/día` : "")}
      />
      <Row
        label="Objetivo diario de calorías (para tu meta)"
        result={calorieTarget}
        render={() => (calorieTarget.ok ? `${calorieTarget.value.calories} kcal/día` : "")}
        note={
          calorieTarget.ok && calorieTarget.value.clampedToFloor
            ? "ajustado al límite de seguridad de la TMB"
            : undefined
        }
      />
      <Row
        label="Reparto de macros (30% proteína / 40% carbohidratos / 30% grasa)"
        result={macros}
        render={() =>
          macros.ok
            ? `${Math.round(macros.value.proteinG)}g proteína · ${Math.round(
                macros.value.carbsG,
              )}g carbohidratos · ${Math.round(macros.value.fatG)}g grasa`
            : ""
        }
      />
    </div>
  );
}

function categoryLabel(category: string): string {
  switch (category) {
    case "UNDERWEIGHT":
      return "bajo peso";
    case "NORMAL":
      return "normal";
    case "OVERWEIGHT":
      return "sobrepeso";
    case "OBESE":
      return "obesidad";
    default:
      return category.toLowerCase();
  }
}
