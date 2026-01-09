import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { getCurrentLocale } from '@/lib/i18nRoutes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TranslationTest() {
  const { locale, isLocaleForced, t } = useLocaleContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [testResults, setTestResults] = useState<Array<{
    key: string;
    expected: string;
    actual: string;
    status: 'pass' | 'fail';
  }>>([]);

  const testKeys = [
    'features.step1.time',
    'features.step1.highlight',
    'features.step2.time',
    'features.step2.highlight',
    'features.step3.time',
    'features.step3.highlight',
    'features.cta.title',
    'features.cta.subtitle',
    'features.cta.button',
    'faq.questions.whoSings.question',
    'faq.questions.musicStyles.question',
    'faq.questions.deliveryTimes.question',
    'faq.questions.adjustments.question',
    'faq.questions.whatYouGet.question',
    'faq.questions.commercialUse.question'
  ];

  const runTests = () => {
    const results = [];
    
    for (const key of testKeys) {
      const actual = t(key);
      const isTranslated = !actual.includes('.') && actual !== key;
      
      const result = {
        key,
        expected: isTranslated ? 'Translated' : 'Not translated',
        actual,
        status: isTranslated ? 'pass' : 'fail'
      };
      
      results.push(result);
    }
    
    setTestResults(results);
  };

  const getStatusColor = (status: 'pass' | 'fail') => {
    return status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getLocaleFlag = (locale: string) => {
    const flags: Record<string, string> = {
      pt: '🇧🇷',
      en: '🇺🇸',
      es: '🇪🇸'
    };
    return flags[locale] || '🌍';
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">🌐 Teste de Traduções</h1>
        <p className="text-muted-foreground">
          Verifica se todas as frases estão sendo traduzidas corretamente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado Atual</CardTitle>
          <CardDescription>Informações sobre o idioma atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>URL Atual:</strong> {location.pathname}</p>
              <p><strong>Locale da URL:</strong> {getCurrentLocale(location.pathname) || 'Nenhum'}</p>
              <p><strong>Locale do Contexto:</strong> {locale}</p>
            </div>
            <div>
              <p><strong>Idioma Forçado:</strong> {isLocaleForced ? '✅ Sim' : '❌ Não'}</p>
              <p><strong>Flag:</strong> {getLocaleFlag(locale)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testes de Tradução</CardTitle>
          <CardDescription>Executa testes em todas as chaves de tradução</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runTests} className="mb-4">
            🚀 Executar Testes de Tradução
          </Button>
          
          {testResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Resultados dos Testes:</h4>
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{result.key}</div>
                    <div className="text-sm text-muted-foreground">
                      <strong>Esperado:</strong> {result.expected} | <strong>Atual:</strong> {result.actual}
                    </div>
                  </div>
                  <Badge className={getStatusColor(result.status)}>
                    {result.status === 'pass' ? '✅ Traduzido' : '❌ Não traduzido'}
                  </Badge>
                </div>
              ))}
              
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Resumo:</span>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      ✅ {testResults.filter(r => r.status === 'pass').length} Traduzido
                    </Badge>
                    <Badge className="bg-red-100 text-red-800">
                      ❌ {testResults.filter(r => r.status === 'fail').length} Não traduzido
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste Manual</CardTitle>
          <CardDescription>Teste manual navegando pelos idiomas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/pt')}
              className="flex items-center gap-2"
            >
              <span>🇧🇷</span>
              <span>PT</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/en')}
              className="flex items-center gap-2"
            >
              <span>🇺🇸</span>
              <span>EN</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/es')}
              className="flex items-center gap-2"
            >
              <span>🇪🇸</span>
              <span>ES</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Traduções</CardTitle>
          <CardDescription>Verifica algumas traduções específicas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Features Step 1 Time:</strong> {t('features.step1.time')}</p>
            <p><strong>Features Step 1 Highlight:</strong> {t('features.step1.highlight')}</p>
            <p><strong>Features CTA Title:</strong> {t('features.cta.title')}</p>
            <p><strong>FAQ Who Sings Question:</strong> {t('faq.questions.whoSings.question')}</p>
            <p><strong>FAQ Music Styles Question:</strong> {t('faq.questions.musicStyles.question')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


