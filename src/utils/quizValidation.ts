/**
 * Utilitário centralizado para validação de dados do quiz
 * 
 * Este módulo fornece funções de validação e sanitização para dados do quiz.
 * As validações agora usam schemas Zod centralizados para garantir consistência
 * em todo o sistema.
 * 
 * @module utils/quizValidation
 */

import { z } from 'zod';
import { quizSchema, quizRequiredSchema, type QuizData as ZodQuizData } from '@/lib/validation/schemas';

/**
 * Tipo de dados do quiz (compatível com interface antiga)
 * Mantido para compatibilidade com código existente
 */
export interface QuizData {
  relationship?: string;
  about_who?: string;
  style?: string;
  language?: string;
  vocal_gender?: string | null;
  qualities?: string;
  memories?: string;
  message?: string;
  customRelationship?: string;
  [key: string]: any;
}

/**
 * Erro de validação de campo
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Resultado de validação
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Sanitiza uma string removendo espaços extras e caracteres perigosos
 * 
 * @param value - Valor a ser sanitizado
 * @returns String sanitizada
 */
export function sanitizeString(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().replace(/[\x00-\x1F\x7F]/g, ''); // Remove caracteres de controle
}

/**
 * Converte erros Zod para formato ValidationError
 * 
 * @param zodError - Erro do Zod
 * @returns Array de erros de validação
 */
function convertZodErrors(zodError: z.ZodError): ValidationError[] {
  return zodError.errors.map((err) => ({
    field: err.path.join('.') || 'unknown',
    message: err.message,
  }));
}

/**
 * Prepara dados do quiz para validação Zod
 * 
 * Converte o formato antigo (relationship com "Outro: ") para o formato Zod
 * 
 * @param quiz - Dados do quiz no formato antigo
 * @returns Dados preparados para validação Zod
 */
function prepareQuizForZod(quiz: QuizData): Partial<ZodQuizData> {
  // Tratar vocal_gender: converter null para string vazia ou manter valor válido
  let vocalGender: 'm' | 'f' | '' | null | undefined = undefined;
  if (quiz.vocal_gender === 'm' || quiz.vocal_gender === 'f') {
    vocalGender = quiz.vocal_gender;
  } else if (quiz.vocal_gender === '' || quiz.vocal_gender === null || quiz.vocal_gender === undefined) {
    vocalGender = ''; // String vazia é valor válido no enum
  }

  const prepared: Partial<ZodQuizData> = {
    about_who: quiz.about_who,
    style: quiz.style,
    language: quiz.language as 'pt' | 'en' | 'es' | undefined,
    vocal_gender: vocalGender,
    qualities: quiz.qualities,
    memories: quiz.memories,
    message: quiz.message,
  };

  // Tratar relationship: se começa com "Outro: ", extrair como customRelationship
  const relationship = quiz.relationship || '';
  if (relationship.startsWith('Outro: ')) {
    prepared.customRelationship = relationship.replace('Outro: ', '');
    prepared.relationship = ''; // Será validado como vazio, mas customRelationship será usado
  } else {
    prepared.relationship = relationship;
  }

  return prepared;
}

/**
 * Validação completa do quiz usando schemas Zod
 * 
 * Valida todos os campos do quiz incluindo obrigatórios e opcionais.
 * Em modo strict, também valida se os valores estão dentro dos permitidos.
 * 
 * @param quiz - Dados do quiz a serem validados
 * @param options - Opções de validação
 * @param options.strict - Se true, valida também valores permitidos (ex: estilos musicais)
 * @returns Resultado da validação com lista de erros (se houver)
 * 
 * @example
 * ```ts
 * const result = validateQuiz({
 *   about_who: "João",
 *   relationship: "Amigo",
 *   style: "Romântico",
 *   language: "pt"
 * });
 * 
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateQuiz(quiz: QuizData, options: { strict?: boolean } = {}): ValidationResult {
  try {
    // Preparar dados para validação Zod
    const preparedQuiz = prepareQuizForZod(quiz);
    
    // Validar usando schema Zod (já inclui validação strict de estilos)
    quizSchema.parse(preparedQuiz);
    
    return {
      valid: true,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = convertZodErrors(error);
      
      // Ajustar campo relationship/customRelationship para compatibilidade
      const adjustedErrors = errors.map((err) => {
        // Se o erro é em customRelationship mas o quiz tem relationship com "Outro: "
        if (err.field === 'customRelationship' && quiz.relationship?.startsWith('Outro: ')) {
          return { ...err, field: 'relationship' };
        }
        return err;
      });
      
      return {
        valid: false,
        errors: adjustedErrors,
      };
    }
    
    // Erro inesperado
    return {
      valid: false,
      errors: [{ field: 'unknown', message: 'Erro de validação inesperado' }],
    };
  }
}

/**
 * Sanitiza todos os campos do quiz
 * 
 * Remove espaços extras, caracteres de controle e normaliza os valores.
 * Deve ser usado antes de salvar ou enviar dados do quiz.
 * 
 * @param quiz - Dados do quiz a serem sanitizados
 * @returns Quiz sanitizado com todos os campos limpos
 * 
 * @example
 * ```ts
 * const cleanQuiz = sanitizeQuiz({
 *   about_who: "  João  ",
 *   relationship: "Amigo\n",
 *   style: "Romântico"
 * });
 * // Resultado: { about_who: "João", relationship: "Amigo", style: "Romântico" }
 * ```
 */
export function sanitizeQuiz(quiz: QuizData): QuizData {
  return {
    ...quiz,
    about_who: sanitizeString(quiz.about_who),
    relationship: sanitizeString(quiz.relationship),
    style: sanitizeString(quiz.style),
    language: sanitizeString(quiz.language),
    qualities: quiz.qualities ? sanitizeString(quiz.qualities) : undefined,
    memories: quiz.memories ? sanitizeString(quiz.memories) : undefined,
    message: quiz.message ? sanitizeString(quiz.message) : undefined,
    vocal_gender: quiz.vocal_gender || null,
  };
}

/**
 * Validação rápida apenas dos campos obrigatórios usando Zod
 * 
 * Valida apenas os campos essenciais: about_who, relationship, style e language.
 * Mais rápida que validateQuiz() e útil para validação em tempo real durante o preenchimento.
 * 
 * @param quiz - Dados do quiz a serem validados
 * @returns Resultado da validação apenas dos campos obrigatórios
 * 
 * @example
 * ```ts
 * // Validação rápida durante o preenchimento
 * const result = validateQuizRequired(partialQuiz);
 * if (result.valid) {
 *   // Pode prosseguir para próxima etapa
 * }
 * ```
 */
export function validateQuizRequired(quiz: QuizData): ValidationResult {
  try {
    const preparedQuiz = prepareQuizForZod(quiz);
    quizRequiredSchema.parse(preparedQuiz);
    
    return {
      valid: true,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = convertZodErrors(error);
      
      // Ajustar campo relationship/customRelationship para compatibilidade
      const adjustedErrors = errors.map((err) => {
        if (err.field === 'customRelationship' && quiz.relationship?.startsWith('Outro: ')) {
          return { ...err, field: 'relationship' };
        }
        return err;
      });
      
      return {
        valid: false,
        errors: adjustedErrors,
      };
    }
    
    return {
      valid: false,
      errors: [{ field: 'unknown', message: 'Erro de validação inesperado' }],
    };
  }
}

/**
 * Formata mensagens de erro para exibição ao usuário
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0].message;
  return `Múltiplos erros: ${errors.map((e) => e.message).join(', ')}`;
}



