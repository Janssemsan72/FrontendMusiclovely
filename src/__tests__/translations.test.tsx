import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTranslation } from '@/hooks/useTranslation';

const TranslationProbe = () => {
  const { t, i18n, currentLanguage } = useTranslation();
  return (
    <div>
      <div>{t('hero.title')}</div>
      <div data-testid="i18n-language">{i18n.language}</div>
      <div data-testid="current-language">{currentLanguage}</div>
    </div>
  );
};

describe('Sistema de Traduções', () => {
  it('mantém português como idioma fixo', () => {
    render(<TranslationProbe />);

    expect(screen.getByText('Músicas Personalizadas para Seus Momentos Especiais')).toBeInTheDocument();
    expect(screen.getByTestId('i18n-language').textContent).toBe('pt');
    expect(screen.getByTestId('current-language').textContent).toBe('pt');
  });

  
});


