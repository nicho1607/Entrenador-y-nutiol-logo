"use client";

/**
 * Accessible profile create/update form. Validates with the shared Zod schema
 * on the client for inline errors, then calls the `saveProfileAction` server
 * action (which re-validates and enforces ownership). On success the page is
 * revalidated so the recomputed derived values refresh.
 */
import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  useTransition,
  type FormEvent,
  type ReactElement,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProfileAction } from "./actions";
import {
  ACTIVITY_LEVEL_VALUES,
  EQUIPMENT_VALUES,
  EXPERIENCE_LEVEL_VALUES,
  GOAL_TYPE_VALUES,
  SEX_VALUES,
  profileSchema,
  type ProfileInput,
} from "./validation";
import {
  ACTIVITY_LEVEL_LABELS,
  EQUIPMENT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  GOAL_TYPE_LABELS,
  SEX_LABELS,
} from "./labels";
import type { ProfileView } from "./service";

type Errors = Record<string, string>;

/** Raw string-keyed form state (what the inputs hold before coercion). */
interface FormState {
  age: string;
  sex: string;
  weightKg: string;
  heightCm: string;
  experienceLevel: string;
  goal: string;
  daysPerWeek: string;
  sessionMinutes: string;
  activityLevel: string;
  equipment: string[];
  dietaryPreferences: string;
  allergies: string;
  dietaryRestrictions: string;
  foodBudget: string;
  flaggedForProfessionalReview: boolean;
}

function toFormState(profile: ProfileView | null): FormState {
  return {
    age: profile?.age != null ? String(profile.age) : "",
    sex: profile?.sex ?? "",
    weightKg: profile?.weightKg != null ? String(profile.weightKg) : "",
    heightCm: profile?.heightCm != null ? String(profile.heightCm) : "",
    experienceLevel: profile?.experienceLevel ?? "",
    goal: profile?.goal ?? "",
    daysPerWeek: profile?.daysPerWeek != null ? String(profile.daysPerWeek) : "",
    sessionMinutes: profile?.sessionMinutes != null ? String(profile.sessionMinutes) : "",
    activityLevel: profile?.activityLevel ?? "",
    equipment: profile?.equipment ?? [],
    dietaryPreferences: (profile?.dietaryPreferences ?? []).join(", "),
    allergies: (profile?.allergies ?? []).join(", "),
    dietaryRestrictions: (profile?.dietaryRestrictions ?? []).join(", "),
    foodBudget: profile?.foodBudget != null ? String(profile.foodBudget) : "",
    flaggedForProfessionalReview: profile?.flaggedForProfessionalReview ?? false,
  };
}

/** Coerces the string form state into the schema's typed input shape. */
function toParseInput(form: FormState): Record<string, unknown> {
  const num = (v: string): number | undefined => {
    const t = v.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };
  return {
    age: num(form.age),
    sex: form.sex === "" ? undefined : form.sex,
    weightKg: num(form.weightKg),
    heightCm: num(form.heightCm),
    experienceLevel: form.experienceLevel === "" ? undefined : form.experienceLevel,
    goal: form.goal === "" ? undefined : form.goal,
    daysPerWeek: num(form.daysPerWeek),
    sessionMinutes: num(form.sessionMinutes),
    activityLevel: form.activityLevel === "" ? undefined : form.activityLevel,
    equipment: form.equipment,
    dietaryPreferences: form.dietaryPreferences,
    allergies: form.allergies,
    dietaryRestrictions: form.dietaryRestrictions,
    foodBudget: num(form.foodBudget),
    flaggedForProfessionalReview: form.flaggedForProfessionalReview,
  };
}

