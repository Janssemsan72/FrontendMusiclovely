import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { getCurrentLocale } from '@/lib/i18nRoutes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function RedirectTest() {
  const { locale, isLocaleForced, t } = useLocaleContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [redirectHistory, setRedirectHistory] = useState<Array<{
    from: string;
    to: string;
    timestamp: number;
    locale: string;
  }>>([]);

  const testRoutes = [
    { route: '/pt', expectedRedirect: '/pt/', locale: 'pt' },
    { route: '/en', expectedRedirect: '/en/', locale: 'en' },
    { route: '/es', expectedRedirect: '/es/', locale: 'es' }
  ];

  const testRedirect = async (route: string, expectedRedirect: string, expectedLocale: string) => {
    const startTime = Date.now();
    
    // Navegar para a rota
    navigate(route);
    
    // Aguardar um pouco para o redirecionamento
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const endTime = Date.now();
    const currentPath = location.pathname;
    
    const redirectInfo = {
      from: route,
      to: currentPath,
      timestamp: endTime - startTime,
      locale: expectedLocale
    };
    
    setRedirectHistory(prev => [...prev, redirectInfo]);
    
    return {
      success: currentPath === expectedRedirect,
      actualPath: currentPath,
      expectedPath: expectedRedirect,
      time: endTime - startTime
    };
  };

  const runAllTests = async () => {
    const results = [];
    
    for (const test of testRoutes) {
      const result = await testRedirect(test.route, test.expectedRedirect, test.locale);
      results.push({ ...test, ...result });
      
      // Aguardar um pouco entre testes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  };

  const getLocaleFlag = (locale: string) => {
    const flags: Record<string, string> = {
      pt: '🇧🇷',
      en: '🇺🇸',
      es: '🇪🇸'
    };
    return flags[locale] || '🌍';
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">🔄 Teste de Redirecionamento</h1>
        <p className="text-muted-foreground">
          Verifica se as rotas /pt, /en, /es redirecionam corretamente para /pt/, /en/, /es/
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado Atual</CardTitle>
          <CardDescription>Informações sobre a rota atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>URL Atual:</strong> {location.pathname}</p>
              <p><strong>Locale Detectado:</strong> {getCurrentLocale(location.pathname) || 'Nenhum'}</p>
            </div>
            <div>
              <p><strong>Locale do Contexto:</strong> {locale}</p>
              <p><strong>Idioma Forçado:</strong> {isLocaleForced ? '✅ Sim' : '❌ Não'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste de Tradução</CardTitle>
          <CardDescription>Verifica se as traduções estão funcionando no idioma correto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Hero Title:</strong> {t('hero.title')}</p>
            <p><strong>Navigation Home:</strong> {t('navigation.home')}</p>
            <p><strong>Quiz Title:</strong> {t('quiz.title')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testes de Redirecionamento</CardTitle>
          <CardDescription>Executa testes automatizados de redirecionamento</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runAllTests} 
            className="mb-4"
          >
            🚀 Executar Testes de Redirecionamento
          </Button>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Histórico de Redirecionamentos:</h4>
            {redirectHistory.map((redirect, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getLocaleFlag(redirect.locale)}</span>
                  <div>
                    <div className="font-medium">{redirect.from} → {redirect.to}</div>
                    <div className="text-sm text-muted-foreground">
                      Tempo: {redirect.timestamp}ms
                    </div>
                  </div>
                </div>
                <Badge className={getStatusColor(redirect.to === `/${redirect.locale}/`)}>
                  {redirect.to === `/${redirect.locale}/` ? '✅ Correto' : '❌ Incorreto'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste Manual</CardTitle>
          <CardDescription>Teste manual navegando pelas rotas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {testRoutes.map((test) => (
              <Button
                key={test.route}
                variant="outline"
                onClick={() => navigate(test.route)}
                className="flex items-center gap-2"
              >
                <span>{getLocaleFlag(test.locale)}</span>
                <span>{test.route}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug de Redirecionamento</CardTitle>
          <CardDescription>Informações técnicas sobre o redirecionamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Hash:</strong> {location.hash}</p>
            <p><strong>Search:</strong> {location.search}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


