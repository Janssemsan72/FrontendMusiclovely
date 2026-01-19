import React, { Suspense } from 'react';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/useTranslation';

import { lazyWithRetry } from '@/utils/lazyWithRetry';

const Textarea = lazyWithRetry(() => 
  import('@/components/ui/textarea').then(module => ({ default: module.Textarea }))
);

interface QuizStep4Props {
  formData: {
    memories: string;
  };
  updateField: (field: string, value: string) => void;
  markFieldTouched: (field: string) => void;
  hasFieldError: (field: string) => boolean;
  getFieldError: (field: string) => string | undefined;
}

export default function QuizStep4({
  formData,
  updateField,
  markFieldTouched,
  hasFieldError,
  getFieldError
}: QuizStep4Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5 md:space-y-3">
      <div>
        <Label htmlFor="memories" className="text-xl md:text-xl font-semibold mb-1 block">
          {t('quiz.questions.memories')} ({t('quiz.characterCount.optional')})
        </Label>
        <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mb-2 md:mb-2 leading-snug">
          {t('quiz.questions.memoriesDescription')}
        </p>
      </div>
      <Suspense fallback={
        <textarea 
          className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
          placeholder={t('quiz.questions.memoriesPlaceholder')} 
        />
      }>
        <Textarea
          id="memories"
          placeholder={t('quiz.questions.memoriesPlaceholder')}
          value={formData.memories}
          onChange={(e) => {
            updateField('memories', e.target.value);
            markFieldTouched('memories');
          }}
          onBlur={() => markFieldTouched('memories')}
          rows={5}
          className={`border-[hsl(var(--quiz-border))] resize-none text-lg md:text-lg py-2.5 md:py-3 ${
            hasFieldError('memories') ? 'border-red-500' : ''
          }`}
        />
      </Suspense>
      {hasFieldError('memories') && (
        <p className="text-lg md:text-base text-red-500 mt-1">
          {getFieldError('memories')}
        </p>
      )}
      <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mt-1">
        {formData.memories.length}/800 {t('quiz.characterCount.characters')} {formData.memories.length > 800 && `(${t('quiz.characterCount.maxExceeded')})`}
      </p>
    </div>
  );
}
