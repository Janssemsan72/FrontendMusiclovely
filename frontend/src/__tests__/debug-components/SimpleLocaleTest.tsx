import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SimpleLocaleTest() {
  const [locale, setLocale] = useState('es');
  const [isLoading, setIsLoading] = useState(true);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    const detectLocale = async () => {
      console.log('🌍 [SimpleLocaleTest] Iniciando detecção...');
      
      try {
        // Verificar cookie
        const cookieLang = document.cookie.match(/(?:^|; )lang=([^;]+)/)?.[1];
        if (cookieLang) {
          console.log('🌍 [SimpleLocaleTest] Usando cookie:', cookieLang);
          setLocale(cookieLang);
          setIsLoading(false);
          return;
        }

        // Detectar país via IP
        console.log('🌍 [SimpleLocaleTest] Detectando país...');
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          setCountry(data.country_code);
          console.log('🌍 [SimpleLocaleTest] País detectado:', data.country_code);
          
          // Mapear país para idioma
          const ptCountries = ['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL', 'MO'];
          const esCountries = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'GQ', 'PR'];
          
          if (ptCountries.includes(data.country_code)) {
            setLocale('pt');
            document.cookie = 'lang=pt;path=/;max-age=31536000;samesite=lax';
          } else if (esCountries.includes(data.country_code)) {
            setLocale('es');
            document.cookie = 'lang=es;path=/;max-age=31536000;samesite=lax';
          } else {
            setLocale('en');
            document.cookie = 'lang=en;path=/;max-age=31536000;samesite=lax';
          }
        }
      } catch (error) {
        console.error('❌ [SimpleLocaleTest] Erro:', error);
        setLocale('es');
      } finally {
        setIsLoading(false);
      }
    };

    detectLocale();
  }, []);

  const changeLocale = (newLocale: string) => {
    setLocale(newLocale);
    document.cookie = `lang=${newLocale};path=/;max-age=31536000;samesite=lax`;
  };

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Teste Simples de Detecção</CardTitle>
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
            <strong>Cookie:</strong> {document.cookie}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => changeLocale('pt')}>Português</Button>
            <Button onClick={() => changeLocale('es')}>Español</Button>
            <Button onClick={() => changeLocale('en')}>English</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



