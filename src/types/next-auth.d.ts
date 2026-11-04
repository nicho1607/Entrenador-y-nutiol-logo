/**
 * Module augmentation so the NextAuth session and JWT carry the user id, which
 * server code uses to enforce the data-ownership rule.
 */
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
