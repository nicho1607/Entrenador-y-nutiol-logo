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
      setMessage(parsed.error.issues[0]?.message ?? "Please enter a plan name.");
      return;
    }

    startTransition(async () => {
      const result = await createPlanAction(parsed.data);
      if (result.status === "success") {
        setMessage("Plan created.");
        setName("");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not create the plan.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit} noValidate>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="planName" className="text-sm font-medium">
          Plan name
        </label>
        <Input
          id="planName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekday cut"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create plan"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-foreground sm:self-center">
          {message}
        </p>
      ) : null}
    </form>
  );
}
