import { describe, expect, it } from "vitest";
import { guessMuscle, isHevyShareLink, matchCatalogName, parseHevyText } from "./hevy-text";

/** Copied verbatim (select all → copy) from a real Hevy routine share page. */
const PAGE = `Comentarios

Canal

Rutinas

Ejercicios

Trainer

Perfil

Configuración

Desbloquear

nico160707
Pecho día 1 (copy)
Press de Banca (Barra)

5 series · 6-12 repeticiones

Press de Banca Inclinado (Mancuerna)

4 series · 9-15 repeticiones

Press de Pecho Iso-Lateral (Máquina)

4 series · 12-15 repeticiones

Jalón de tríceps con cuerda

4 series · 10-15 repeticiones

Extensión de tríceps por encima de la cabeza (cable)

4 series · 6-9 repeticiones

Elevación Lateral (Mancuerna)

4 series · 10-15 repeticiones

Curl de Muñeca Invertido (Mancuerna)

4 series · 10-15 repeticiones

Curl Invertido (Cable)

4 series · 10-15 repeticiones

Press de Hombros (Mancuerna)

3 series · 8-12 repeticiones

Creado por

nico160707

Editar rutina

Copiar enlace de rutina

Resumen de rutina

Ejercicios

9

Series totales

36`;

const CATALOG = [
  "Barbell Bench Press",
  "Incline Dumbbell Press",
  "Dumbbell Lateral Raise",
  "Seated Dumbbell Shoulder Press",
];

describe("parseHevyText", () => {
  const result = parseHevyText(PAGE, CATALOG);

  it("reads the routine title (without the '(copy)' suffix) as plan and day name", () => {
    expect(result.plan?.name).toBe("Pecho día 1");
    expect(result.plan?.days).toHaveLength(1);
    expect(result.plan?.days[0]?.name).toBe("Pecho día 1");
  });

  it("imports all 9 exercises with their sets and rep ranges, in order", () => {
    expect(result.importedCount).toBe(9);
    expect(result.rejected).toEqual([]);
    const ex = result.plan!.days[0]!.exercises;
    expect(ex.map((e) => [e.exerciseName, e.sets, e.repsMin, e.repsMax])).toEqual([
      ["Barbell Bench Press", 5, 6, 12],
      ["Incline Dumbbell Press", 4, 9, 15],
      ["Iso-Lateral Chest Press (Machine)", 4, 12, 15],
      ["Triceps Rope Pushdown", 4, 10, 15],
      ["Overhead Triceps Extension (Cable)", 4, 6, 9],
      ["Dumbbell Lateral Raise", 4, 10, 15],
      ["Reverse Wrist Curl (Dumbbell)", 4, 10, 15],
      ["Reverse Curl (Cable)", 4, 10, 15],
      ["Seated Dumbbell Shoulder Press", 3, 8, 12],
    ]);
  });

  it("queues the Hevy exercises the catalog lacks, with their muscle", () => {
    expect(result.newExercises.map((e) => [e.name, e.primaryMuscle])).toEqual([
      ["Iso-Lateral Chest Press (Machine)", "CHEST"],
      ["Triceps Rope Pushdown", "TRICEPS"],
      ["Overhead Triceps Extension (Cable)", "TRICEPS"],
      ["Reverse Wrist Curl (Dumbbell)", "OTHER"],
      ["Reverse Curl (Cable)", "BICEPS"],
    ]);
  });

  it("understands the English page and unknown exercises", () => {
    const r = parseHevyText(
      "Leg Day\nGoblet Squat\n3 sets · 10 reps\nSissy Squat Machine\n3 sets · 12-15 reps\nPlank\n3 sets · 60s\nCreated by\nme",
      ["Goblet Squat", "Plank"],
    );
    expect(r.plan?.name).toBe("Leg Day");
    expect(r.plan?.days[0]?.exercises.map((e) => [e.exerciseName, e.repsMin, e.repsMax])).toEqual([
      ["Goblet Squat", 10, 10],
      ["Sissy Squat Machine", 12, 15],
    ]);
    expect(r.newExercises).toEqual([
      expect.objectContaining({ name: "Sissy Squat Machine", primaryMuscle: "QUADS" }),
    ]);
    expect(r.rejected).toEqual([
      expect.objectContaining({ reason: expect.stringContaining("Plank: no tiene repeticiones") }),
    ]);
  });

  it("explains what to copy when no exercise is found", () => {
    const r = parseHevyText("hola", CATALOG);
    expect(r.plan).toBeNull();
    expect(r.rejected[0]?.reason).toContain("Copia toda la página");
  });
});

describe("helpers", () => {
  it("detects a bare share link", () => {
    expect(isHevyShareLink(" https://hevy.com/routine/MGEfRrA7OBI ")).toBe(true);
    expect(isHevyShareLink("Pecho día 1\nhttps://hevy.com/routine/x")).toBe(false);
  });

  it("guesses muscles from Spanish and English names", () => {
    expect(guessMuscle("Remo con Barra")).toBe("BACK");
    expect(guessMuscle("Curl de Muñeca")).toBe("OTHER");
    expect(guessMuscle("Extensión de Tríceps")).toBe("TRICEPS");
    expect(guessMuscle("Something odd")).toBe("OTHER");
  });
});

describe("matchCatalogName", () => {
  const names = [
    "Barbell Bench Press",
    "Dumbbell Bench Press",
    "Leg Press",
    "Romanian Deadlift",
    "Push-Up",
    "Barbell Curl",
  ];

  it.each([
    ["Bench Press (Barbell)", "Barbell Bench Press"],
    ["Bench Press (Dumbbell)", "Dumbbell Bench Press"],
    ["Leg Press (Machine)", "Leg Press"],
    ["Romanian Deadlift (Barbell)", "Romanian Deadlift"],
    ["Push Up", "Push-Up"],
    ["Bicep Curl (Barbell)", "Barbell Curl"],
  ])("maps %s to %s", (hevy, catalog) => {
    expect(matchCatalogName(hevy, names)).toBe(catalog);
  });

  it("returns null when nothing matches", () => {
    expect(matchCatalogName("Chest Fly (Machine)", names)).toBeNull();
  });
});
