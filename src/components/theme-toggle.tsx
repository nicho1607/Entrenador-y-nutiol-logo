"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Light/dark theme toggle. Renders a stable placeholder until mounted to avoid
 * a hydration mismatch (the resolved theme is only known client-side).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="secondary"
      aria-label={mounted ? `Cambiar a modo ${isDark ? "claro" : "oscuro"}` : "Alternar tema"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (isDark ? "Modo claro" : "Modo oscuro") : "Tema"}
    </Button>
  );
}
