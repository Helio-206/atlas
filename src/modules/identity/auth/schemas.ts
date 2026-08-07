import { z } from 'zod'

const emailSchema = z
  .string()
  .trim()
  .email('Introduza um endereço de email válido.')
  .max(320, 'O email é demasiado longo.')

const passwordSchema = z
  .string()
  .min(8, 'A password deve ter pelo menos 8 caracteres.')
  .max(128, 'A password é demasiado longa.')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Introduza o seu nome completo.')
      .max(120, 'O nome é demasiado longo.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'As passwords não coincidem.',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'As passwords não coincidem.',
    path: ['confirmPassword'],
  })
