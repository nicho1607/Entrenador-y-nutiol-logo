import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">FitMind AI</span>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Your intelligent personal trainer and nutrition coach
        </h1>
        <p className="text-muted-foreground">
          FitMind AI helps you plan training, track nutrition, and follow your progress. Create an
          account to generate a profile-driven workout plan, log your workouts, plan meals against
          calorie and macro targets, see your progress on real charts, and get adaptive
          recommendations from your own logged data.
        </p>
        <div className="flex gap-3">
          <Link href="/register">
            <Button>Create account</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Log in</Button>
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>What is inside</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Accounts and secure sessions, a profile that computes your BMI, BMR, TDEE, calorie
          target and macro split, an intelligent trainer that generates and saves plans with
          workout logging and per-muscle volume, a nutrition module with a curated food catalog,
          meal planning, food and water logging and a budget-aware market list, progress charts
          and body-measurement logging, adaptive recommendations built from your own data, and a
          routine importer for JSON/CSV plans. Progress photos are not built yet and the optional
          AI recommendation layer ships disabled by default; both are labeled as such.
        </CardContent>
      </Card>
    </main>
  );
}
