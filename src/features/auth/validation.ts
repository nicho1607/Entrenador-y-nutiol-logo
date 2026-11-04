/**
 * Shared Zod schemas for auth (usable on client and server).
 */
import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Name is required.").max(100),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
