import React from 'react';
import { useSimpleTranslation } from '@/hooks/useSimpleTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SimpleTranslationTest() {
  const { t, locale, changeLocale, isLoading } = useSimpleTranslation();

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Teste de Tradução Simples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Idioma atual:</strong> {locale}
          </div>
          <div>
            <strong>Carregando:</strong> {isLoading ? 'Sim' : 'Não'}
          </div>
          <div>
            <strong>Tradução hero.title:</strong> {t('hero.title')}
          </div>
          <div>
            <strong>Tradução hero.subtitle:</strong> {t('hero.subtitle')}
          </div>
          <div>
            <strong>Tradução navigation.createMusic:</strong> {t('navigation.createMusic')}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => changeLocale('pt')}>Português</Button>
            <Button onClick={() => changeLocale('es')}>Español</Button>
            <Button onClick={() => changeLocale('en')}>English</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



