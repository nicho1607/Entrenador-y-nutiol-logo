"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Route-segment error boundary. Renders a generic, non-leaking message: the
 * raw error message and stack are intentionally never shown to the user (they
 * can contain internal paths or sensitive detail). The error is logged to the
 * console for developers/observability only. `reset` retries rendering the
 * segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Developer-facing only; never surfaced in the UI.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>
            We hit an unexpected error while loading this page. You can try again, and if the
            problem keeps happening please come back a little later.
          </p>
          <div>
            <Button onClick={() => reset()}>Try again</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
