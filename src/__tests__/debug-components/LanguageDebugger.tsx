import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocale } from '@/hooks/useLocale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Globe, MapPin, Cookie, Search } from 'lucide-react';

export default function LanguageDebugger() {
  const { t, locale, isLoading } = useTranslation();
  const { redetect } = useLocale();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const getDebugInfo = async () => {
    setIsDetecting(true);
    try {
      // Obter informações de debug
      const cookieLang = document.cookie.match(/(?:^|; )lang=([^;]+)/)?.[1] ?? null;
      const queryLang = new URLSearchParams(window.location.search).get('lang');
      const navigatorLang = navigator.language;
      const acceptLanguage = navigator.languages.join(', ');

      // Tentar detectar país via IP
      let countryCode = null;
      let countryName = null;
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          countryCode = data.country_code;
          countryName = data.country_name;
        }
      } catch (error) {
        console.warn('Erro ao detectar país:', error);
      }

      setDebugInfo({
        currentLocale: locale,
        cookieLang,
        queryLang,
        navigatorLang,
        acceptLanguage,
        countryCode,
        countryName,
        isLoading,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao obter debug info:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    getDebugInfo();
  }, [locale]);

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Debug de Detecção de Idioma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Estado Atual</h3>
              <p><strong>Idioma:</strong> {locale}</p>
              <p><strong>Carregando:</strong> {isLoading ? 'Sim' : 'Não'}</p>
              <p><strong>Tradução:</strong> {t('hero.title')}</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Detecção</h3>
              <Button 
                onClick={getDebugInfo} 
                disabled={isDetecting}
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isDetecting ? 'animate-spin' : ''}`} />
                {isDetecting ? 'Detectando...' : 'Atualizar Info'}
              </Button>
              <Button 
                onClick={redetect} 
                className="w-full"
                variant="outline"
              >
                <Globe className="h-4 w-4 mr-2" />
                Re-detectar Idioma
              </Button>
            </div>
          </div>

          {debugInfo && (
            <div className="space-y-3">
              <h3 className="font-semibold">Informações de Debug</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Cookie className="h-4 w-4 text-blue-500" />
                  <span><strong>Cookie:</strong> {debugInfo.cookieLang || 'Nenhum'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-green-500" />
                  <span><strong>Query:</strong> {debugInfo.queryLang || 'Nenhum'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-purple-500" />
                  <span><strong>Navegador:</strong> {debugInfo.navigatorLang}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span><strong>País:</strong> {debugInfo.countryName} ({debugInfo.countryCode})</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>Accept-Language:</strong> {debugInfo.acceptLanguage}
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>Última atualização:</strong> {debugInfo.timestamp}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



