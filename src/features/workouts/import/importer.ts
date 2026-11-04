/**
 * Routine importer — maps externally-exported workout routines into the
 * internal normalized plan shape. Supports JSON and CSV. See
 * docs/routine-import-format.md for the format spec.
 *
 * Design: the importer never throws on bad data. Invalid rows/entries are
 * collected in `rejected` with a human-readable reason, so a partial import of
 * the valid rows is possible and the user sees exactly what was skipped.
 */
import { ZodError } from "zod";
import {
  csvRowSchema,
  externalPlanSchema,
  type CsvRow,
  type ExternalExercise,
} from "./schema";
import {
  type ImportResult,
  type NormalizedWorkoutDay,
  type NormalizedWorkoutExercise,
  type RejectedRow,
} from "./types";

const REQUIRED_CSV_HEADERS = [
  "planName",
  "dayName",
  "dayOrder",
  "exerciseName",
  "muscle",
  "sets",
  "repsMin",
  "repsMax",
] as const;

/** Parse and map a JSON-encoded external plan. */
export function importRoutineFromJson(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      plan: null,
      importedCount: 0,
      rejected: [{ index: 1, raw, reason: "Invalid JSON syntax." }],
    };
  }

  const result = externalPlanSchema.safeParse(parsed);
  if (!result.success) {
    return {
      plan: null,
      importedCount: 0,
      rejected: [{ index: 1, raw: parsed, reason: formatZodError(result.error) }],
    };
  }

  const external = result.data;
  let importedCount = 0;
  const days: NormalizedWorkoutDay[] = external.days.map((day) => {
    const exercises: NormalizedWorkoutExercise[] = day.exercises.map((ex, i) => {
      importedCount += 1;
      return mapExternalExercise(ex, i + 1);
    });
    return { order: day.order, name: day.name, exercises };
  });

  return {
    plan: {
      name: external.name,
      description: external.description ?? null,
      days: days.sort((a, b) => a.order - b.order),
    },
    importedCount,
    rejected: [],
  };
}

/** Parse and map a CSV export (one exercise per row). */
export function importRoutineFromCsv(raw: string): ImportResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      plan: null,
      importedCount: 0,
      rejected: [{ index: 1, raw, reason: "CSV is empty or has no data rows." }],
    };
  }

  const headers = splitCsvLine(lines[0]!);
  const missing = REQUIRED_CSV_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      plan: null,
      importedCount: 0,
      rejected: [{ index: 1, raw: headers, reason: `Missing required header(s): ${missing.join(", ")}.` }],
    };
  }

  const rejected: RejectedRow[] = [];
  const validRows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx] ?? "";
    });

    const parsed = csvRowSchema.safeParse(record);
    if (!parsed.success) {
      rejected.push({ index: i, raw: record, reason: formatZodError(parsed.error) });
      continue;
    }
    validRows.push(parsed.data);
  }

  if (validRows.length === 0) {
    return { plan: null, importedCount: 0, rejected };
  }

  // Group valid rows into days keyed by dayOrder.
  const planName = validRows[0]!.planName;
  const dayMap = new Map<number, NormalizedWorkoutDay>();

  validRows.forEach((row, idx) => {
    let day = dayMap.get(row.dayOrder);
    if (!day) {
      day = { order: row.dayOrder, name: row.dayName, exercises: [] };
      dayMap.set(row.dayOrder, day);
    }
    day.exercises.push({
      order: day.exercises.length + 1,
      exerciseName: row.exerciseName,
      primaryMuscle: row.muscle,
      sets: row.sets,
      repsMin: row.repsMin,
      repsMax: row.repsMax,
      restSeconds: row.restSeconds ?? null,
      targetRir: row.targetRir ?? null,
    });
    void idx;
  });

  const days = Array.from(dayMap.values()).sort((a, b) => a.order - b.order);

  return {
    plan: { name: planName, description: null, days },
    importedCount: validRows.length,
    rejected,
  };
}

function mapExternalExercise(ex: ExternalExercise, order: number): NormalizedWorkoutExercise {
  return {
    order,
    exerciseName: ex.name,
    primaryMuscle: ex.muscle,
    sets: ex.sets,
    repsMin: ex.repsMin,
    repsMax: ex.repsMax,
    restSeconds: ex.restSeconds ?? null,
    targetRir: ex.targetRir ?? null,
  };
}

/**
 * Minimal CSV line splitter supporting double-quoted fields with embedded
 * commas and escaped quotes (""). Sufficient for routine exports; a full RFC
 * 4180 parser is out of scope for the foundation.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
