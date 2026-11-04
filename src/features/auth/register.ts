/**
 * Server-side user registration. Hashes the password and creates the User
 * row. Returns a discriminated result so callers can present a clean error
 * (e.g. email already in use) without leaking internals.
 */
import { prisma } from "@/server/db";
import { hashPassword } from "./password";
import { registerSchema, type RegisterInput } from "./validation";

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Ya existe una cuenta con ese correo electrónico." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  return { ok: true, userId: user.id };
}
