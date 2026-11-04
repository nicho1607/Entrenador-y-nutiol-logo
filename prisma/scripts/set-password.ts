/**
 * One-off maintenance script: reset a FitMind AI user's password.
 *
 * Uses the SAME hashing method as registration (bcrypt via src/features/auth/password.ts),
 * so the new password works with the normal login flow. It only updates the
 * `passwordHash` of the targeted user; nothing else is modified.
 *
 * Usage (from the project root):
 *   npx tsx prisma/scripts/set-password.ts <email> <newPassword>
 *
 * Example:
 *   npx tsx prisma/scripts/set-password.ts nicolacho1607@gmail.com nico1607
 *
 * Notes:
 * - The email is matched case-insensitively (registration lowercases emails).
 * - The password must satisfy the app's rule (min 8 characters).
 */
import { prisma } from "../../src/server/db";
import { hashPassword } from "../../src/features/auth/password";

async function main(): Promise<void> {
  const [, , rawEmail, newPassword] = process.argv;

  if (!rawEmail || !newPassword) {
    console.error(
      "Usage: npx tsx prisma/scripts/set-password.ts <email> <newPassword>",
    );
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();

  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters (app validation rule).");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`No user found with email "${email}". Nothing changed.`);
    console.error("Register at /register first, or check the email spelling.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`Password updated for ${email}. You can now log in with the new password.`);
}

main()
  .catch((err) => {
    console.error("Failed to update password:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
