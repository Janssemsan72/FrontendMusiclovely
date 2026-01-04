import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { getCurrentLocale } from '@/lib/i18nRoutes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TranslationDebugger() {
  const { locale, isLocaleForced, t, translations } = useLocaleContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<Array<{
    key: string;
    expected: string;
    actual: string;
    status: 'pass' | 'fail';
    timestamp: number;
  }>>([]);

  const testKeys = [
    'hero.title',
    'hero.subtitle',
    'features.step1.title',
    'features.step1.time',
    'features.step1.highlight',
    'features.step2.title',
    'features.step2.time',
    'features.step2.highlight',
    'features.step3.title',
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
    'faq.questions.commercialUse.question',
    'navigation.home',
    'navigation.about',
    'navigation.createMusic'
  ];

  const runDebugTests = () => {
    const results = [];
    
    for (const key of testKeys) {
      const actual = t(key);
      const isTranslated = !actual.includes('.') && actual !== key && actual.length > 0;
      
      const result = {
        key,
        expected: isTranslated ? 'Translated' : 'Not translated',
        actual,
        status: isTranslated ? 'pass' : 'fail',
        timestamp: Date.now()
      };
      
      results.push(result);
    }
    
    setDebugInfo(results);
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

  const clearDebugInfo = () => {
    setDebugInfo([]);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">🔍 Translation Debugger</h1>
        <p className="text-muted-foreground">
          Debug das traduções para EN e ES
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado Atual</CardTitle>
          <CardDescription>Informações sobre o sistema de tradução</CardDescription>
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
              <p><strong>Traduções Carregadas:</strong> {Object.keys(translations).length} chaves</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdo das Traduções</CardTitle>
          <CardDescription>Verifica o conteúdo carregado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Hero:</strong> {translations.hero ? '✅ Carregado' : '❌ Não carregado'}</p>
            <p><strong>Features:</strong> {translations.features ? '✅ Carregado' : '❌ Não carregado'}</p>
            <p><strong>FAQ:</strong> {translations.faq ? '✅ Carregado' : '❌ Não carregado'}</p>
            <p><strong>Navigation:</strong> {translations.navigation ? '✅ Carregado' : '❌ Não carregado'}</p>
            <p><strong>Chaves Totais:</strong> {Object.keys(translations).length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testes de Tradução</CardTitle>
          <CardDescription>Executa testes em todas as chaves</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button onClick={runDebugTests}>
              🚀 Executar Testes
            </Button>
            <Button onClick={clearDebugInfo} variant="outline">
              🗑️ Limpar
            </Button>
          </div>
          
          {debugInfo.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Resultados dos Testes:</h4>
              <div className="max-h-96 overflow-y-auto">
                {debugInfo.map((result, index) => (
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
              </div>
              
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Resumo:</span>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      ✅ {debugInfo.filter(r => r.status === 'pass').length} Traduzido
                    </Badge>
                    <Badge className="bg-red-100 text-red-800">
                      ❌ {debugInfo.filter(r => r.status === 'fail').length} Não traduzido
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
          <CardTitle>Teste Manual por Idioma</CardTitle>
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
            <p><strong>Hero Title:</strong> {t('hero.title')}</p>
            <p><strong>Hero Subtitle:</strong> {t('hero.subtitle')}</p>
            <p><strong>Features Step 1:</strong> {t('features.step1.title')}</p>
            <p><strong>Features Step 1 Time:</strong> {t('features.step1.time')}</p>
            <p><strong>Features Step 1 Highlight:</strong> {t('features.step1.highlight')}</p>
            <p><strong>Features CTA Title:</strong> {t('features.cta.title')}</p>
            <p><strong>FAQ Who Sings:</strong> {t('faq.questions.whoSings.question')}</p>
            <p><strong>Navigation Home:</strong> {t('navigation.home')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug Técnico</CardTitle>
          <CardDescription>Informações técnicas do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Hash:</strong> {location.hash}</p>
            <p><strong>Search:</strong> {location.search}</p>
            <p><strong>Window Location:</strong> {window.location.href}</p>
            <p><strong>Translations Keys:</strong> {Object.keys(translations).join(', ')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


