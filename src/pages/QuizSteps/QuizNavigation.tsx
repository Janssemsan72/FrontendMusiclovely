import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2 } from '@/utils/iconImports';
import { useTranslation } from '@/hooks/useTranslation';

interface QuizNavigationProps {
  step: number;
  totalSteps: number;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export default function QuizNavigation({
  step,
  totalSteps,
  loading,
  onBack,
  onNext,
  onSubmit
}: QuizNavigationProps) {
  const { t } = useTranslation();

  // ✅ CORREÇÃO: Wrappers com preventDefault para evitar duplo clique
  const handleBackClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      onBack();
    }
  };

  const handleNextClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      onNext();
    }
  };

  const handleSubmitClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      onSubmit();
    }
  };

  return (
    <div className="flex gap-2 md:gap-3 mt-2.5 md:mt-4">
      {step > 1 && (
        <Button
          type="button"
          variant="outline"
          onClick={handleBackClick}
          disabled={loading}
          className="border-[hsl(var(--quiz-border))] text-xl md:text-base font-semibold px-4 py-3 md:px-5 md:py-3"
        >
          <ArrowLeft className="mr-2 h-6 w-6 md:h-4 md:w-4 flex-shrink-0" />
          {t('quiz.buttons.back', 'Voltar')}
        </Button>
      )}
      
      {step < totalSteps ? (
        <Button
          type="button"
          onClick={handleNextClick}
          className="ml-auto bg-[hsl(var(--quiz-primary))] hover:bg-[hsl(var(--quiz-primary-hover))] text-white text-xl md:text-base font-semibold px-4 py-3 md:px-5 md:py-3"
          disabled={loading}
        >
          {t('quiz.buttons.next', 'Próximo')}
          <ArrowRight className="ml-2 h-6 w-6 md:h-4 md:w-4 flex-shrink-0" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleSubmitClick}
          className="ml-auto bg-[hsl(var(--quiz-primary))] hover:bg-[hsl(var(--quiz-primary-hover))] text-white text-base md:text-sm font-semibold px-4 py-3 md:px-5 md:py-3 whitespace-normal md:whitespace-nowrap leading-tight"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-6 w-6 md:h-4 md:w-4 animate-spin flex-shrink-0" />}
          <span className="text-center">{t('quiz.buttons.continueToPayment', 'Continuar para Pagamento')}</span>
        </Button>
      )}
    </div>
  );
}
