import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ForceLocaleTest() {
  const [locale, setLocale] = useState('es');
  const [isLoading, setIsLoading] = useState(true);
  const [country, setCountry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forceDetection = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🌍 [ForceLocaleTest] Forçando detecção...');
      
      // Limpar cookie para forçar nova detecção
      document.cookie = 'lang=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
      
      // Detectar país via IP
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        const data = await response.json();
        setCountry(data.country_code);
        console.log('🌍 [ForceLocaleTest] País detectado:', data.country_code);
        
        // Mapear país para idioma
        const ptCountries = ['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL', 'MO'];
        const esCountries = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'GQ', 'PR'];
        
        let detectedLocale = 'es';
        if (ptCountries.includes(data.country_code)) {
          detectedLocale = 'pt';
        } else if (esCountries.includes(data.country_code)) {
          detectedLocale = 'es';
        } else {
          detectedLocale = 'en';
        }
        
        console.log('🌍 [ForceLocaleTest] Idioma detectado:', detectedLocale);
        setLocale(detectedLocale);
        
        // Salvar cookie
        document.cookie = `lang=${detectedLocale};path=/;max-age=31536000;samesite=lax`;
        
        // Recarregar página para aplicar mudança
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err) {
      console.error('❌ [ForceLocaleTest] Erro:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Verificar cookie atual
    const cookieLang = document.cookie.match(/(?:^|; )lang=([^;]+)/)?.[1];
    if (cookieLang) {
      setLocale(cookieLang);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Teste de Detecção Forçada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Idioma atual:</strong> {locale}
          </div>
          <div>
            <strong>Carregando:</strong> {isLoading ? 'Sim' : 'Não'}
          </div>
          <div>
            <strong>País detectado:</strong> {country || 'Nenhum'}
          </div>
          <div>
            <strong>Erro:</strong> {error || 'Nenhum'}
          </div>
          <div>
            <strong>Cookie:</strong> {document.cookie}
          </div>
          <Button onClick={forceDetection} disabled={isLoading}>
            {isLoading ? 'Detectando...' : 'Forçar Detecção'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}



