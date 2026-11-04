import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import {
  FrequencyBarChart,
  VolumeByMuscleChart,
  StrengthLineChart,
  CaloriesVsTargetChart,
  MacrosOverTimeChart,
  WeightLineChart,
  MeasurementsLineChart,
} from "@/features/stats/charts/dynamic";
import type { VolumeSeries, VolumeByMuscleRow } from "@/features/stats/charts/volume-by-muscle-chart";
import type { MacrosOverTimeRow } from "@/features/stats/charts/macros-over-time-chart";
import type { MeasurementsLineRow } from "@/features/stats/charts/measurements-line-chart";
import { MUSCLE_GROUP_LABELS } from "@/features/stats/labels";
import { MeasurementForm } from "@/features/body/measurement-form";
import {
  getTrainingFrequency,
  getVolumeByMuscleOverTime,
  getStrengthProgression,
  getPersonalRecords,
  getProgramAdherence,
} from "@/features/trainer/service";
import {
  getCaloriesOverTime,
  getMacrosOverTime,
  getTargetCompliance,
  getMealHistory,
  type NutritionDateRange,
} from "@/features/nutrition/service";
import {
  getWeightHistory,
  getMeasurementHistory,
  getBodyComparison,
} from "@/features/body/service";
import { MEAL_TYPE_LABELS } from "@/features/nutrition/labels";
import type { MuscleGroup } from "@/features/trainer/validation";
import type { TrendDirection } from "@/lib/domain/stats";

/**
 * Full statistics page. A server component: it guards the session, scopes every
 * read to the signed-in user's id, and shapes the real aggregations from the
 * trainer / nutrition / body services into plain chart props. Charts are
 * imported ONLY through the ssr:false dynamic wrappers so Recharts never renders
 * on the server. Every chart has a title, axis units, a legend where relevant,
 * an adjacent accessible text alternative, and an explicit empty state — no
 * sample/fabricated series is ever shipped as real.
 */

/** Short, locale-stable date label for an axis. */
function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The nutrition date range covering the trailing `days` days (inclusive). */
function trailingDays(days: number): NutritionDateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from, to };
}

/** Rounds to at most one decimal place for display. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Arrow glyph for a period-over-period direction. */
function directionGlyph(direction: TrendDirection): string {
  if (direction === "UP") return "▲";
  if (direction === "DOWN") return "▼";
  return "▬";
}

