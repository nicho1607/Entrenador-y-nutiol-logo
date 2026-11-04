"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Catches failures in the root layout itself, so it
 * must render its own <html> and <body> (the normal layout is not available
 * here). Like the segment boundary it NEVER renders the raw error message or
 * stack to the user; the error is only logged for developers. Styling is kept
 * inline because the app's theme/providers may not have mounted.
 */
export default function GlobalError({
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
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: "#ffffff",
          color: "#111111",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            Ocurrió un error inesperado. Puedes intentarlo de nuevo y, si el problema persiste,
            vuelve un poco más tarde.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0.375rem",
              border: "1px solid #111111",
              background: "#111111",
              color: "#ffffff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
