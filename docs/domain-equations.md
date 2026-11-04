# Domain equations

The pure calculation library lives in `src/lib/domain/`. Every function returns
a `DomainResult<T>` — either `{ ok: true, value }` or `{ ok: false, reason,
message }` — so callers must handle missing inputs and safety gating instead of
receiving a silently-wrong number.

> These numbers are orientational estimates, not medical advice. The library
> refuses to compute for flagged situations and asks the user to consult a
> professional.

## Nutrition (`src/lib/domain/nutrition.ts`)

### BMI — Body Mass Index (orientational)

```
BMI = weightKg / (heightM^2)
```

- Units: weight kg, height m (converted from cm internally).
- WHO adult categories: `< 18.5` underweight, `< 25` normal, `< 30` overweight,
  else obese.
- **Limitation:** ignores body composition; muscular individuals and athletes
  can be mis-categorized. It is a population screening tool, not a diagnosis.

### BMR — Basal Metabolic Rate (Mifflin-St Jeor)

```
male:   BMR = 10*kg + 6.25*cm - 5*age + 5
female: BMR = 10*kg + 6.25*cm - 5*age - 161
```

- Units: kg, cm, years; result in kcal/day.
- **Assumption:** adult. The equation is not valid for children/adolescents.
- **Limitation:** a population estimate (~±10% individual variance). Does not
  account for body composition directly.

### TDEE — Total Daily Energy Expenditure

```
TDEE = BMR * activityMultiplier
```

Activity multipliers:

| Level        | Multiplier |
| ------------ | ---------- |
| SEDENTARY    | 1.2        |
| LIGHT        | 1.375      |
| MODERATE     | 1.55       |
| ACTIVE       | 1.725      |
| VERY_ACTIVE  | 1.9        |

- **Limitation:** activity level is self-reported and coarse; real expenditure
  varies with NEAT, training load, and environment.

### Daily calorie target

```
target = TDEE + goalAdjustment
```

The product supports **seven** goals, each mapped to a concrete calorie delta:

| Goal           | Meaning                              | Adjustment (kcal) |
| -------------- | ------------------------------------ | ----------------- |
| FAT_LOSS       | fat loss (moderate deficit)          | -500              |
| HYPERTROPHY    | muscle growth (lean surplus)         | +300              |
| RECOMPOSITION  | simultaneous fat loss + muscle gain  | 0                 |
| WEIGHT_GAIN    | general weight gain (larger surplus) | +500              |
| STRENGTH       | maximal strength (slight surplus)    | +150              |
| ENDURANCE      | aerobic capacity (maintenance)       | 0                 |
| MAINTENANCE    | hold current weight                  | 0                 |

> These seven identifiers mirror the Prisma `GoalType` enum and the domain
> library's `GoalType` type one-to-one. They replaced the original four-value
> enum (`LOSE_FAT`, `GAIN_MUSCLE`, `MAINTAIN`, `IMPROVE_PERFORMANCE`) in the
> user-profile phase (migration `0002_profile_goals`).

**Safety floor:** the target is never allowed below BMR. If the goal adjustment
would push it under BMR, the target is clamped to BMR and `clampedToFloor` is
`true`. This prevents recommending an unsafe deficit.

**Professional-review gate:** if any safety flag is set (eating-disorder risk,
pregnancy, metabolic disease), `calculateCalorieTarget` returns
`PROFESSIONAL_REVIEW_REQUIRED` and computes nothing. Missing essential inputs
return `MISSING_INPUT` rather than a guess.

### Macro split

```
proteinG = calories * proteinRatio / 4
carbsG   = calories * carbsRatio   / 4
fatG     = calories * fatRatio     / 9
```

- Energy density: protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g.
- Default ratio: 30% protein / 40% carbs / 30% fat.
- The ratio must sum to 1 (within a small epsilon) or `INVALID_INPUT` is
  returned.

### Nutrition — portion scaling, daily totals, water

These helpers build on the macro conventions above. Each returns a
`DomainResult<T>`; none fabricates a value.

#### Portion scaling

```
scaled = per100g * quantityG / 100
```

- `scalePortion` scales a food's per-100g macros (calories, protein, carbs,
  fat) to an arbitrary quantity in grams.
- A zero-gram portion yields all zeros. Negative/non-finite grams or any
  negative per-100g value returns `INVALID_INPUT`.

#### Daily totals

```
totals = Σ item macros   (empty list → all zeros)
```

- `sumDailyTotals` adds a list of per-item macros into a single day total. An
  empty list is valid and yields zeros. A non-finite item macro returns
  `INVALID_INPUT`.

#### Consumed vs target

```
remaining(macro) = target(macro) - consumed(macro)   (may be negative)
over(macro)      = consumed(macro) > target(macro)
```

- `compareToTarget` reports, per macro, how much is left and whether the target
  was exceeded. Being exactly at target is not "over".

#### Market-list aggregation

