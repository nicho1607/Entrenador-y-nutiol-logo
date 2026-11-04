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
          Tu entrenador personal y asesor de nutrición inteligente
        </h1>
        <p className="text-muted-foreground">
          FitMind AI te ayuda a planificar tus entrenamientos, controlar tu nutrición y seguir tu
          progreso. Crea una cuenta para generar un plan de entrenamiento basado en tu perfil,
          registrar tus entrenamientos, planificar comidas según tus objetivos de calorías y
          macros, ver tu progreso en gráficos reales y recibir recomendaciones adaptativas a partir
          de tus propios datos registrados.
        </p>
        <div className="flex gap-3">
          <Link href="/register">
            <Button>Crear cuenta</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Iniciar sesión</Button>
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Qué incluye</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cuentas y sesiones seguras, un perfil que calcula tu IMC, TMB, GET, objetivo de calorías
          y reparto de macros, un entrenador inteligente que genera y guarda planes con registro de
          entrenamientos y volumen por músculo, un módulo de nutrición con un catálogo de alimentos
          seleccionado, planificación de comidas, registro de alimentos y agua y una lista de
          compras ajustada a tu presupuesto, gráficos de progreso y registro de medidas corporales,
          recomendaciones adaptativas creadas a partir de tus propios datos y un importador de
          rutinas para planes en JSON/CSV. Las fotos de progreso aún no están disponibles y la capa
          opcional de recomendaciones con IA viene desactivada por defecto; ambas aparecen
          señaladas como tales.
        </CardContent>
      </Card>
    </main>
  );
}
