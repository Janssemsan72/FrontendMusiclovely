import React, { Suspense } from 'react';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/useTranslation';

import { lazyWithRetry } from '@/utils/lazyWithRetry';

const Textarea = lazyWithRetry(() => 
  import('@/components/ui/textarea').then(module => ({ default: module.Textarea }))
);

interface QuizStep3Props {
  formData: {
    qualities: string;
  };
  updateField: (field: string, value: string) => void;
  markFieldTouched: (field: string) => void;
  hasFieldError: (field: string) => boolean;
  getFieldError: (field: string) => string | undefined;
}

export default function QuizStep3({
  formData,
  updateField,
  markFieldTouched,
  hasFieldError,
  getFieldError
}: QuizStep3Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5 md:space-y-3">
      <div>
        <Label htmlFor="qualities" className="text-xl md:text-xl font-semibold mb-1 block">
          {t('quiz.questions.qualities')} ({t('quiz.characterCount.optional')})
        </Label>
        <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mb-2 md:mb-2 leading-snug">
          {t('quiz.questions.qualitiesDescription')}
        </p>
      </div>
      <Suspense fallback={
        <textarea 
          className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
          placeholder={t('quiz.questions.qualitiesPlaceholder')} 
        />
      }>
        <Textarea
          id="qualities"
          placeholder={t('quiz.questions.qualitiesPlaceholder')}
          value={formData.qualities}
          onChange={(e) => {
            updateField('qualities', e.target.value);
            markFieldTouched('qualities');
          }}
          onBlur={() => markFieldTouched('qualities')}
          rows={5}
          className={`border-[hsl(var(--quiz-border))] resize-none text-lg md:text-lg py-2.5 md:py-3 ${
            hasFieldError('qualities') ? 'border-red-500' : ''
          }`}
        />
      </Suspense>
      {hasFieldError('qualities') && (
        <p className="text-lg md:text-base text-red-500 mt-1">
          {getFieldError('qualities')}
        </p>
      )}
      <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mt-1">
        {formData.qualities.length}/500 {t('quiz.characterCount.characters')} {formData.qualities.length > 500 && `(${t('quiz.characterCount.maxExceeded')})`}
      </p>
    </div>
  );
}