const selectClasses =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm " +
  "text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProfileForm({ profile }: { profile: ProfileView | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(profile));
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleEquipment(value: string) {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.includes(value)
        ? f.equipment.filter((e) => e !== value)
        : [...f.equipment, value],
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = profileSchema.safeParse(toParseInput(form));
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in next)) next[key] = issue.message;
      }
      setErrors(next);
      setMessage("Corrige los campos resaltados.");
      return;
    }
    setErrors({});

    const payload: ProfileInput = parsed.data;
    startTransition(async () => {
      const result = await saveProfileAction(payload);
      if (result.status === "success") {
        setMessage("Perfil guardado.");
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? "No se pudo guardar tu perfil.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit} noValidate>
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">Sobre ti</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="age" label="Edad (años)" error={errors.age}>
            <Input
              id="age"
              type="number"
              inputMode="numeric"
              value={form.age}
              onChange={(e) => set("age", e.target.value)}
              aria-invalid={Boolean(errors.age)}
            />
          </Field>
          <Field id="sex" label="Sexo fisiológico (para los cálculos de energía)" error={errors.sex}>
            <select
              id="sex"
              className={selectClasses}
              value={form.sex}
              onChange={(e) => set("sex", e.target.value)}
              aria-invalid={Boolean(errors.sex)}
            >
              <option value="">Prefiero no decirlo</option>
              {SEX_VALUES.map((v) => (
                <option key={v} value={v}>
                  {SEX_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="weightKg" label="Peso (kg)" error={errors.weightKg}>
            <Input
              id="weightKg"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
              aria-invalid={Boolean(errors.weightKg)}
            />
          </Field>
          <Field id="heightCm" label="Altura (cm)" error={errors.heightCm}>
            <Input
              id="heightCm"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.heightCm}
              onChange={(e) => set("heightCm", e.target.value)}
              aria-invalid={Boolean(errors.heightCm)}
            />
          </Field>
          <Field
            id="activityLevel"
            label="Nivel de actividad diaria"
            error={errors.activityLevel}
          >
            <select
              id="activityLevel"
              className={selectClasses}
              value={form.activityLevel}
              onChange={(e) => set("activityLevel", e.target.value)}
              aria-invalid={Boolean(errors.activityLevel)}
            >
              <option value="">Sin definir</option>
              {ACTIVITY_LEVEL_VALUES.map((v) => (
                <option key={v} value={v}>
                  {ACTIVITY_LEVEL_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="experienceLevel" label="Nivel de experiencia" error={errors.experienceLevel}>
            <select
              id="experienceLevel"
              className={selectClasses}
              value={form.experienceLevel}
              onChange={(e) => set("experienceLevel", e.target.value)}
              aria-invalid={Boolean(errors.experienceLevel)}
            >
              <option value="">Sin definir</option>
              {EXPERIENCE_LEVEL_VALUES.map((v) => (
                <option key={v} value={v}>
                  {EXPERIENCE_LEVEL_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">Objetivo y disponibilidad para entrenar</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="goal" label="Objetivo principal" error={errors.goal}>
            <select
              id="goal"
              className={selectClasses}
              value={form.goal}
              onChange={(e) => set("goal", e.target.value)}
              aria-invalid={Boolean(errors.goal)}
            >
              <option value="">Sin definir</option>
              {GOAL_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {GOAL_TYPE_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="daysPerWeek" label="Días disponibles por semana" error={errors.daysPerWeek}>
            <Input
              id="daysPerWeek"
              type="number"
              inputMode="numeric"
              min={0}
              max={7}
              value={form.daysPerWeek}
              onChange={(e) => set("daysPerWeek", e.target.value)}
              aria-invalid={Boolean(errors.daysPerWeek)}
            />
          </Field>
          <Field
            id="sessionMinutes"
            label="Tiempo por sesión (minutos)"
            error={errors.sessionMinutes}
          >
            <Input
              id="sessionMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.sessionMinutes}
              onChange={(e) => set("sessionMinutes", e.target.value)}
              aria-invalid={Boolean(errors.sessionMinutes)}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Equipo disponible</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {EQUIPMENT_VALUES.map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border focus-visible:ring-2 focus-visible:ring-ring"
                  checked={form.equipment.includes(v)}
                  onChange={() => toggleEquipment(v)}
                />
                {EQUIPMENT_LABELS[v]}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">Preferencias de nutrición (opcional)</legend>
        <Field
          id="dietaryPreferences"
          label="Preferencias alimentarias (separadas por comas)"
          error={errors.dietaryPreferences}
          hint="p. ej. vegetariano, alto en proteína"
        >
          <Input
            id="dietaryPreferences"
            type="text"
            value={form.dietaryPreferences}
            onChange={(e) => set("dietaryPreferences", e.target.value)}
          />
        </Field>
        <Field
          id="allergies"
          label="Alergias / intolerancias (separadas por comas)"
          error={errors.allergies}
          hint="p. ej. cacahuetes, lactosa"
        >
          <Input
            id="allergies"
            type="text"
            value={form.allergies}
            onChange={(e) => set("allergies", e.target.value)}
          />
        </Field>
        <Field
          id="dietaryRestrictions"
          label="Restricciones alimentarias (separadas por comas)"
          error={errors.dietaryRestrictions}
          hint="p. ej. halal, sin cerdo"
        >
          <Input
            id="dietaryRestrictions"
            type="text"
            value={form.dietaryRestrictions}
            onChange={(e) => set("dietaryRestrictions", e.target.value)}
          />
        </Field>
        <Field
          id="foodBudget"
          label="Presupuesto semanal para comida (opcional)"
          error={errors.foodBudget}
          hint="En tu moneda local"
        >
          <Input
            id="foodBudget"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={form.foodBudget}
            onChange={(e) => set("foodBudget", e.target.value)}
            aria-invalid={Boolean(errors.foodBudget)}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Seguridad</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border focus-visible:ring-2 focus-visible:ring-ring"
            checked={form.flaggedForProfessionalReview}
            onChange={(e) => set("flaggedForProfessionalReview", e.target.checked)}
          />
          <span>
            Tengo una condición (p. ej. embarazo, un trastorno alimentario o una enfermedad
            metabólica) que implica que el cálculo automático de calorías debe desactivarse hasta
            que un profesional revise mi plan.
          </span>
        </label>
      </fieldset>

      {message ? (
        <p role="alert" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : profile ? "Actualizar perfil" : "Guardar perfil"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  // Associate the hint/error text with the field control for assistive tech by
  // injecting aria-describedby into the single child (Input or native select),
  // so no call site needs to repeat the id wiring.
  const child = Children.only(children);
  const control =
    describedBy && isValidElement(child)
      ? cloneElement(child as ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": describedBy,
        })
      : children;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {control}
      {error ? (
        <span id={errorId} role="alert" className="text-xs text-caution">
          {error}
        </span>
      ) : null}
    </div>
  );
}
