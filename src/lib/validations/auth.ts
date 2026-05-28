import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

export const SignupSchema = LoginSchema

export const MagicLinkSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
})

export type LoginInput = z.infer<typeof LoginSchema>
export type SignupInput = z.infer<typeof SignupSchema>
export type MagicLinkInput = z.infer<typeof MagicLinkSchema>
