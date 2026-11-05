import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Landing. Opens with what the app is for — a training log where the weight
 * goes up — shown as an example session sheet next to the headline. The
 * record row's yellow bar is the page's one motion moment.
 */

interface SampleSet {
  exercise: string;
  weightKg: string;
  reps: number[];
}

const SAMPLE_SETS: SampleSet[] = [
  { exercise: "Press de banca", weightKg: "80", reps: [8, 8, 7] },
  { exercise: "Press inclinado con mancuernas", weightKg: "30", reps: [10, 10, 9] },
  { exercise: "Aperturas en polea", weightKg: "15", reps: [12, 12, 11] },
];

const PILLARS = [
  {
    title: "Entrenamiento",
    body: "Genera un plan según tu nivel, días y equipo, o importa tus rutinas de Hevy. Cada ejercicio trae su demostración.",
  },
  {
    title: "Nutrición",
    body: "Calorías y macros calculados con tu peso, altura y objetivo. Registra comidas y agua, y arma la lista de la compra con tu presupuesto.",
  },
  {
    title: "Progreso",
    body: "Peso por serie, récords, volumen por músculo y medidas corporales en gráficos con tus propios datos.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-3xl font-extrabold tracking-wide">FitMind</span>
        <nav className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-control px-2 py-2 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Iniciar sesión
          </Link>
        </nav>
      </header>

      <section className="grid items-center gap-12 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] md:py-20">
        <div className="flex flex-col gap-7">
          <h1 className="text-[3.25rem] font-extrabold sm:text-7xl lg:text-[5.25rem]">
            <span className="block text-balance">Anota cada serie.</span>
            <span className="block text-balance">Mira cómo sube el peso.</span>
          </h1>
          <p className="max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
            Tu plan de entrenamiento, tus comidas y tu progreso en un solo cuaderno. Los números
            salen de lo que registras, no de suposiciones.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/register"
              className="inline-flex items-center rounded-control bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className="rounded-control text-base font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <figure className="flex flex-col gap-3">
          <SessionSheet />
          <figcaption className="text-sm text-muted-foreground">
            Ejemplo de una sesión registrada. Cuando superas tu mejor peso, la app te lo dice.
          </figcaption>
        </figure>
      </section>

      <section
        aria-label="Qué incluye"
        className="grid gap-10 border-t border-border pb-20 pt-12 sm:grid-cols-3 sm:gap-8"
      >
        {PILLARS.map((p) => (
          <div key={p.title} className="flex max-w-xs flex-col gap-2">
            <h2 className="text-3xl font-bold">{p.title}</h2>
            <p className="leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

function SessionSheet() {
  return (
    <div className="rounded-surface border border-border bg-card">
      <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
        <p className="font-display text-2xl font-bold tracking-wide">Pecho día 1</p>
        <p className="text-sm text-muted-foreground">martes 3 de noviembre</p>
      </div>

      <ul className="divide-y divide-border">
        {SAMPLE_SETS.map((s) => (
          <li key={s.exercise} className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-5 py-3">
            <span className="text-sm font-medium">{s.exercise}</span>
            <span className="row-span-2 text-right font-display text-3xl font-bold">
              {s.weightKg}
              <span className="ml-1 font-sans text-sm font-medium text-muted-foreground">kg</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {s.reps.length} series de {s.reps.join(", ")} reps
            </span>
          </li>
        ))}

        <li className="relative grid grid-cols-[1fr_auto] items-center gap-x-4 bg-record/10 py-4 pl-6 pr-5">
          <span aria-hidden className="record-bar absolute inset-y-0 left-0 w-1.5 bg-record" />
          <span className="text-sm font-semibold">Press de banca, serie extra</span>
          <span className="row-span-2 text-right font-display text-5xl font-extrabold text-foreground">
            82,5
            <span className="ml-1 font-sans text-sm font-medium text-muted-foreground">kg</span>
          </span>
          <span className="text-xs font-medium">Nuevo récord: 2,5 kg más que tu mejor marca</span>
        </li>
      </ul>
    </div>
  );
}
