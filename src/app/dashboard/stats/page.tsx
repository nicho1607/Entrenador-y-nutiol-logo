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
        <h1 className="text-3xl font-bold tracking-tight">Estadísticas completas</h1>
        <p className="text-muted-foreground">
          Cada gráfico de abajo se construye únicamente con tus propios datos registrados. Los
          gráficos que aún no has alimentado muestran una nota explícita de &quot;sin datos&quot; en
          lugar de una muestra.
        </p>
        <Link href="/dashboard" className="text-sm underline underline-offset-4">
          ← Volver al panel
        </Link>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Training                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Entrenamiento</h2>

        <Card>
          <CardHeader>
            <CardTitle>Frecuencia de entrenamiento (sesiones por semana)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {frequencyRows.length > 0 ? (
              <>
                <FrequencyBarChart rows={frequencyRows} />
                <p className="text-sm text-muted-foreground">
                  Sesiones por semana:{" "}
                  {frequencyRows.map((r) => `${r.week}: ${r.sessions}`).join(" · ")}.
                </p>
              </>
            ) : (
              <EmptyState>
                Aún no has registrado entrenamientos — registra una sesión para ver tu frecuencia
                semanal.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volumen de repeticiones por músculo (por semana)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {volumeRows.length > 0 && volumeSeries.length > 0 ? (
              <>
                <VolumeByMuscleChart rows={volumeRows} series={volumeSeries} />
                <p className="text-sm text-muted-foreground">
                  Músculos registrados: {volumeSeries.map((s) => s.label).join(", ")}. Los valores
                  son el total de repeticiones por músculo por semana.
                </p>
              </>
            ) : (
              <EmptyState>
                Aún no hay volumen de series — registra ejercicios con repeticiones para ver el
                volumen por músculo a lo largo del tiempo.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Progresión de fuerza (1RM estimado
              {strengthExerciseKey ? ` — ${strengthExerciseKey}` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {strengthRows.length > 0 ? (
              <>
                <StrengthLineChart rows={strengthRows} />
                <p className="text-sm text-muted-foreground">
                  Mejor 1RM estimado por semana (kg):{" "}
                  {strengthRows.map((r) => `${r.week}: ${r.e1rm}`).join(" · ")}.
                </p>
              </>
            ) : (
              <EmptyState>
                Aún no hay series registradas — registra peso y repeticiones de un ejercicio para
                graficar su 1RM estimado a lo largo del tiempo.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Récords personales</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {prList.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Ejercicio</th>
                    <th className="pb-2 font-medium">Peso máx. (kg)</th>
                    <th className="pb-2 font-medium">Mejor 1RM est. (kg)</th>
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
              <EmptyState>Aún no hay récords personales — registra algunas series para completarlo.</EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adherencia al programa</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {adherence.adherencePct.ok && adherence.planned > 0 ? (
              <p>
                Completaste{" "}
                <span className="text-foreground">{adherence.completed}</span> de{" "}
                <span className="text-foreground">{adherence.planned}</span> días de entrenamiento
                programados —{" "}
                <span className="text-foreground">
                  {round1(adherence.adherencePct.value)}%
                </span>{" "}
                de adherencia.
              </p>
            ) : (
              <EmptyState>
                Aún no hay un plan activo con días programados — activa un plan y registra sesiones
                para seguir tu adherencia.
              </EmptyState>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Nutrition                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Nutrición</h2>
        <p className="text-sm text-muted-foreground">Últimos 30 días.</p>

        <Card>
          <CardHeader>
            <CardTitle>Calorías vs. objetivo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {hasCaloriesData ? (
              <>
                <CaloriesVsTargetChart rows={caloriesRows} />
                <p className="text-sm text-muted-foreground">
                  Calorías consumidas vs. objetivo (kcal) por día durante los últimos 30 días. Una
                  línea discontinua marca el objetivo derivado del perfil; se omite en los días sin
                  objetivo.
                </p>
              </>
            ) : (
              <EmptyState>
                No hay comidas registradas en los últimos 30 días — registra alimentos para ver las
                calorías consumidas vs. el objetivo.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Macros vs. objetivos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {hasMacroData ? (
              <>
                <MacrosOverTimeChart rows={macroRows} />
                <p className="text-sm text-muted-foreground">
                  Proteína, carbohidratos y grasa consumidos (línea continua) vs. objetivo (línea
                  discontinua), en gramos por día.
                </p>
              </>
            ) : (
              <EmptyState>
                No hay comidas registradas en los últimos 30 días — registra alimentos para ver tu
                reparto de macros vs. los objetivos.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cumplimiento del objetivo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {compliance.ok ? (
              <p>
                El <span className="text-foreground">{round1(compliance.value)}%</span> de los días
                registrados alcanzó tu objetivo de calorías (±10%) con cada macro al menos al 90%
                del objetivo.
              </p>
            ) : (
              <EmptyState>
                Una puntuación de cumplimiento necesita un objetivo derivado del perfil. Configura
                tu perfil (peso, altura, edad, sexo, actividad, objetivo) y registra comidas para
                verla.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de comidas</CardTitle>
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
              <EmptyState>No hay comidas registradas en los últimos 30 días.</EmptyState>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Body composition                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Composición corporal</h2>

        <Card>
          <CardHeader>
            <CardTitle>Registrar una medida corporal</CardTitle>
          </CardHeader>
          <CardContent>
            <MeasurementForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peso a lo largo del tiempo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {weightRows.length > 0 ? (
              <>
                <WeightLineChart rows={weightRows} />
                <p className="text-sm text-muted-foreground">
                  Peso corporal (kg) por medida:{" "}
                  {weightRows.map((r) => `${r.date}: ${r.weightKg}`).join(" · ")}.
                </p>
              </>
            ) : (
              <EmptyState>
                Aún no has registrado tu peso — registra una medida corporal arriba para graficar
                tu peso.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cintura, cadera y grasa corporal a lo largo del tiempo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {hasMeasurementData ? (
              <>
                <MeasurementsLineChart rows={measurementRows} />
                <p className="text-sm text-muted-foreground">
                  Cintura (cm), cadera (cm) y grasa corporal (%) por medida. Las series sin valor
                  simplemente no aparecen.
                </p>
              </>
            ) : (
              <EmptyState>
                Aún no has registrado cintura / cadera / grasa corporal — añádelas en una medida
                corporal arriba.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Este mes vs. el mes pasado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {(["weightKg", "bodyFatPct", "waistCm"] as const).some(
              (k) => bodyComparison[k].comparison != null,
            ) ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Métrica</th>
                    <th className="pb-2 font-medium">Mes pasado</th>
                    <th className="pb-2 font-medium">Este mes</th>
                    <th className="pb-2 font-medium">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { key: "weightKg", label: "Peso (kg)" },
                      { key: "bodyFatPct", label: "Grasa corporal (%)" },
                      { key: "waistCm", label: "Cintura (cm)" },
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
                Aún no hay datos suficientes para una comparación mes a mes — registra medidas a lo
                largo de dos meses.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fotos de progreso</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Aún no disponible. El modelo de datos no tiene un campo de foto, así que la subida y
              comparación de fotos no están implementadas a propósito — esto es un marcador, no una
              función activa.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Still to come                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Próximamente en fases posteriores (marcador)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Las pruebas de extremo a extremo y el endurecimiento (fase 7) aún no están disponibles.
          Las recomendaciones adaptativas ya están activas en la página de{" "}
          <Link href="/recommendations" className="underline underline-offset-4">
            recomendaciones
          </Link>{" "}
          y la interfaz de importación de rutinas en la página de{" "}
          <Link href="/trainer/import" className="underline underline-offset-4">
            importación
          </Link>
          . Nada de lo que aparece como marcador en esta tarjeta es una función activa.
        </CardContent>
      </Card>
    </main>
  );
}
