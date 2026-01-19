import React, { Suspense } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

import { lazyWithRetry } from '@/utils/lazyWithRetry';

const Progress = lazyWithRetry(() => 
  import('@/components/ui/progress').then(module => ({ default: module.Progress }))
);

interface QuizProgressProps {
  step: number;
  totalSteps: number;
  progress: number;
}

export default function QuizProgress({ step, totalSteps, progress }: QuizProgressProps) {
  const { t } = useTranslation();
  
  return (
    <div className="mb-2 md:mb-2">
      <Suspense fallback={<div className="h-1 w-full bg-muted rounded" />}>
        <Progress value={progress} className="h-1" />
      </Suspense>
      <div className="flex items-center justify-between mt-1 md:mt-1.5">
        <p className="text-lg md:text-sm text-[hsl(var(--quiz-text-muted))]">
          {t('quiz.progress.step')} {step} {t('quiz.progress.of')} {totalSteps}
        </p>
        <p className="text-lg md:text-sm font-medium text-[hsl(var(--quiz-primary))]">
          {Math.round(progress)}% {t('quiz.progress.complete')}
        </p>
      </div>
    </div>
  );
}
