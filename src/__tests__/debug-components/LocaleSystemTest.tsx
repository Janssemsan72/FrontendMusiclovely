import React, { useState, useEffect } from 'react';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { useLocaleSimple } from '@/hooks/useLocaleSimple';
import { useCountryDetection } from '@/hooks/useCountryDetection';
import { RobustIPDetection } from '@/lib/robustIPDetection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Globe, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { safeReload } from '@/utils/reload';

export default function LocaleSystemTest() {
  const { locale: contextLocale, isLoading: contextLoading, error: contextError, redetect } = useLocaleContext();
  const { locale: simpleLocale, isLoading: simpleLoading } = useLocaleSimple();
  const { country, language: countryLanguage, isLoading: countryLoading } = useCountryDetection();
  
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const results: any[] = [];

    try {
      // Teste 1: Verificar se os hooks estão funcionando
      results.push({
        test: 'Hook useLocaleContext',
        status: contextError ? 'error' : 'success',
        message: contextError ? `Erro: ${contextError}` : `Idioma: ${contextLocale}, Loading: ${contextLoading}`,
        details: { locale: contextLocale, loading: contextLoading, error: contextError }
      });

      results.push({
        test: 'Hook useLocaleSimple',
        status: simpleLoading ? 'warning' : 'success',
        message: simpleLoading ? 'Ainda carregando...' : `Idioma: ${simpleLocale}`,
        details: { locale: simpleLocale, loading: simpleLoading }
      });

      results.push({
        test: 'Hook useCountryDetection',
        status: countryLoading ? 'warning' : 'success',
        message: countryLoading ? 'Ainda carregando...' : `País: ${country}, Idioma: ${countryLanguage}`,
        details: { country, language: countryLanguage, loading: countryLoading }
      });

      // Teste 2: Sistema robusto de detecção
      try {
        console.log('🧪 [LocaleSystemTest] Testando sistema robusto...');
        const robustResult = await RobustIPDetection.detectCountry();
        if (robustResult) {
          results.push({
            test: 'Sistema Robusto de Detecção',
            status: 'success',
            message: `País: ${robustResult.countryName} (${robustResult.countryCode}) via ${robustResult.source}`,
            details: robustResult
          });
        } else {
          results.push({
            test: 'Sistema Robusto de Detecção',
            status: 'error',
            message: 'Nenhuma API funcionou',
            details: { error: 'Todas as APIs falharam' }
          });
        }
      } catch (robustError) {
        results.push({
          test: 'Sistema Robusto de Detecção',
          status: 'error',
          message: `Erro: ${robustError}`,
          details: { error: robustError }
        });
      }

      // Teste 3: Detecção de idioma robusta
      try {
        console.log('🧪 [LocaleSystemTest] Testando detecção robusta de idioma...');
        const detectedLocale = await RobustIPDetection.detectLocale();
        results.push({
          test: 'Detecção Robusta de Idioma',
          status: 'success',
          message: `Idioma detectado: ${detectedLocale}`,
          details: { locale: detectedLocale }
        });
      } catch (localeError) {
        results.push({
          test: 'Detecção Robusta de Idioma',
          status: 'error',
          message: `Erro: ${localeError}`,
          details: { error: localeError }
        });
      }

      // Teste 4: Verificar armazenamento local
      const localStorageLang = localStorage.getItem('musiclovely_language');
      const cookieLang = document.cookie.split(';').find(c => c.trim().startsWith('lang='))?.split('=')[1];
      
      results.push({
        test: 'Armazenamento Local',
        status: localStorageLang || cookieLang ? 'success' : 'info',
        message: localStorageLang || cookieLang ? 'Preferência encontrada' : 'Nenhuma preferência salva',
        details: { localStorage: localStorageLang, cookie: cookieLang }
      });

      // Teste 5: Verificar idioma do navegador
      const navigatorLang = navigator.language;
      const navigatorLangs = navigator.languages;
      
      results.push({
        test: 'Idioma do Navegador',
        status: 'success',
        message: `Idioma principal: ${navigatorLang}`,
        details: { 
          primary: navigatorLang, 
          all: navigatorLangs,
          supported: ['pt', 'en', 'es'].includes(navigatorLang.split('-')[0])
        }
      });

    } catch (error) {
      results.push({
        test: 'Teste Geral',
        status: 'error',
        message: `Erro durante teste: ${error}`,
        details: { error }
      });
    }

    setTestResults(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runTests();
  }, [contextLocale, simpleLocale, country]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Globe className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const clearAllData = () => {
    localStorage.removeItem('musiclovely_language');
    localStorage.removeItem('detectedCountry');
    localStorage.removeItem('detectedLanguage');
    localStorage.removeItem('lastDetection');
    document.cookie = 'lang=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    safeReload({ reason: 'LocaleSystemTest' });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Teste do Sistema de Detecção de Idioma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado atual dos hooks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">useLocaleContext</h3>
              <div className="space-y-1">
                <Badge variant={contextLocale === 'pt' ? 'default' : 'secondary'}>
                  {contextLocale?.toUpperCase() || 'N/A'}
                </Badge>
                <Badge variant={contextLoading ? 'destructive' : 'default'}>
                  {contextLoading ? 'Carregando...' : 'Pronto'}
                </Badge>
                {contextError && (
                  <Badge variant="destructive">Erro</Badge>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">useLocaleSimple</h3>
              <div className="space-y-1">
                <Badge variant={simpleLocale === 'pt' ? 'default' : 'secondary'}>
                  {simpleLocale?.toUpperCase() || 'N/A'}
                </Badge>
                <Badge variant={simpleLoading ? 'destructive' : 'default'}>
                  {simpleLoading ? 'Carregando...' : 'Pronto'}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">useCountryDetection</h3>
              <div className="space-y-1">
                <Badge variant="outline">
                  {country || 'N/A'}
                </Badge>
                <Badge variant={countryLanguage === 'pt' ? 'default' : 'secondary'}>
                  {countryLanguage?.toUpperCase() || 'N/A'}
                </Badge>
                <Badge variant={countryLoading ? 'destructive' : 'default'}>
                  {countryLoading ? 'Carregando...' : 'Pronto'}
                </Badge>
              </div>
            </div>
          </div>

          {contextError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Erro no contexto:</strong> {contextError}
              </AlertDescription>
            </Alert>
          )}

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runTests} disabled={isRunning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              Executar Testes
            </Button>
            <Button onClick={() => redetect()} variant="outline">
              Redetectar Idioma
            </Button>
            <Button onClick={clearAllData} variant="destructive">
              Limpar Todos os Dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados dos testes */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Resultados dos Testes</h2>
        {testResults.map((result, index) => (
          <Card key={index} className={getStatusColor(result.status)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <h3 className="font-semibold">{result.test}</h3>
                  <p className="text-sm text-gray-600">{result.message}</p>
                  {result.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">
                        Ver detalhes
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logs de debug */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 p-4 rounded-md font-mono text-sm">
            <p>Abra o console do navegador (F12) para ver os logs detalhados.</p>
            <p>Procure por mensagens que começam com:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>🌍 [UseLocale] - Hook principal</li>
              <li>🌍 [UseLocaleSimple] - Hook simples</li>
              <li>🌍 [CountryDetection] - Detecção de país</li>
              <li>🌍 [DetectLocale] - Função de detecção</li>
              <li>🧪 [LocaleSystemTest] - Testes deste componente</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
