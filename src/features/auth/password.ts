/**
 * Password hashing helpers. bcrypt is used (via bcryptjs, a pure-JS impl so no
 * native build step is needed). A cost factor of 12 balances security and
 * latency for the foundation.
 */
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
