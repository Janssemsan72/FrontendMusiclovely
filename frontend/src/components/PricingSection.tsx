import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import RegionalPricingSection from './RegionalPricingSection';

export default function PricingSection() {
  const { locale } = useTranslation();
  const [useRegionalPricing, setUseRegionalPricing] = useState(true);

  // Verificar se deve usar preços regionais
  useEffect(() => {
    // Por padrão, usar preços regionais
    setUseRegionalPricing(true);
  }, []);

  // Se usar preços regionais, renderizar o componente regionalizado
  if (useRegionalPricing) {
    return <RegionalPricingSection key={locale} />;
  }
  return null;
}
