"use client";

/**
 * Generate → preview → save flow for a native workout plan. Mirrors the
 * profile-form client pattern: useTransition for the pending state, the shared
 * action-state shape for results, and no fabricated output. The plan comes
 * entirely from the server action (which sources the user's profile + active
 * goal from the session); this form offers no plan data of its own — if
 * generation fails it shows the DomainResult message and renders nothing.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { GeneratedPlan } from "@/lib/domain/plan-generator";
import { generatePlanAction, savePlanAction } from "./actions";
import { MUSCLE_GROUP_LABELS } from "./labels";

export function GeneratePlanForm() {
  const router = useRouter();
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isGenerating, startGenerate] = useTransition();
  const [isSaving, startSave] = useTransition();

  function onGenerate() {
    setMessage(null);
    setSaved(false);
    startGenerate(async () => {
      const result = await generatePlanAction({});
      if (result.status === "success" && result.plan) {
        setPlan(result.plan);
        setMessage(result.message ?? "Plan generated.");
      } else {
        setPlan(null);
        setMessage(result.message ?? "Could not generate a plan.");
      }
    });
  }

  function onSave() {
    if (!plan) return;
    setMessage(null);
    startSave(async () => {
      const result = await savePlanAction(plan);
      if (result.status === "success") {
        setSaved(true);
        setMessage("Plan saved to your account.");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not save the plan.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating..." : plan ? "Regenerate plan" : "Generate a plan"}
        </Button>
        {plan && !saved ? (
          <Button type="button" variant="secondary" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save this plan"}
          </Button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}

      {plan ? <PlanPreview plan={plan} /> : null}
    </div>
  );
}

function PlanPreview({ plan }: { plan: GeneratedPlan }) {
  return (
    <section aria-label="Generated plan preview" className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        ) : null}
      </div>

      <ol className="flex flex-col gap-5">
        {plan.days.map((day) => (
          <li key={day.order} className="rounded-md border border-border p-4">
            <h4 className="text-sm font-semibold">
              Day {day.order}: {day.name}
            </h4>
            <ul className="mt-3 flex flex-col gap-3">
              {day.exercises.map((exercise) => (
                <li key={exercise.order} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{exercise.exerciseName}</span>
                    <span className="text-xs text-muted-foreground">
                      {MUSCLE_GROUP_LABELS[exercise.primaryMuscle]} · {exercise.sets} ×{" "}
                      {exercise.repsMin}-{exercise.repsMax} reps
                      {exercise.restSeconds != null
                        ? ` · ${exercise.restSeconds}s rest`
                        : ""}
                      {exercise.targetRir != null ? ` · RIR ${exercise.targetRir}` : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{exercise.reason}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
