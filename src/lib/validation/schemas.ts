/**
 * Schemas Zod centralizados e reutilizáveis para validação
 * 
 * Este módulo centraliza todas as validações do sistema usando Zod,
 * garantindo consistência e reutilização em diferentes partes da aplicação.
 * 
 * @module lib/validation/schemas
 */

import { z } from 'zod';

/**
 * Schema para validação de email
 * Valida formato de email e tamanho máximo
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email é obrigatório" })
  .email({ message: "Digite um email válido (ex: seu@email.com)" })
  .max(255, { message: "Email muito longo" });

/**
 * Schema para validação de WhatsApp
 * Valida formato brasileiro: DDD + número (10 ou 11 dígitos)
 */
export const whatsappSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      const numbers = val.replace(/\D/g, '');
      return numbers.length >= 10 && numbers.length <= 11;
    },
    { message: "WhatsApp inválido. Digite DDD + número (ex: (11) 99999-9999)" }
  );

/**
 * Idiomas permitidos no sistema
 */
const ALLOWED_LANGUAGES = ['pt', 'en', 'es'] as const;

/**
 * Estilos musicais permitidos
 */
const ALLOWED_STYLES = [
  'Romântico',
  'Romantic',
  'Romántico',
  'Pop',
  'Rock',
  'MPB',
  'Sertanejo',
  'Forró',
  'Jazz',
  'Gospel',
  'Reggae',
  'Eletrônica',
  'Rap',
] as const;

/**
 * Gêneros vocais permitidos
 */
const ALLOWED_VOCAL_GENDERS = ['m', 'f', ''] as const;

/**
 * Schema para validação de campo de texto com limites
 * 
 * @param min - Tamanho mínimo (opcional)
 * @param max - Tamanho máximo (opcional)
 * @param required - Se o campo é obrigatório
 */
export function createTextFieldSchema(
  min?: number,
  max?: number,
  required = false
) {
  let schema = z.string().trim();

  if (required) {
    schema = schema.min(1, { message: "Campo obrigatório" });
  }

  if (min !== undefined) {
    schema = schema.min(min, { message: `Deve ter pelo menos ${min} caracteres` });
  }

  if (max !== undefined) {
    schema = schema.max(max, { message: `Deve ter no máximo ${max} caracteres` });
  }

  return required ? schema : schema.optional();
}

/**
 * Schema completo para validação de dados do Quiz
 */
export const quizSchema = z.object({
  // Campos obrigatórios
  about_who: z
    .string()
    .trim()
    .min(1, { message: "Nome é obrigatório" })
    .max(100, { message: "Nome deve ter no máximo 100 caracteres" }),

  relationship: z
    .string()
    .trim()
    .min(1, { message: "Relacionamento é obrigatório" })
    .max(100, { message: "Relacionamento deve ter no máximo 100 caracteres" }),

  style: z
    .string()
    .trim()
    .min(1, { message: "Estilo musical é obrigatório" })
    .max(50, { message: "Estilo musical deve ter no máximo 50 caracteres" })
    .refine(
      (val) => ALLOWED_STYLES.includes(val as typeof ALLOWED_STYLES[number]),
      { message: "Estilo musical deve ser um dos valores permitidos" }
    ),

  language: z
    .enum(ALLOWED_LANGUAGES, {
      errorMap: () => ({ message: "Idioma é obrigatório e deve ser pt, en ou es" }),
    }),

  // Campos opcionais
  customRelationship: z
    .string()
    .trim()
    .min(2, { message: "Relacionamento personalizado deve ter pelo menos 2 caracteres" })
    .max(100, { message: "Relacionamento personalizado deve ter no máximo 100 caracteres" })
    .optional(),

  vocal_gender: z
    .union([
      z.enum(ALLOWED_VOCAL_GENDERS),
      z.null(),
    ])
    .optional()
    .transform((val) => val === null ? '' : val),

  qualities: z
    .string()
    .trim()
    .max(500, { message: "Qualidades devem ter no máximo 500 caracteres" })
    .optional(),

  memories: z
    .string()
    .trim()
    .max(800, { message: "Memórias devem ter no máximo 800 caracteres" })
    .optional(),

  message: z
    .string()
    .trim()
    .max(500, { message: "Mensagem deve ter no máximo 500 caracteres" })
    .optional(),
});

/**
 * Schema para validação apenas dos campos obrigatórios do Quiz
 */
export const quizRequiredSchema = quizSchema.pick({
  about_who: true,
  relationship: true,
  style: true,
  language: true,
});

/**
 * Schema para validação de UUID
 */
export const uuidSchema = z.string().uuid({ message: "UUID inválido" });

/**
 * Schema para validação de session_id
 */
export const sessionIdSchema = uuidSchema;

/**
 * Schema para validação de planos
 */
export const planSchema = z.enum(['standard', 'express'], {
  errorMap: () => ({ message: "Plano deve ser 'standard' ou 'express'" }),
});

/**
 * Schema para validação de valores monetários em centavos
 */
export const amountCentsSchema = z
  .number()
  .int({ message: "Valor deve ser um número inteiro" })
  .positive({ message: "Valor deve ser positivo" })
  .min(1, { message: "Valor deve ser maior que zero" });

/**
 * Schema para validação de provider de pagamento
 */
export const paymentProviderSchema = z.enum(['cakto'], {
  errorMap: () => ({ message: "Provider deve ser 'cakto'" }),
});

/**
 * Schema para validação de dados de checkout
 */
export const checkoutDataSchema = z.object({
  session_id: sessionIdSchema,
  quiz: quizSchema,
  customer_email: emailSchema,
  customer_whatsapp: whatsappSchema,
  plan: planSchema,
  amount_cents: amountCentsSchema,
  provider: paymentProviderSchema,
  transaction_id: z.string().optional(),
});

/**
 * Tipo TypeScript inferido do schema do Quiz
 */
export type QuizData = z.infer<typeof quizSchema>;

/**
 * Tipo TypeScript inferido do schema de checkout
 */
export type CheckoutData = z.infer<typeof checkoutDataSchema>;

/**
 * Helper para formatar WhatsApp para formato Cakto (com código do país)
 * 
 * @param whatsapp - Número de WhatsApp formatado
 * @returns Número formatado com código do país (55)
 */
export function formatWhatsappForCakto(whatsapp: string): string {
  const numbers = whatsapp.replace(/\D/g, '');
  if (!numbers.startsWith('55')) {
    return '55' + numbers;
  }
  return numbers;
}

/**
 * Helper para validar email com retorno estruturado
 * 
 * @param email - Email a ser validado
 * @returns Objeto com resultado da validação
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  try {
    emailSchema.parse(email);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Email inválido' };
  }
}

/**
 * Helper para validar WhatsApp com retorno estruturado
 * 
 * @param whatsapp - WhatsApp a ser validado
 * @returns Objeto com resultado da validação
 */
export function validateWhatsapp(whatsapp: string): { valid: boolean; error?: string } {
  try {
    whatsappSchema.parse(whatsapp);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'WhatsApp inválido' };
  }
}
