# Routine import format

FitMind AI can import workout routines exported from other apps. Two formats
are supported: **JSON** and **CSV**. The importer validates every field with
Zod and never silently drops data — rows it cannot map are returned in a
`rejected` list with a human-readable reason.

Importer entry points (`src/features/workouts/import/importer.ts`):

- `importRoutineFromJson(raw: string): ImportResult`
- `importRoutineFromCsv(raw: string): ImportResult`

Both return:

```ts
interface ImportResult {
  plan: NormalizedWorkoutPlan | null; // null when nothing could be imported
  rejected: RejectedRow[]; // rows that failed validation, with reasons
  importedCount: number; // exercise rows successfully mapped
}
```

The normalized plan maps onto the internal `WorkoutPlan` / `WorkoutDay` /
`WorkoutExercise` models (see `prisma/schema.prisma`). Imported plans are stored
with `source = IMPORTED`.

## Import sources

The `/trainer/import` page accepts the routine in three ways:

1. **Link (default).** The user pastes a URL; the server downloads it and runs
   the same parser. The format is detected from the content: text starting
   with `{` is parsed as JSON, anything else as CSV.
2. **Paste** the JSON/CSV text.
3. **Upload** a `.json` / `.csv` file (read in the browser, sent as text).

### Supported links

Common share links are rewritten to their raw/download form
(`normalizeRoutineUrl` in `src/features/workouts/import/fetch-routine.ts`):

| Pasted link                                              | Downloaded from                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `https://docs.google.com/spreadsheets/d/{id}/edit#gid=N` | `…/spreadsheets/d/{id}/export?format=csv&gid=N`                    |
| `https://github.com/{owner}/{repo}/blob/{ref}/{path}`    | `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}`    |
| `https://gist.github.com/{owner}/{id}`                   | `https://gist.githubusercontent.com/{owner}/{id}/raw` (first file) |
| `https://www.dropbox.com/…?dl=0`                         | Same URL with `dl=1`                                               |
| Any other `https://` URL                                 | As is                                                              |

A Google Sheet must be shared as "Anyone with the link can view"; the CSV
export is of the tab in the link's `gid` (the first tab when absent). The sheet
must use the CSV header described below.

### Link restrictions

The URL is user-supplied and fetched server-side, so the download is hardened
against SSRF. A link is refused when it:

- is not `https://`, includes `user:password@`, or uses a port other than 443;
- resolves (or redirects) to a non-public address — loopback, private
  (RFC 1918), link-local (incl. cloud metadata `169.254.169.254`), CGNAT,
  multicast/reserved, or IPv6 loopback/ULA/link-local. The check runs inside
  the socket's DNS lookup, so DNS rebinding cannot bypass it;
- redirects more than 3 times, takes longer than 10 s, or is larger than 1 MB.

Both the preview and the confirm actions require a signed-in user and
re-download the link; the client's preview is never trusted.

## Muscle group values

`muscle` must be one of:

```
CHEST, BACK, SHOULDERS, BICEPS, TRICEPS, QUADS, HAMSTRINGS,
GLUTES, CALVES, CORE, FULL_BODY, OTHER
```

Any other value causes that exercise row to be rejected (not the whole import,
for CSV).

## JSON format

A single plan object containing an array of days, each with an array of
exercises.

```json
{
  "name": "Push Pull Legs",
  "description": "3-day split",
  "days": [
    {
      "name": "Push",
      "order": 1,
      "exercises": [
        {
          "name": "Bench Press",
          "muscle": "CHEST",
          "sets": 4,
          "repsMin": 6,
          "repsMax": 10,
          "restSeconds": 120,
          "targetRir": 2
        },
        {
          "name": "Overhead Press",
          "muscle": "SHOULDERS",
          "sets": 3,
          "repsMin": 8,
          "repsMax": 12
        }
      ]
    }
  ]
}
```

Field rules:

| Field            | Type    | Required | Notes                               |
| ---------------- | ------- | -------- | ----------------------------------- |
| `name`           | string  | yes      | Plan name (non-empty).              |
| `description`    | string  | no       | May be null/omitted.                |
| `days`           | array   | yes      | At least one day.                   |
| day `name`       | string  | yes      | Non-empty.                          |
| day `order`      | integer | yes      | Positive; days are sorted by it.    |
| day `exercises`  | array   | yes      | At least one exercise.              |
| ex `name`        | string  | yes      | Non-empty.                          |
| ex `muscle`      | enum    | yes      | See muscle group values.            |
| ex `sets`        | integer | yes      | Positive.                           |
| ex `repsMin`     | integer | yes      | Positive.                           |
| ex `repsMax`     | integer | yes      | Positive; must be `>= repsMin`.     |
| ex `restSeconds` | integer | no       | Non-negative; null/omitted allowed. |
| ex `targetRir`   | integer | no       | Non-negative; null/omitted allowed. |

For JSON, if the top-level structure fails validation the whole import is
rejected (there is no reliable way to partially recover a malformed tree).

## CSV format

One row per exercise. Day grouping is derived from `dayOrder` + `dayName`.
Numeric columns may be quoted or unquoted. Empty `restSeconds` / `targetRir`
cells are treated as "not provided" (null).

Required header columns:

```
planName,dayName,dayOrder,exerciseName,muscle,sets,repsMin,repsMax
```

Optional columns: `restSeconds,targetRir`.

Example:

```csv
planName,dayName,dayOrder,exerciseName,muscle,sets,repsMin,repsMax,restSeconds,targetRir
Upper Lower,Upper,1,Bench Press,CHEST,4,6,10,120,2
Upper Lower,Upper,1,Row,BACK,4,8,12,90,
Upper Lower,Lower,2,Squat,QUADS,5,5,5,180,1
```

CSV behavior:

- Missing required headers rejects the whole import with a `header` reason.
- An individual row that fails validation (bad muscle, `repsMax < repsMin`,
  non-numeric sets, etc.) is annotated in `rejected` and skipped; valid rows
  still import.
- The plan name is taken from the first valid row's `planName`.
