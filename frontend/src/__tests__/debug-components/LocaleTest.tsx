import React, { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocale } from '@/hooks/useLocale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LocaleTest() {
  const { t, locale, isLoading } = useTranslation();
  const { redetect } = useLocale();

  useEffect(() => {
    console.log('🌍 [LocaleTest] Componente montado');
    console.log('🌍 [LocaleTest] Locale atual:', locale);
    console.log('🌍 [LocaleTest] Carregando:', isLoading);
    console.log('🌍 [LocaleTest] Tradução teste:', t('hero.title'));
  }, [locale, isLoading, t]);

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Teste de Detecção de Idioma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Idioma atual:</strong> {locale}
          </div>
          <div>
            <strong>Carregando:</strong> {isLoading ? 'Sim' : 'Não'}
          </div>
          <div>
            <strong>Tradução teste:</strong> {t('hero.title')}
          </div>
          <div>
            <strong>Cookie:</strong> {document.cookie}
          </div>
          <Button onClick={redetect}>
            Re-detectar Idioma
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}



