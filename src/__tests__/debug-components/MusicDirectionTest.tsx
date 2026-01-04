import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getCurrentLocale } from '@/lib/i18nRoutes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function MusicDirectionTest() {
  const { locale, isLocaleForced, t } = useLocaleContext();
  const { currentLanguage } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [testResults, setTestResults] = useState<Array<{
    route: string;
    expectedLocale: string;
    actualLocale: string;
    currentLanguage: string;
    isForced: boolean;
    status: 'pass' | 'fail';
  }>>([]);

  const testRoutes = [
    { route: '/pt', expectedLocale: 'pt' },
    { route: '/en', expectedLocale: 'en' },
    { route: '/es', expectedLocale: 'es' },
    { route: '/pt/about', expectedLocale: 'pt' },
    { route: '/en/pricing', expectedLocale: 'en' },
    { route: '/es/quiz', expectedLocale: 'es' }
  ];

  const runTests = async () => {
    const results = [];
    
    for (const test of testRoutes) {
      // Navegar para a rota
      navigate(test.route);
      
      // Aguardar um pouco para o estado se atualizar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const currentPath = location.pathname;
      const detectedLocale = getCurrentLocale(currentPath);
      
      const result = {
        route: test.route,
        expectedLocale: test.expectedLocale,
        actualLocale: detectedLocale || 'none',
        currentLanguage: currentLanguage,
        isForced: isLocaleForced,
        status: (detectedLocale === test.expectedLocale && locale === test.expectedLocale && currentLanguage === test.expectedLocale) ? 'pass' : 'fail'
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
        <h1 className="text-3xl font-bold mb-2">🎵 Teste de Direcionamento de Músicas</h1>
        <p className="text-muted-foreground">
          Verifica se as músicas estão sendo direcionadas corretamente para cada idioma
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado Atual</CardTitle>
          <CardDescription>Informações sobre o estado atual do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>URL Atual:</strong> {location.pathname}</p>
              <p><strong>Locale da URL:</strong> {getCurrentLocale(location.pathname) || 'Nenhum'}</p>
              <p><strong>Locale do Contexto:</strong> {locale}</p>
            </div>
            <div>
              <p><strong>Current Language:</strong> {currentLanguage}</p>
              <p><strong>Idioma Forçado:</strong> {isLocaleForced ? '✅ Sim' : '❌ Não'}</p>
              <p><strong>Sincronizado:</strong> {locale === currentLanguage ? '✅ Sim' : '❌ Não'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste de Traduções</CardTitle>
          <CardDescription>Verifica se as traduções estão funcionando</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Hero Title:</strong> {t('hero.title')}</p>
            <p><strong>Quiz Title:</strong> {t('quiz.title')}</p>
            <p><strong>Navigation Home:</strong> {t('navigation.home')}</p>
            <p><strong>FAQ Title:</strong> {t('faq.title')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testes Automatizados</CardTitle>
          <CardDescription>Executa testes em todas as rotas</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runTests} className="mb-4">
            🚀 Executar Testes de Direcionamento
          </Button>
          
          {testResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Resultados dos Testes:</h4>
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getLocaleFlag(result.expectedLocale)}</span>
                    <div>
                      <div className="font-medium">{result.route}</div>
                      <div className="text-sm text-muted-foreground">
                        Esperado: {result.expectedLocale} | Atual: {result.actualLocale} | Language: {result.currentLanguage}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(result.status)}>
                      {result.status === 'pass' ? '✅ Passou' : '❌ Falhou'}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Forçado: {result.isForced ? 'Sim' : 'Não'}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Resumo:</span>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      ✅ {testResults.filter(r => r.status === 'pass').length} Passou
                    </Badge>
                    <Badge className="bg-red-100 text-red-800">
                      ❌ {testResults.filter(r => r.status === 'fail').length} Falhou
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
          <CardDescription>Teste manual navegando pelas rotas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {testRoutes.map((test) => (
              <Button
                key={test.route}
                variant="outline"
                onClick={() => navigate(test.route)}
                className="flex items-center gap-2"
              >
                <span>{getLocaleFlag(test.expectedLocale)}</span>
                <span>{test.route}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug de Músicas</CardTitle>
          <CardDescription>Informações sobre o direcionamento de músicas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>VinylPlayer deve usar:</strong> {locale || currentLanguage}</p>
            <p><strong>Prioridade:</strong> Locale do contexto &gt; Current Language</p>
            <p><strong>Estado:</strong> {isLocaleForced ? 'Idioma forçado pela URL' : 'Idioma detectado automaticamente'}</p>
            <p><strong>Sincronização:</strong> {locale === currentLanguage ? '✅ Sincronizado' : '❌ Dessincronizado'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

