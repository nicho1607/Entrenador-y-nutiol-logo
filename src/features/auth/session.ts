/**
 * Server-side auth helpers. `getCurrentUser` is the single entry point server
 * code uses to identify the authenticated user; every data query must scope to
 * this user's id (the data-ownership rule). `requireUser` throws when there is
 * no session, for use in server actions / route handlers that must be guarded.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "./options";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}
