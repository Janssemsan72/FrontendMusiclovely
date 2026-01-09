import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Globe, MapPin, Trash2, CheckCircle } from 'lucide-react';
import { detectLocaleAtEdge } from '@/lib/edgeLocale';

type Country = 'BR' | 'US' | 'ES' | 'MX' | 'AR' | 'CO' | 'PE' | 'CL' | 'UY' | 'PY' | 'BO' | 'VE' | 'EC' | 'GY' | 'SR' | 'GF' | 'FK';
type Language = 'pt' | 'en' | 'es';

interface CountryInfo {
  code: Country;
  name: string;
  flag: string;
  language: Language;
}

const COUNTRIES: CountryInfo[] = [
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', language: 'pt' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', language: 'en' },
  { code: 'ES', name: 'Espanha', flag: '🇪🇸', language: 'es' },
  { code: 'MX', name: 'México', flag: '🇲🇽', language: 'es' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', language: 'es' },
  { code: 'CO', name: 'Colômbia', flag: '🇨🇴', language: 'es' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', language: 'es' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', language: 'es' },
  { code: 'UY', name: 'Uruguai', flag: '🇺🇾', language: 'es' },
  { code: 'PY', name: 'Paraguai', flag: '🇵🇾', language: 'es' },
  { code: 'BO', name: 'Bolívia', flag: '🇧🇴', language: 'es' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', language: 'es' },
  { code: 'EC', name: 'Equador', flag: '🇪🇨', language: 'es' },
  { code: 'GY', name: 'Guiana', flag: '🇬🇾', language: 'en' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', language: 'en' },
  { code: 'GF', name: 'Guiana Francesa', flag: '🇬🇫', language: 'en' },
  { code: 'FK', name: 'Ilhas Malvinas', flag: '🇫🇰', language: 'en' }
];

export default function CountryDetectionOverride() {
  const [currentCountry, setCurrentCountry] = useState<Country | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastDetection, setLastDetection] = useState<string>('');
  const [overrideActive, setOverrideActive] = useState(false);

  useEffect(() => {
    loadCurrentState();
  }, []);

  const loadCurrentState = () => {
    const savedCountry = localStorage.getItem('detectedCountry') as Country;
    const savedLanguage = localStorage.getItem('detectedLanguage') as Language;
    const lastDetect = localStorage.getItem('lastDetection');
    const override = localStorage.getItem('countryOverride') === 'true';

    if (savedCountry) setCurrentCountry(savedCountry);
    if (savedLanguage) setCurrentLanguage(savedLanguage);
    if (lastDetect) setLastDetection(new Date(parseInt(lastDetect)).toLocaleString());
    setOverrideActive(override);
  };

  const detectRealCountry = async () => {
    setIsDetecting(true);
    
    try {
      // Limpar cache completamente
      localStorage.removeItem('detectedCountry');
      localStorage.removeItem('detectedLanguage');
      localStorage.removeItem('lastDetection');
      localStorage.removeItem('countryOverride');

      // Detecção via Edge Function unificada
      const edge = await detectLocaleAtEdge();
      if (edge && (edge.country || edge.language)) {
        const countryCode = (edge.country as Country) || null;
        const detectedLanguage = (edge.language as Language) || 'en';

        if (countryCode) setCurrentCountry(countryCode);
        setCurrentLanguage(detectedLanguage);
        setLastDetection(new Date().toLocaleString());
        setOverrideActive(false);

        if (countryCode) localStorage.setItem('detectedCountry', countryCode);
        localStorage.setItem('detectedLanguage', detectedLanguage);
        localStorage.setItem('lastDetection', Date.now().toString());
        localStorage.removeItem('countryOverride');

        console.log('🌍 Nova detecção (edge):', countryCode, '→', detectedLanguage);
        return;
      }
      
      throw new Error('Edge Function não retornou dados válidos');
    } catch (error) {
      console.error('Erro na detecção:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const overrideCountry = (country: Country) => {
    const countryInfo = COUNTRIES.find(c => c.code === country);
    if (!countryInfo) return;

    setCurrentCountry(country);
    setCurrentLanguage(countryInfo.language);
    setLastDetection(new Date().toLocaleString());
    setOverrideActive(true);

    // Salvar override
    localStorage.setItem('detectedCountry', country);
    localStorage.setItem('detectedLanguage', countryInfo.language);
    localStorage.setItem('lastDetection', Date.now().toString());
    localStorage.setItem('countryOverride', 'true');

    console.log('🎯 Override ativo:', country, '→', countryInfo.language);
  };

  const clearAllCache = () => {
    // Limpar todo o cache de detecção
    localStorage.removeItem('detectedCountry');
    localStorage.removeItem('detectedLanguage');
    localStorage.removeItem('lastDetection');
    localStorage.removeItem('countryOverride');
    localStorage.removeItem('lastIPDetection');
    localStorage.removeItem('detectedIP');
    
    setCurrentCountry(null);
    setCurrentLanguage('en');
    setLastDetection('');
    setOverrideActive(false);
    
    console.log('🗑️ Cache limpo completamente');
  };

  const getLanguageFromCountry = (country: string): Language => {
    const countryMap: Record<string, Language> = {
      'BR': 'pt',
      'US': 'en',
      'ES': 'es',
      'MX': 'es',
      'AR': 'es',
      'CO': 'es',
      'PE': 'es',
      'CL': 'es',
      'UY': 'es',
      'PY': 'es',
      'BO': 'es',
      'VE': 'es',
      'EC': 'es',
      'GY': 'en',
      'SR': 'en',
      'GF': 'en',
      'FK': 'en'
    };
    
    return countryMap[country] || 'en';
  };

  const getCurrentCountryInfo = () => {
    return COUNTRIES.find(c => c.code === currentCountry);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Controle de Detecção de País/Idioma
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Atual */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Status Atual</h3>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" />
            <span>País:</span>
            {currentCountry ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                {getCurrentCountryInfo()?.flag} {getCurrentCountryInfo()?.name}
              </Badge>
            ) : (
              <Badge variant="outline">Não detectado</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4" />
            <span>Idioma:</span>
            <Badge variant={currentLanguage === 'pt' ? 'default' : currentLanguage === 'es' ? 'secondary' : 'outline'}>
              {currentLanguage.toUpperCase()}
            </Badge>
          </div>
          {lastDetection && (
            <div className="text-sm text-gray-600">
              Última detecção: {lastDetection}
            </div>
          )}
          {overrideActive && (
            <Badge variant="destructive" className="mt-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              Override Ativo
            </Badge>
          )}
        </div>

        {/* Detecção Real */}
        <div className="space-y-2">
          <h3 className="font-semibold">Detecção Real (via IP)</h3>
          <Button 
            onClick={detectRealCountry} 
            disabled={isDetecting}
            className="w-full"
            variant="outline"
          >
            {isDetecting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Detectando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Detectar País Real (Forçar Nova Detecção)
              </>
            )}
          </Button>
        </div>

        {/* Override Manual */}
        <div className="space-y-2">
          <h3 className="font-semibold">Override Manual (Para Testes)</h3>
          <Select onValueChange={(value) => overrideCountry(value as Country)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar país para simular" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <div className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span>{country.name}</span>
                    <Badge variant="outline" className="ml-auto">
                      {country.language.toUpperCase()}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Limpar Cache */}
        <div className="space-y-2">
          <h3 className="font-semibold">Limpeza de Cache</h3>
          <Button 
            onClick={clearAllCache} 
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Todo o Cache
          </Button>
        </div>

        {/* Instruções */}
        <div className="p-3 bg-blue-50 rounded-lg text-sm">
          <h4 className="font-semibold text-blue-800 mb-1">Como usar:</h4>
          <ul className="text-blue-700 space-y-1">
            <li>• <strong>Detectar País Real:</strong> Força nova detecção via IP (ignora cache)</li>
            <li>• <strong>Override Manual:</strong> Simula um país específico para testes</li>
            <li>• <strong>Limpar Cache:</strong> Remove todas as detecções salvas</li>
            <li>• Use VPN + "Detectar País Real" para testar diferentes localizações</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
