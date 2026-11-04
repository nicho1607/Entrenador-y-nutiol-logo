# nutrition (placeholder)

Nutrition plans, food logging, and daily nutrition summaries. No logic yet in
the foundation phase. Models (`NutritionPlan`, `Food`, `Meal`, `MealItem`,
`FoodLog`, `DailyNutrition`) exist in the Prisma schema; the pure calorie/macro
math lives in `src/lib/domain/nutrition.ts`. Real functionality arrives in a
later phase.
