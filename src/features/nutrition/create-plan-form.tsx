"use client";

/**
 * Create-nutrition-plan form. Mirrors the trainer client-form pattern. The
 * server action re-validates and scopes the write to the session user.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPlanAction } from "./actions";
import { createPlanSchema } from "./validation";

export function CreatePlanForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = createPlanSchema.safeParse({ name });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Escribe un nombre para el plan.");
      return;
    }

    startTransition(async () => {
      const result = await createPlanAction(parsed.data);
      if (result.status === "success") {
        setMessage("Plan creado.");
        setName("");
        router.refresh();
      } else {
        setMessage(result.message ?? "No se pudo crear el plan.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit} noValidate>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="planName" className="text-sm font-medium">
          Nombre del plan
        </label>
        <Input
          id="planName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="p. ej. Definición entre semana"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creando..." : "Crear plan"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-foreground sm:self-center">
          {message}
        </p>
      ) : null}
    </form>
  );
}