- `aggregateMarketList` sums grams by food name across duplicate entries and
  returns the result sorted by name (ascending) — a deduplicated shopping list.
  Negative/non-finite grams return `INVALID_INPUT`.

#### Dietary filtering

- `filterByDietary` partitions foods into `allowed` and `conflicts` using
  **case-insensitive substring** matching of each allergy and restriction
  against the food name (and any tags). The first matching term becomes the
  conflict reason. It is a conservative name-based filter, not an ingredient
  database.

#### Water target (orientational)

```
waterTargetMl = weightKg * 35
```

- `calculateWaterTargetMl` returns a rough ~35 ml/kg daily water target.
  Non-positive/missing weight returns `MISSING_INPUT`.
- **Limitation:** a general-population heuristic, **not medical advice**; real
  needs vary with climate, activity, and health conditions.

## Training (`src/lib/domain/training.ts`)

### Training volume per muscle group

```
volume(muscle) = sum over entries of (sets * reps)
```

Simple rep-volume (not tonnage, which would need load). Negative/non-integer
sets or reps return `INVALID_INPUT`.

### Progression rule (RIR/RPE and recovery aware)

Decided in order:

1. Achieved reps `< 60%` of target → **DECREASE** load.
2. Poor recovery (`recoveredWell = false`) → **HOLD** (never progress while
   under-recovered).
3. Target reps met **and** last set `RIR >= 2` **and** recovered well →
   **INCREASE** by `stepPct` (default 2.5%).
4. Otherwise → **HOLD**.

`recoveredWell` is required. Without it the function returns `MISSING_INPUT`
rather than guessing. Load is never auto-increased from reps alone.

### Plateau detection

Compares the estimated one-rep max across the most recent window using the
Epley formula:

```
e1RM = weight * (1 + reps / 30)
improvementPct = (endE1RM - startE1RM) / startE1RM * 100
isPlateau = improvementPct < minImprovementPct
```

If the history is shorter than `windowSize`, returns `MISSING_INPUT`.

## Plan generation (`src/lib/domain/plan-generator.ts`)

The plan generator is a pure function that turns a profile-derived request plus
a catalog of candidate exercises into a `GeneratedPlan`. It builds **on top of**
the training math above and never auto-increases load — progression stays with
the RIR/recovery-aware rule.

### Per-goal set / rep / rest prescription

Three base prescriptions, each chosen from standard resistance-training rep
ranges:

| Basis       | Sets | Reps  | Rest  | Target RIR |
| ----------- | ---- | ----- | ----- | ---------- |
| Strength    | 4    | 3-6   | 180 s | 2          |
| Hypertrophy | 3    | 8-12  | 90 s  | 2          |
| Endurance   | 3    | 15-20 | 45 s  | 1          |

Low reps with long rest develop maximal force (strength); moderate reps with
moderate rest maximize mechanical tension and volume (hypertrophy); high reps
with short rest sustain work density (endurance).

Every `GoalType` maps onto the nearest base, and the mapping is surfaced in each
exercise's `reason` text so nothing is hidden:

| Goal          | Maps to     | Rationale                                              |
| ------------- | ----------- | ------------------------------------------------------ |
| STRENGTH      | Strength    | Direct.                                                |
| HYPERTROPHY   | Hypertrophy | Direct.                                                |
| ENDURANCE     | Endurance   | Direct.                                                |
| FAT_LOSS      | Endurance   | Higher reps / short rest keep work density up.         |
| RECOMPOSITION | Hypertrophy | Muscle retention drives a recomposition.               |
| WEIGHT_GAIN   | Hypertrophy | A surplus is spent building muscle.                    |
| MAINTENANCE   | Hypertrophy | Moderate, sustainable general training.                |

### Split by days per week

| Days per week | Split                                            |
| ------------- | ------------------------------------------------ |
| 1-2           | Full body (one full-body day per training day)   |
| 3             | Full body × 3                                    |
| 4             | Upper / Lower × 2 (Upper A, Lower A, Upper B, …) |
| 5-6           | Push / Pull / Legs, repeating to fill the week   |

Each day targets its muscle groups in priority order, picking one feasible
exercise per target (then backfilling under the cap). Only exercises whose
required equipment is a subset of the user's available equipment are considered
(`FULL_GYM` satisfies any requirement; `BODYWEIGHT` needs nothing). Limitations
exclude contraindicated movements by both name substring and a muscle-group map
(e.g. a "knee" limitation excludes quad/hamstring/calf movements).

### Volume cap by session length

```
exercisesPerDay = clamp(floor(sessionMinutes / 10), 1, 8)
```

A deliberately simple planning assumption of ~10 minutes per exercise block
(warm-up ramp + working sets + rest), clamped between 1 and 8 exercises. Actual
set timing is captured later through logging; this only bounds the plan size.

### Progression deferral

The generator sets a `targetRir` and documents the rep/rest scheme but never
prescribes a load. Load changes are decided only by `suggestProgression` after a
session is logged, which requires RIR and recovery information (see the
progression rule above). This keeps a single source of truth for progression.
