/**
 * Utilitário centralizado para validação de dados do quiz
 * Usado tanto no frontend quanto no backend para garantir consistência
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

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Limites de caracteres conforme definido no sistema
const FIELD_LIMITS = {
  about_who: { min: 1, max: 100 },
  relationship: { min: 1, max: 100 },
  customRelationship: { min: 2, max: 100 },
  style: { min: 1, max: 50 },
  language: { min: 1, max: 10 },
  qualities: { max: 500 },
  memories: { max: 800 },
  message: { max: 500 },
  vocal_gender: { allowed: ['m', 'f', ''] },
} as const;

// Idiomas permitidos
const ALLOWED_LANGUAGES = ['pt', 'en', 'es'];

// Estilos permitidos (pode ser expandido)
const ALLOWED_STYLES = [
  'Romântico',
  'Romantic',
  'Romántico',
  'Pop', // Mantido para compatibilidade com dados antigos
  'Rock',
  'MPB',
  'Sertanejo',
  'Forró',
  'Jazz',
  'Gospel',
  'Reggae',
  'Eletrônica',
  'Rap',
];

/**
 * Sanitiza uma string removendo espaços extras e caracteres perigosos
 */
export function sanitizeString(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().replace(/[\x00-\x1F\x7F]/g, ''); // Remove caracteres de controle
}

/**
 * Valida um campo de texto com limites
 */
function validateTextField(
  field: string,
  value: string | undefined | null,
  limits: { min?: number; max?: number },
  required = false
): ValidationError | null {
  const sanitized = sanitizeString(value);

  if (required && !sanitized) {
    // Mapear campos para mensagens amigáveis (serão traduzidas no componente)
    const fieldMessages: Record<string, string> = {
      'about_who': 'Nome é obrigatório',
      'relationship': 'Relacionamento é obrigatório',
      'style': 'Estilo musical é obrigatório',
      'language': 'Idioma é obrigatório',
      'customRelationship': 'Relacionamento é obrigatório',
    };
    
    return {
      field,
      message: fieldMessages[field] || `${field} é obrigatório`,
    };
  }

  if (!sanitized && !required) {
    return null; // Campo opcional vazio é válido
  }

  if (limits.min && sanitized.length < limits.min) {
    return {
      field,
      message: `${field} deve ter pelo menos ${limits.min} caracteres`,
    };
  }

  if (limits.max && sanitized.length > limits.max) {
    return {
      field,
      message: `${field} deve ter no máximo ${limits.max} caracteres`,
    };
  }

  return null;
}

/**
 * Valida campo de enum (valores permitidos)
 */
function validateEnumField(
  field: string,
  value: string | undefined | null,
  allowedValues: readonly string[],
  required = false
): ValidationError | null {
  if (required && !value) {
    return {
      field,
      message: `${field} é obrigatório`,
    };
  }

  if (!value && !required) {
    return null;
  }

  if (value && !allowedValues.includes(value)) {
    return {
      field,
      message: `${field} deve ser um dos valores permitidos: ${allowedValues.join(', ')}`,
    };
  }

  return null;
}

/**
 * Validação completa do quiz
 */
export function validateQuiz(quiz: QuizData, options: { strict?: boolean } = {}): ValidationResult {
  const errors: ValidationError[] = [];
  const { strict = false } = options;

  // 1. Validar about_who (obrigatório)
  const aboutWhoError = validateTextField(
    'about_who',
    quiz.about_who,
    FIELD_LIMITS.about_who,
    true
  );
  if (aboutWhoError) errors.push(aboutWhoError);

  // 2. Validar relationship (obrigatório)
  const relationship = quiz.relationship || '';
  if (relationship.startsWith('Outro: ')) {
    const customRel = relationship.replace('Outro: ', '');
    const customRelError = validateTextField(
      'customRelationship',
      customRel,
      FIELD_LIMITS.customRelationship,
      true
    );
    if (customRelError) errors.push(customRelError);
  } else {
    const relationshipError = validateTextField(
      'relationship',
      relationship,
      FIELD_LIMITS.relationship,
      true
    );
    if (relationshipError) errors.push(relationshipError);
  }

  // 3. Validar style (obrigatório)
  const styleError = validateTextField('style', quiz.style, FIELD_LIMITS.style, true);
  if (styleError) errors.push(styleError);

  // 4. Validar language (obrigatório)
  const languageError = validateEnumField('language', quiz.language, ALLOWED_LANGUAGES, true);
  if (languageError) errors.push(languageError);

  // 5. Validar vocal_gender (opcional, mas se fornecido deve ser válido)
  if (quiz.vocal_gender !== null && quiz.vocal_gender !== undefined && quiz.vocal_gender !== '') {
    const vocalGenderError = validateEnumField(
      'vocal_gender',
      quiz.vocal_gender,
      FIELD_LIMITS.vocal_gender.allowed,
      false
    );
    if (vocalGenderError) errors.push(vocalGenderError);
  }

  // 6. Validar qualities (opcional)
  if (quiz.qualities) {
    const qualitiesError = validateTextField('qualities', quiz.qualities, FIELD_LIMITS.qualities, false);
    if (qualitiesError) errors.push(qualitiesError);
  }

  // 7. Validar memories (opcional)
  if (quiz.memories) {
    const memoriesError = validateTextField('memories', quiz.memories, FIELD_LIMITS.memories, false);
    if (memoriesError) errors.push(memoriesError);
  }

  // 8. Validar message (opcional)
  if (quiz.message) {
    const messageError = validateTextField('message', quiz.message, FIELD_LIMITS.message, false);
    if (messageError) errors.push(messageError);
  }

  // 9. Validação adicional em modo strict
  if (strict) {
    // Verificar se style é um dos valores permitidos
    if (quiz.style && !ALLOWED_STYLES.includes(quiz.style)) {
      errors.push({
        field: 'style',
        message: `Estilo musical deve ser um dos valores permitidos`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitiza todos os campos do quiz
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
 * Validação rápida apenas dos campos obrigatórios
 */
export function validateQuizRequired(quiz: QuizData): ValidationResult {
  const errors: ValidationError[] = [];

  if (!quiz.about_who || !sanitizeString(quiz.about_who)) {
    errors.push({ field: 'about_who', message: 'Nome é obrigatório' });
  }

  if (!quiz.style || !sanitizeString(quiz.style)) {
    errors.push({ field: 'style', message: 'Estilo musical é obrigatório' });
  }

  if (!quiz.language || !ALLOWED_LANGUAGES.includes(quiz.language)) {
    errors.push({ field: 'language', message: 'Idioma é obrigatório' });
  }

  if (!quiz.relationship || !sanitizeString(quiz.relationship)) {
    errors.push({ field: 'relationship', message: 'Relacionamento é obrigatório' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formata mensagens de erro para exibição ao usuário
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0].message;
  return `Múltiplos erros: ${errors.map((e) => e.message).join(', ')}`;
}



