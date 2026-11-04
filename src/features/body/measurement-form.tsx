"use client";

/**
 * Body-measurement logging form. Mirrors the nutrition food-log-form client
 * pattern. The user enters any combination of weight / body-fat / waist / hip
 * (at least one required) and an optional date. The server action re-validates
 * and attributes the measurement to the session user, so this form is a
 * convenience + client-side-validation layer only.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logMeasurementAction } from "./actions";
import { logMeasurementSchema } from "./validation";

export function MeasurementForm() {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [measuredAt, setMeasuredAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Parses an optional numeric field: blank -> undefined, else the number. */
  function optionalNumber(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isNaN(n) ? undefined : n;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = logMeasurementSchema.safeParse({
      weightKg: optionalNumber(weightKg),
      bodyFatPct: optionalNumber(bodyFatPct),
      waistCm: optionalNumber(waistCm),
      hipCm: optionalNumber(hipCm),
      measuredAt: measuredAt.trim() === "" ? undefined : measuredAt,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      const result = await logMeasurementAction(parsed.data);
      if (result.status === "success") {
        setMessage("Measurement logged.");
        setWeightKg("");
        setBodyFatPct("");
        setWaistCm("");
        setHipCm("");
        setMeasuredAt("");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not log the measurement.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="measure-weight" className="text-sm font-medium">
            Weight (kg)
          </label>
          <Input
            id="measure-weight"
            type="number"
            inputMode="decimal"
            min={1}
            max={500}
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="measure-body-fat" className="text-sm font-medium">
            Body fat (%)
          </label>
          <Input
            id="measure-body-fat"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.1"
            value={bodyFatPct}
            onChange={(e) => setBodyFatPct(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="measure-waist" className="text-sm font-medium">
            Waist (cm)
          </label>
          <Input
            id="measure-waist"
            type="number"
            inputMode="decimal"
            min={1}
            max={300}
            step="0.1"
            value={waistCm}
            onChange={(e) => setWaistCm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="measure-hip" className="text-sm font-medium">
            Hip (cm)
          </label>
          <Input
            id="measure-hip"
            type="number"
            inputMode="decimal"
            min={1}
            max={300}
            step="0.1"
            value={hipCm}
            onChange={(e) => setHipCm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="measure-date" className="text-sm font-medium">
            Date (optional)
          </label>
          <Input
            id="measure-date"
            type="date"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Enter at least one measurement. Leave a field blank to skip it.
      </p>

      {message ? (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Logging..." : "Log measurement"}
        </Button>
      </div>
    </form>
  );
}
