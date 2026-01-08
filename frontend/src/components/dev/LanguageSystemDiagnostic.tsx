import React, { useState, useEffect } from 'react';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { safeReload } from '@/utils/reload';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: any;
}

export default function LanguageSystemDiagnostic() {
  const { locale, isLoading, error, redetect, forceLocale } = useLocaleContext();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    try {
      // 1. Teste de inicialização básica
      results.push({
        test: 'Inicialização do Sistema',
        status: isLoading ? 'warning' : 'success',
        message: isLoading ? 'Sistema ainda carregando...' : 'Sistema inicializado',
        details: { isLoading, locale }
      });

      // 2. Teste de armazenamento local
      const localStorageLang = localStorage.getItem('musiclovely_language');
      const cookieLang = document.cookie.split(';').find(c => c.trim().startsWith('lang='))?.split('=')[1];
      
      results.push({
        test: 'Armazenamento Local',
        status: localStorageLang || cookieLang ? 'success' : 'info',
        message: localStorageLang || cookieLang ? 'Preferência encontrada' : 'Nenhuma preferência salva',
        details: { localStorage: localStorageLang, cookie: cookieLang }
      });

      // 3. Teste de detecção de IP
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const ipData = await response.json();
          results.push({
            test: 'Detecção de IP',
            status: 'success',
            message: `País detectado: ${ipData.country_name} (${ipData.country_code})`,
            details: ipData
          });
        } else {
          results.push({
            test: 'Detecção de IP',
            status: 'error',
            message: `Erro HTTP: ${response.status}`,
            details: { status: response.status }
          });
        }
      } catch (ipError) {
        results.push({
          test: 'Detecção de IP',
          status: 'error',
          message: `Erro na requisição: ${ipError}`,
          details: { error: ipError }
        });
      }

      // 4. Teste de idioma do navegador
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

      // 5. Teste de timezone
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        results.push({
          test: 'Timezone',
          status: 'success',
          message: `Timezone: ${timezone}`,
          details: { timezone }
        });
      } catch (tzError) {
        results.push({
          test: 'Timezone',
          status: 'error',
          message: `Erro ao detectar timezone: ${tzError}`,
          details: { error: tzError }
        });
      }

      // 6. Teste de carregamento de traduções
      try {
        const { lazyTranslations } = await import('@/lib/lazyTranslations');
        const isLoaded = lazyTranslations.isLoaded(locale);
        results.push({
          test: 'Carregamento de Traduções',
          status: isLoaded ? 'success' : 'warning',
          message: isLoaded ? 'Traduções carregadas' : 'Traduções não carregadas',
          details: { isLoaded, locale }
        });
      } catch (translationError) {
        results.push({
          test: 'Carregamento de Traduções',
          status: 'error',
          message: `Erro ao carregar traduções: ${translationError}`,
          details: { error: translationError }
        });
      }

      // 7. Teste de contexto
      results.push({
        test: 'Contexto de Idioma',
        status: error ? 'error' : 'success',
        message: error ? `Erro no contexto: ${error}` : 'Contexto funcionando',
        details: { error, locale, isLoading }
      });

      // 8. Teste de redirecionamento
      const currentPath = window.location.pathname;
      const hasLocalePrefix = /^\/(pt|en|es)(\/|$)/.test(currentPath);
      
      results.push({
        test: 'Redirecionamento',
        status: hasLocalePrefix ? 'success' : 'warning',
        message: hasLocalePrefix ? 'URL com prefixo de idioma' : 'URL sem prefixo (será redirecionado)',
        details: { currentPath, hasLocalePrefix }
      });

    } catch (error) {
      results.push({
        test: 'Diagnóstico Geral',
        status: 'error',
        message: `Erro durante diagnóstico: ${error}`,
        details: { error }
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, [locale, isLoading, error]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
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
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const clearAllData = () => {
    localStorage.removeItem('musiclovely_language');
    localStorage.removeItem('language_analytics');
    document.cookie = 'lang=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    safeReload({ reason: 'LanguageSystemDiagnostic' });
  };

  const testForcedDetection = async () => {
    localStorage.removeItem('musiclovely_language');
    document.cookie = 'lang=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    await redetect();
    runDiagnostics();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Diagnóstico do Sistema de Idioma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado atual */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Idioma Atual</h3>
              <Badge variant={locale === 'pt' ? 'default' : 'secondary'}>
                {locale?.toUpperCase() || 'N/A'}
              </Badge>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Status</h3>
              <Badge variant={isLoading ? 'destructive' : 'default'}>
                {isLoading ? 'Carregando...' : 'Pronto'}
              </Badge>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Erro</h3>
              <Badge variant={error ? 'destructive' : 'default'}>
                {error ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">URL</h3>
              <Badge variant="outline">
                {window.location.pathname}
              </Badge>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Erro detectado:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runDiagnostics} disabled={isRunning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              Executar Diagnóstico
            </Button>
            <Button onClick={testForcedDetection} variant="outline">
              Testar Detecção Forçada
            </Button>
            <Button onClick={clearAllData} variant="destructive">
              Limpar Todos os Dados
            </Button>
            <Button onClick={() => forceLocale('pt')} variant="outline">
              Forçar PT
            </Button>
            <Button onClick={() => forceLocale('en')} variant="outline">
              Forçar EN
            </Button>
            <Button onClick={() => forceLocale('es')} variant="outline">
              Forçar ES
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados do diagnóstico */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Resultados do Diagnóstico</h2>
        {diagnostics.map((result, index) => (
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
            <p>Procure por mensagens que começam com 🌍 [UseLocale], 🌍 [DetectLocale], 🌍 [LocaleContext].</p>
            <p>Se não houver logs, o sistema pode não estar sendo inicializado corretamente.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
