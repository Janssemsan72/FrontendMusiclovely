import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getCurrentLocale } from '@/lib/i18nRoutes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function MusicDebugger() {
  const { locale, isLocaleForced, t } = useLocaleContext();
  const { currentLanguage } = useTranslation();
  const location = useLocation();
  const [debugInfo, setDebugInfo] = useState<Array<{
    timestamp: number;
    locale: string;
    currentLanguage: string;
    path: string;
    isForced: boolean;
  }>>([]);

  const currentLocale = getCurrentLocale(location.pathname);

  // Adicionar informações de debug quando algo muda
  useEffect(() => {
    const info = {
      timestamp: Date.now(),
      locale,
      currentLanguage,
      path: location.pathname,
      isForced: isLocaleForced
    };
    
    setDebugInfo(prev => [...prev.slice(-9), info]);
  }, [locale, currentLanguage, location.pathname, isLocaleForced]);

  const clearDebugInfo = () => {
    setDebugInfo([]);
  };

  const getStatusColor = (locale: string, currentLanguage: string) => {
    return locale === currentLanguage ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
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
        <h1 className="text-3xl font-bold mb-2">🎵 Music Debugger</h1>
        <p className="text-muted-foreground">
          Debug das músicas e sincronização de idiomas
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
              <p><strong>Locale da URL:</strong> {currentLocale || 'Nenhum'}</p>
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
          <CardTitle>Histórico de Mudanças</CardTitle>
          <CardDescription>Registro de mudanças de idioma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <span className="font-medium">Últimas 10 mudanças:</span>
            <Button onClick={clearDebugInfo} variant="outline" size="sm">
              Limpar
            </Button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {debugInfo.map((info, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getLocaleFlag(info.locale)}</span>
                  <div>
                    <div className="font-medium">
                      {info.locale} → {info.currentLanguage}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {info.path} • {new Date(info.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getStatusColor(info.locale, info.currentLanguage)}>
                    {info.locale === info.currentLanguage ? '✅ Sincronizado' : '❌ Dessincronizado'}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    Forçado: {info.isForced ? 'Sim' : 'Não'}
                  </div>
                </div>
              </div>
            ))}
            
            {debugInfo.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma mudança registrada ainda
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste de Navegação</CardTitle>
          <CardDescription>Teste navegando pelos idiomas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/pt'}
              className="flex items-center gap-2"
            >
              <span>🇧🇷</span>
              <span>PT</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/en'}
              className="flex items-center gap-2"
            >
              <span>🇺🇸</span>
              <span>EN</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/es'}
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
          <CardTitle>Informações Técnicas</CardTitle>
          <CardDescription>Detalhes técnicos do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Hash:</strong> {location.hash}</p>
            <p><strong>Search:</strong> {location.search}</p>
            <p><strong>Window Location:</strong> {window.location.href}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


