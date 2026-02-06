import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "El email es requerido" })
    .email("El formato del email es inválido")
    .transform((val) => val.toLowerCase().trim()),
  password: z
    .string({ required_error: "La contraseña es requerida" })
    .min(1, "La contraseña es requerida"),
});

export type LoginInput = z.infer<typeof loginSchema>;
