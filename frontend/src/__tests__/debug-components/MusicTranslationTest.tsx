import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { getCurrentLocale } from '@/lib/i18nRoutes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function MusicTranslationTest() {
  const { locale, isLocaleForced, t } = useLocaleContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [testResults, setTestResults] = useState<Array<{
    locale: string;
    route: string;
    translations: {
      hero: string;
      quiz: string;
      navigation: string;
      faq: string;
    };
    status: 'pass' | 'fail';
  }>>([]);

  const testLocales = [
    { locale: 'pt', route: '/pt', expected: {
      hero: 'Crie Sua Música Personalizada',
      quiz: 'Conte-nos Sobre Seu Momento Especial',
      navigation: 'Início',
      faq: 'Perguntas Frequentes'
    }},
    { locale: 'en', route: '/en', expected: {
      hero: 'Create Your Personalized Music',
      quiz: 'Tell Us About Your Special Moment',
      navigation: 'Home',
      faq: 'Frequently Asked Questions'
    }},
    { locale: 'es', route: '/es', expected: {
      hero: 'Crea Tu Música Personalizada',
      quiz: 'Cuéntanos Sobre Tu Momento Especial',
      navigation: 'Inicio',
      faq: 'Preguntas Frecuentes'
    }}
  ];

  const testTranslations = async () => {
    const results = [];
    
    for (const test of testLocales) {
      // Navegar para a rota
      navigate(test.route);
      
      // Aguardar um pouco para as traduções carregarem
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const actualTranslations = {
        hero: t('hero.title'),
        quiz: t('quiz.title'),
        navigation: t('navigation.home'),
        faq: t('faq.title')
      };
      
      const isCorrect = 
        actualTranslations.hero === test.expected.hero &&
        actualTranslations.quiz === test.expected.quiz &&
        actualTranslations.navigation === test.expected.navigation &&
        actualTranslations.faq === test.expected.faq;
      
      const result = {
        locale: test.locale,
        route: test.route,
        translations: actualTranslations,
        status: isCorrect ? 'pass' : 'fail'
      };
      
      results.push(result);
    }
    
    setTestResults(results);
  };

  const getLocaleFlag = (locale: string) => {
    const flags: Record<string, string> = {
      pt: '🇧🇷',
      en: '🇺🇸',
      es: '🇪🇸'
    };
    return flags[locale] || '🌍';
  };

  const getStatusColor = (status: 'pass' | 'fail') => {
    return status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">🎵 Teste de Traduções de Música</h1>
        <p className="text-muted-foreground">
          Verifica se as traduções das músicas mudam corretamente para cada idioma
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado Atual</CardTitle>
          <CardDescription>Informações sobre o idioma e traduções atuais</CardDescription>
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
          <CardTitle>Traduções Atuais</CardTitle>
          <CardDescription>Verifica as traduções carregadas no momento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Hero Title:</strong> {t('hero.title')}</p>
            <p><strong>Quiz Title:</strong> {t('quiz.title')}</p>
            <p><strong>Navigation Home:</strong> {t('navigation.home')}</p>
            <p><strong>FAQ Title:</strong> {t('faq.title')}</p>
            <p><strong>Quiz Subtitle:</strong> {t('quiz.subtitle')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testes Automatizados</CardTitle>
          <CardDescription>Executa testes em todos os idiomas</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={testTranslations} className="mb-4">
            🚀 Executar Testes de Tradução
          </Button>
          
          {testResults.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Resultados dos Testes:</h4>
              {testResults.map((result, index) => (
                <div key={index} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getLocaleFlag(result.locale)}</span>
                      <span className="font-medium">{result.locale.toUpperCase()}</span>
                      <span className="text-sm text-muted-foreground">({result.route})</span>
                    </div>
                    <Badge className={getStatusColor(result.status)}>
                      {result.status === 'pass' ? '✅ Passou' : '❌ Falhou'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p><strong>Hero:</strong> {result.translations.hero}</p>
                      <p><strong>Quiz:</strong> {result.translations.quiz}</p>
                    </div>
                    <div>
                      <p><strong>Navigation:</strong> {result.translations.navigation}</p>
                      <p><strong>FAQ:</strong> {result.translations.faq}</p>
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
          <CardDescription>Teste manual navegando pelos idiomas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {testLocales.map((test) => (
              <Button
                key={test.locale}
                variant="outline"
                onClick={() => navigate(test.route)}
                className="flex items-center gap-2"
              >
                <span>{getLocaleFlag(test.locale)}</span>
                <span>{test.locale.toUpperCase()}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


