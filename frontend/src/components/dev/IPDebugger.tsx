import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, MapPin, Globe, Flag } from 'lucide-react';

interface IPInfo {
  ip: string;
  country: string;
  country_code: string;
  city: string;
  region: string;
  timezone: string;
  language: string;
}

export default function IPDebugger() {
  const [ipInfo, setIpInfo] = useState<IPInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectIP = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    const timestamp = Date.now();
    
    try {
      // Tentar ipapi.co primeiro
      const response = await fetch(`https://ipapi.co/json/?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const detectedLanguage = getLanguageFromCountry(data.country_code);
        
        setIpInfo({
          ip: data.ip,
          country: data.country_name,
          country_code: data.country_code,
          city: data.city,
          region: data.region,
          timezone: data.timezone,
          language: detectedLanguage
        });
        
        // Salvar no localStorage
        localStorage.setItem('lastIPDetection', timestamp.toString());
        localStorage.setItem('detectedIP', data.ip);
        localStorage.setItem('detectedCountry', data.country_code);
        localStorage.setItem('detectedLanguage', detectedLanguage);
        
        return;
      }
    } catch (err) {
      console.warn('ipapi.co falhou, tentando fallback:', err);
    }

    try {
      // Fallback: ip-api.com
      const fallbackResponse = await fetch(`http://ip-api.com/json/?t=${timestamp}`, {
        cache: 'no-cache'
      });
      
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        const detectedLanguage = getLanguageFromCountry(data.countryCode);
        
        setIpInfo({
          ip: data.query,
          country: data.country,
          country_code: data.countryCode,
          city: data.city,
          region: data.regionName,
          timezone: data.timezone,
          language: detectedLanguage
        });
        
        // Salvar no localStorage
        localStorage.setItem('lastIPDetection', timestamp.toString());
        localStorage.setItem('detectedIP', data.query);
        localStorage.setItem('detectedCountry', data.countryCode);
        localStorage.setItem('detectedLanguage', detectedLanguage);
        
        return;
      }
    } catch (err) {
      console.warn('ip-api.com também falhou:', err);
    }

    setError('Não foi possível detectar informações do IP');
  };

  useEffect(() => {
    detectIP();
  }, []);

  const getLanguageFromCountry = (countryCode: string): string => {
    const ptCountries = ['BR','PT','AO','MZ','CV','GW','ST','TL','MO'];
    const esCountries = ['ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','GQ','PR'];
    const enCountries = ['US','GB','CA','AU','NZ','IE','ZA','NG','KE','GH','UG','TZ','ZW','ZM','BW','LS','SZ','MW','JM','BB','TT','GY','BZ','AG','BS','DM','GD','KN','LC','VC','SG','MY','PH','IN','PK','BD','LK','MM','FJ','PG','SB','VU','TO','WS','KI','TV','NR','PW','FM','MH','CK','NU','TK','NF'];
    
    if (ptCountries.includes(countryCode)) return 'pt';
    if (esCountries.includes(countryCode)) return 'es';
    if (enCountries.includes(countryCode)) return 'en';
    return 'en'; // Default to English
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Debug de Detecção de IP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Detectando informações do IP...
          </div>
        )}

        {error && (
          <div className="text-red-500 bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        {ipInfo && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">IP</div>
                  <div className="text-xs text-muted-foreground">{ipInfo.ip}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">País</div>
                  <div className="text-xs text-muted-foreground">
                    {ipInfo.country} ({ipInfo.country_code})
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium">Cidade</div>
                <div className="text-xs text-muted-foreground">{ipInfo.city}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium">Região</div>
                <div className="text-xs text-muted-foreground">{ipInfo.region}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium">Timezone</div>
                <div className="text-xs text-muted-foreground">{ipInfo.timezone}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium">Idioma Detectado</div>
                <div className="text-xs text-muted-foreground">
                  {getLanguageFromCountry(ipInfo.country_code).toUpperCase()}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm font-medium mb-2">Mapeamento de País para Idioma:</div>
              <div className="text-xs text-muted-foreground">
                {ipInfo.country_code} → {getLanguageFromCountry(ipInfo.country_code).toUpperCase()}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={() => detectIP(false)} 
            disabled={loading}
            className="flex-1"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Detectar Novamente
          </Button>
          <Button 
            onClick={() => detectIP(true)} 
            disabled={loading}
            className="flex-1"
            variant="default"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Forçar Re-detecção
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground text-center mt-2">
          <p>💡 <strong>Dica:</strong> Use "Forçar Re-detecção" quando desligar o VPN</p>
          <p>O sistema detecta automaticamente mudanças quando você volta à página</p>
        </div>
      </CardContent>
    </Card>
  );
}
