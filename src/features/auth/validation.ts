/**
 * Shared Zod schemas for auth (usable on client and server).
 */
import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un correo electrónico válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(100),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
