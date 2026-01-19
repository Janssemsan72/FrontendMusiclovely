import React, { Suspense } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

import { lazyWithRetry } from '@/utils/lazyWithRetry';

const Textarea = lazyWithRetry(() => 
  import('@/components/ui/textarea').then(module => ({ default: module.Textarea }))
);

interface QuizStep5Props {
  formData: {
    message: string;
  };
  updateField: (field: string, value: string) => void;
  markFieldTouched: (field: string) => void;
  hasFieldError: (field: string) => boolean;
  getFieldError: (field: string) => string | undefined;
}

export default function QuizStep5({
  formData,
  updateField,
  markFieldTouched,
  hasFieldError,
  getFieldError
}: QuizStep5Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5 md:space-y-4">
      <div className="space-y-2 md:space-y-3">
        <div>
          <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mb-2 md:mb-2 leading-snug">
            {t('quiz.questions.heartMessageDescription')}
          </p>
        </div>
        <Suspense fallback={
          <textarea 
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
            placeholder={t('quiz.questions.heartMessagePlaceholder')} 
          />
        }>
          <Textarea
            id="message"
            placeholder={t('quiz.questions.heartMessagePlaceholder')}
            value={formData.message}
            onChange={(e) => {
              updateField('message', e.target.value);
              markFieldTouched('message');
            }}
            onBlur={() => markFieldTouched('message')}
            rows={5}
            className={`border-[hsl(var(--quiz-border))] resize-none text-lg md:text-lg py-2.5 md:py-3 ${
              hasFieldError('message') ? 'border-red-500' : ''
            }`}
          />
        </Suspense>
        {hasFieldError('message') && (
          <p className="text-lg md:text-base text-red-500 mt-1">
            {getFieldError('message')}
          </p>
        )}
        <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mt-1">
          {formData.message.length}/500 {t('quiz.characterCount.characters')} {formData.message.length > 500 && `(${t('quiz.characterCount.maxExceeded')})`}
        </p>
      </div>
    </div>
  );
}