/** Shared "nothing logged yet" block used as each chart's honest empty state. */
function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const nutritionRange = trailingDays(30);

  const [
    frequency,
    volumeOverTime,
    personalRecords,
    adherence,
    caloriesSeries,
    macroSeries,
    compliance,
    mealHistory,
    weightHistory,
    measurementHistory,
    bodyComparison,
  ] = await Promise.all([
    getTrainingFrequency(user.id),
    getVolumeByMuscleOverTime(user.id),
    getPersonalRecords(user.id),
    getProgramAdherence(user.id),
    getCaloriesOverTime(user.id, nutritionRange),
    getMacrosOverTime(user.id, nutritionRange),
    getTargetCompliance(user.id, nutritionRange),
    getMealHistory(user.id, nutritionRange),
    getWeightHistory(user.id),
    getMeasurementHistory(user.id),
    getBodyComparison(user.id),
  ]);

  // Strength progression: chart the first exercise that has personal-record
  // data so the line is real for this user (no fabricated default exercise).
  const prList = personalRecords.ok ? personalRecords.value : [];
  const strengthExerciseKey = prList[0]?.exerciseKey ?? null;
  const strength = strengthExerciseKey
    ? await getStrengthProgression(user.id, { exerciseKey: strengthExerciseKey })
    : null;

  // ---- Training: frequency ----
  const frequencyRows =
    frequency.ok
      ? frequency.value.map((p) => ({ week: dayLabel(p.weekStart), sessions: p.sessionCount }))
      : [];

  // ---- Training: volume by muscle (wide rows, one field per muscle) ----
  const volumePoints = volumeOverTime.ok ? volumeOverTime.value : [];
  const presentMuscles = new Set<MuscleGroup>();
  for (const point of volumePoints) {
    if (point.volumeByMuscle.ok) {
      for (const muscle of Object.keys(point.volumeByMuscle.value) as MuscleGroup[]) {
        presentMuscles.add(muscle);
      }
    }
  }
  const volumeSeries: VolumeSeries[] = [...presentMuscles].map((m) => ({
    key: m,
    label: MUSCLE_GROUP_LABELS[m],
  }));
  const volumeRows: VolumeByMuscleRow[] = volumePoints.map((point) => {
    const row: VolumeByMuscleRow = { week: dayLabel(point.weekStart) };
    if (point.volumeByMuscle.ok) {
      for (const s of volumeSeries) {
        const value = point.volumeByMuscle.value[s.key as MuscleGroup];
        if (typeof value === "number") row[s.key] = value;
      }
    }
    return row;
  });

  // ---- Training: strength progression ----
  const strengthRows =
    strength && strength.ok
      ? strength.value.map((p) => ({ week: dayLabel(p.start), e1rm: round1(p.e1rm) }))
      : [];

  // ---- Nutrition: calories vs target ----
  const caloriesRows = caloriesSeries.map((p) => ({
    day: dayLabel(p.date),
    consumed: p.consumedCalories.ok ? Math.round(p.consumedCalories.value) : null,
    target: p.targetCalories.ok ? Math.round(p.targetCalories.value) : null,
  }));
  const hasCaloriesData = caloriesRows.some((r) => r.consumed != null && r.consumed > 0);

  // ---- Nutrition: macros vs targets ----
  const macroRows: MacrosOverTimeRow[] = macroSeries.map((p) => ({
    day: dayLabel(p.date),
    proteinG: p.consumed.ok ? Math.round(p.consumed.value.proteinG) : null,
    carbsG: p.consumed.ok ? Math.round(p.consumed.value.carbsG) : null,
    fatG: p.consumed.ok ? Math.round(p.consumed.value.fatG) : null,
    targetProteinG: p.target.ok ? Math.round(p.target.value.proteinG) : null,
    targetCarbsG: p.target.ok ? Math.round(p.target.value.carbsG) : null,
    targetFatG: p.target.ok ? Math.round(p.target.value.fatG) : null,
  }));
  const hasMacroData = macroRows.some(
    (r) => (r.proteinG ?? 0) > 0 || (r.carbsG ?? 0) > 0 || (r.fatG ?? 0) > 0,
  );

  // ---- Nutrition: meal history (flattened, most recent first) ----
  const mealDays = [...mealHistory].reverse().filter((d) => d.entries.length > 0);

  // ---- Body: weight history ----
  const weightRows = weightHistory.map((p) => ({
    date: dayLabel(p.measuredAt),
    weightKg: round1(p.weightKg),
  }));

  // ---- Body: measurements (flatten each bucket's rows) ----
  const measurementRows: MeasurementsLineRow[] = measurementHistory.ok
    ? measurementHistory.value.flatMap((b) =>
        b.measurements.map((m) => ({
          date: dayLabel(m.measuredAt),
          waistCm: m.waistCm,
          hipCm: m.hipCm,
          bodyFatPct: m.bodyFatPct,
        })),
      )
    : [];
  const hasMeasurementData = measurementRows.some(
    (r) => r.waistCm != null || r.hipCm != null || r.bodyFatPct != null,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold">
          FitMind AI
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Full statistics</h1>
        <p className="text-muted-foreground">
          Every chart below is built from your own logged data only. Charts you haven&apos;t
          fed yet show an explicit &quot;no data&quot; note instead of a sample.
        </p>
        <Link href="/dashboard" className="text-sm underline underline-offset-4">
          ← Back to dashboard
        </Link>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Training                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Training</h2>

        <Card>
          <CardHeader>
            <CardTitle>Workout frequency (sessions per week)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {frequencyRows.length > 0 ? (
              <>
                <FrequencyBarChart rows={frequencyRows} />
                <p className="text-sm text-muted-foreground">
                  Sessions per week:{" "}
                  {frequencyRows.map((r) => `${r.week}: ${r.sessions}`).join(" · ")}.
                </p>
              </>
            ) : (
              <EmptyState>
                No workouts logged yet — log a training session to see your weekly frequency.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rep-volume by muscle (per week)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {volumeRows.length > 0 && volumeSeries.length > 0 ? (
              <>
                <VolumeByMuscleChart rows={volumeRows} series={volumeSeries} />
                <p className="text-sm text-muted-foreground">
                  Muscles tracked: {volumeSeries.map((s) => s.label).join(", ")}. Values are
                  total reps per muscle per week.
                </p>
              </>
            ) : (
              <EmptyState>
                No set volume yet — log exercises with reps to see per-muscle volume over time.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Strength progression (estimated 1RM
              {strengthExerciseKey ? ` — ${strengthExerciseKey}` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {strengthRows.length > 0 ? (
              <>
                <StrengthLineChart rows={strengthRows} />
                <p className="text-sm text-muted-foreground">
                  Weekly best estimated 1RM (kg):{" "}
                  {strengthRows.map((r) => `${r.week}: ${r.e1rm}`).join(" · ")}.
                </p>
              </>
            ) : (
              <EmptyState>
                No logged sets yet — log weight and reps for an exercise to chart its estimated
                1RM over time.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal records</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {prList.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Exercise</th>
                    <th className="pb-2 font-medium">Max weight (kg)</th>
                    <th className="pb-2 font-medium">Best est. 1RM (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {prList.map((pr) => (
                    <tr key={pr.exerciseKey} className="border-t border-border">
                      <td className="py-2 text-foreground">{pr.exerciseKey}</td>
                      <td className="py-2 text-muted-foreground">{round1(pr.maxWeightKg)}</td>
                      <td className="py-2 text-muted-foreground">{round1(pr.maxE1rm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState>No personal records yet — log some sets to populate this.</EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Program adherence</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {adherence.adherencePct.ok && adherence.planned > 0 ? (
              <p>
                You completed{" "}
                <span className="text-foreground">{adherence.completed}</span> of{" "}
                <span className="text-foreground">{adherence.planned}</span> scheduled
                training days —{" "}
                <span className="text-foreground">
                  {round1(adherence.adherencePct.value)}%
                </span>{" "}
                adherence.
              </p>
            ) : (
              <EmptyState>
                No active plan with scheduled days yet — activate a plan and log sessions to
                track adherence.
              </EmptyState>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Nutrition                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Nutrition</h2>
        <p className="text-sm text-muted-foreground">Trailing 30 days.</p>

        <Card>
          <CardHeader>
            <CardTitle>Calories vs target</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {hasCaloriesData ? (
              <>
                <CaloriesVsTargetChart rows={caloriesRows} />
                <p className="text-sm text-muted-foreground">
                  Consumed vs target calories (kcal) per day over the last 30 days. A dashed
                  line marks the profile-derived target; it is omitted on days with no target.
                </p>
              </>
            ) : (
              <EmptyState>
                No meals logged in the last 30 days — log food to see consumed vs target
                calories.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Macros vs targets</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {hasMacroData ? (
              <>
                <MacrosOverTimeChart rows={macroRows} />
                <p className="text-sm text-muted-foreground">
                  Protein, carbs and fat consumed (solid) vs target (dashed), in grams per day.
                </p>
              </>
            ) : (
              <EmptyState>
                No meals logged in the last 30 days — log food to see your macro split vs
                targets.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target compliance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {compliance.ok ? (
              <p>
                <span className="text-foreground">{round1(compliance.value)}%</span> of logged
                days hit your calorie target (±10%) with every macro at least 90% of target.
              </p>
            ) : (
              <EmptyState>
                A compliance score needs a profile-derived target. Set up your profile (weight,
                height, age, sex, activity, goal) and log meals to see it.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meal history</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {mealDays.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {mealDays.map((d) => (
                  <li key={d.date.toISOString()} className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{dayLabel(d.date)}</span>
                    <ul className="flex flex-col gap-1">
                      {d.entries.map((e) => (
                        <li
                          key={e.id}
                          className="flex justify-between border-b border-border pb-1 last:border-b-0"
                        >
                          <span className="text-foreground">
                            {e.foodName} — {Math.round(e.quantityG)} g
                          </span>
                          <span className="text-muted-foreground">
                            {MEAL_TYPE_LABELS[e.mealType]}
                            {e.macros.ok
                              ? ` · ${Math.round(e.macros.value.calories)} kcal`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No meals logged in the last 30 days.</EmptyState>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Body composition                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Body composition</h2>

        <Card>
          <CardHeader>
            <CardTitle>Log a body measurement</CardTitle>
          </CardHeader>
          <CardContent>
            <MeasurementForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weight over time</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {weightRows.length > 0 ? (
              <>
                <WeightLineChart rows={weightRows} />
                <p className="text-sm text-muted-foreground">
                  Body weight (kg) per measurement:{" "}
                  {weightRows.map((r) => `${r.date}: ${r.weightKg}`).join(" · ")}.
                </p>
              </>
            ) : (
              <EmptyState>
                No weight logged yet — log a body measurement above to chart your weight.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waist, hip &amp; body fat over time</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {hasMeasurementData ? (
              <>
                <MeasurementsLineChart rows={measurementRows} />
                <p className="text-sm text-muted-foreground">
                  Waist (cm), hip (cm) and body fat (%) per measurement. Series with no value
                  are simply absent.
                </p>
              </>
            ) : (
              <EmptyState>
                No waist / hip / body-fat logged yet — add them in a body measurement above.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This month vs last month</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {(["weightKg", "bodyFatPct", "waistCm"] as const).some(
              (k) => bodyComparison[k].comparison != null,
            ) ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Metric</th>
                    <th className="pb-2 font-medium">Last month</th>
                    <th className="pb-2 font-medium">This month</th>
                    <th className="pb-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { key: "weightKg", label: "Weight (kg)" },
                      { key: "bodyFatPct", label: "Body fat (%)" },
                      { key: "waistCm", label: "Waist (cm)" },
                    ] as const
                  ).map(({ key, label }) => {
                    const m = bodyComparison[key];
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="py-2 text-foreground">{label}</td>
                        <td className="py-2 text-muted-foreground">
                          {m.previous != null ? round1(m.previous) : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {m.current != null ? round1(m.current) : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {m.comparison && m.comparison.ok
                            ? `${directionGlyph(m.comparison.value.direction)} ${round1(
                                m.comparison.value.absoluteDelta,
                              )}${
                                m.comparison.value.percentDelta != null
                                  ? ` (${round1(m.comparison.value.percentDelta)}%)`
                                  : ""
                              }`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState>
                Not enough data for a month-over-month comparison yet — log measurements across
                two months.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress photos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Not available yet. The data model has no photo field, so photo upload and
              comparison are intentionally not built — this is a placeholder, not a working
              feature.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Still to come                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Coming in later phases (placeholder)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          End-to-end tests and hardening (phase 7) are not built yet. Adaptive recommendations
          are now live on the{" "}
          <Link href="/recommendations" className="underline underline-offset-4">
            recommendations
          </Link>{" "}
          page and the routine-import UI on the{" "}
          <Link href="/trainer/import" className="underline underline-offset-4">
            import
          </Link>{" "}
          page. Nothing listed as a placeholder in this card is a working feature.
        </CardContent>
      </Card>
    </main>
  );
}
