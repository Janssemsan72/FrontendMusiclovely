import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface QuizData {
  about_who?: string;
}

interface CheckoutHeaderProps {
  quiz: QuizData | null;
}

export default function CheckoutHeader({ quiz }: CheckoutHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="text-center mb-6 md:mb-8">
      <p className="text-2xl md:text-2xl lg:text-3xl mb-2 md:mb-3">
        <strong>{t('checkout.subtitle')}</strong> <strong className="text-muted-foreground text-2xl md:text-3xl lg:text-3xl">{quiz?.about_who}</strong>.
      </p>
      <h1 className="text-xl md:text-xl lg:text-2xl mb-4 md:mb-5">{t('checkout.title')}</h1>
    </div>
  );
}
