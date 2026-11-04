"use client";

/**
 * Water-logging form. Mirrors the trainer log-session-form client pattern
 * (useTransition, client-side Zod validation, the shared action-state result).
 * The server action re-validates and attributes the log to the session user, so
 * this form is a convenience layer, not the trust boundary.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logWaterAction } from "./actions";
import { logWaterSchema } from "./validation";

export function WaterLogForm() {
  const router = useRouter();
  const [amountMl, setAmountMl] = useState("250");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const amount = Number(amountMl.trim());
    const parsed = logWaterSchema.safeParse({
      amountMl: Number.isNaN(amount) ? undefined : amount,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Introduce una cantidad válida.");
      return;
    }

    startTransition(async () => {
      const result = await logWaterAction(parsed.data);
      if (result.status === "success") {
        setMessage("Agua registrada.");
        router.refresh();
      } else {
        setMessage(result.message ?? "No se pudo registrar el agua.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit} noValidate>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="amountMl" className="text-sm font-medium">
          Cantidad (ml)
        </label>
        <Input
          id="amountMl"
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          step="50"
          value={amountMl}
          onChange={(e) => setAmountMl(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Registrando..." : "Registrar agua"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-foreground sm:self-center">
          {message}
        </p>
      ) : null}
    </form>
  );
}
