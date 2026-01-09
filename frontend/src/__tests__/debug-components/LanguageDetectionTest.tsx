import React, { useState, useEffect } from 'react';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Globe, MapPin, Cookie, Database } from 'lucide-react';
import { detectLocaleAtEdge } from '@/lib/edgeLocale';

export default function LanguageDetectionTest() {
  const { locale, isLoading, error, redetect, forceLocale } = useLocaleContext();
  const [detectionInfo, setDetectionInfo] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const gatherDetectionInfo = async () => {
    setIsDetecting(true);
    
    try {
      // Informações do navegador
      const navigatorLang = navigator.language;
      const navigatorLangs = navigator.languages;
      
      // Informações de armazenamento
      const localStorageLang = localStorage.getItem('musiclovely_language');
      const cookieLang = document.cookie.split(';').find(c => c.trim().startsWith('lang='))?.split('=')[1];
      
      // Detecção via Edge Function (geolocalização no Edge)
      let edgeInfo = null as any;
      try {
        edgeInfo = await detectLocaleAtEdge();
      } catch (error) {
        console.warn('Erro ao consultar Edge Function:', error);
      }
      
      // Timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      setDetectionInfo({
        navigator: {
          language: navigatorLang,
          languages: navigatorLangs
        },
        storage: {
          localStorage: localStorageLang,
          cookie: cookieLang
        },
        edge: edgeInfo,
        timezone,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao coletar informações:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    gatherDetectionInfo();
  }, []);

  const testDetection = async () => {
    // Limpar preferências salvas
    localStorage.removeItem('musiclovely_language');
    document.cookie = 'lang=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Forçar nova detecção
    await redetect();
    await gatherDetectionInfo();
  };

  const testForcedLanguage = (lang: 'pt' | 'en' | 'es') => {
    forceLocale(lang);
    gatherDetectionInfo();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Teste de Detecção Automática de Idioma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado atual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Botões de teste */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={testDetection} disabled={isDetecting}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Testar Detecção Automática
            </Button>
            <Button onClick={() => testForcedLanguage('pt')} variant="outline">
              Forçar Português
            </Button>
            <Button onClick={() => testForcedLanguage('en')} variant="outline">
              Forçar Inglês
            </Button>
            <Button onClick={() => testForcedLanguage('es')} variant="outline">
              Forçar Espanhol
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Informações de detecção */}
      {detectionInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Armazenamento Local
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <strong>localStorage:</strong> {detectionInfo.storage.localStorage || 'N/A'}
              </div>
              <div>
                <strong>Cookie:</strong> {detectionInfo.storage.cookie || 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Navegador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <strong>Idioma principal:</strong> {detectionInfo.navigator.language}
              </div>
              <div>
                <strong>Idiomas aceitos:</strong> {detectionInfo.navigator.languages?.join(', ')}
              </div>
              <div>
                <strong>Timezone:</strong> {detectionInfo.timezone}
              </div>
            </CardContent>
          </Card>

          {detectionInfo.edge && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Geolocalização (Edge Function)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <strong>País:</strong> {detectionInfo.edge.country || 'N/A'}
                  </div>
                  <div>
                    <strong>Idioma:</strong> {detectionInfo.edge.language}
                  </div>
                  <div>
                    <strong>Origem:</strong> {detectionInfo.edge.source || 'edge'}
                  </div>
                  <div>
                    <strong>IP (se fornecido):</strong> {detectionInfo.edge.ip || 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Logs de debug */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 p-4 rounded-md font-mono text-sm">
            <p>Abra o console do navegador (F12) para ver os logs detalhados da detecção.</p>
            <p>Procure por mensagens que começam com 🌍 [UseLocale] ou 🌍 [DetectLocale].</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
