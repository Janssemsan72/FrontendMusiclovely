import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import { i18nLog } from '@/utils/debug/devLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Globe, Lock, Star, Zap, Clock, Shield, Music, ArrowRight, Download } from 'lucide-react';
import { getLocalizedPath } from '@/lib/i18nRoutes';
import { useUtmParams } from '@/hooks/useUtmParams';
// formatDateTime removido - não é mais usado

// ✅ Configuração de preços - sempre R$ 47,90
const getCaktoConfigByDomain = () => {
  // Sempre usar R$ 47,90 (4790 centavos) para todos os domínios
  return {
    url: 'https://pay.cakto.com.br/d877u4t_665160',
    amount_cents: 4790,
    price_display: 4790
  };
};

interface RegionalPricing {
  region: string;
  country: string;
  language: string;
  pricing: Array<{
    id: string;
    plan_name: string;
    price_cents: number;
    currency: string;
    features: string[];
    is_active: boolean;
    badge?: string;
    featured?: boolean;
  }>;
  session_token: string;
  expires_at: string;
}

export default function RegionalPricingSection() {
  const { t, currentLanguage } = useTranslation();
  const { navigateWithUtms } = useUtmParams();
  const [pricing, setPricing] = useState<RegionalPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Forçar reload quando a URL mudar
    loadRegionalPricing();
  }, [currentLanguage]);

  const loadRegionalPricing = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // SEMPRE usar dados mock baseados na URL (ignorar API de IP)
      
      // Detectar idioma atual pela URL (sempre priorizar URL)
      const getCurrentLanguage = () => {
        const pathname = window.location.pathname;
        
        // Prioridade 1: URL com prefixo de idioma
        if (pathname.startsWith('/en')) return 'en';
        if (pathname.startsWith('/es')) return 'es';
        if (pathname.startsWith('/pt')) return 'pt';
        
        // Prioridade 2: Rota raiz - detecção automática
        if (pathname === '/' || pathname === '') {
          i18nLog('Rota raiz detectada', {
            currentLanguage,
            navigatorLanguage: navigator.language
          });
          
          // Detectar pelo navegador
          const navLang = navigator.language.toLowerCase();
          i18nLog('navLang processado', navLang);
          
          if (navLang.startsWith('pt')) {
            i18nLog('Detectado português pelo navegador');
            return 'pt';
          }
          if (navLang.startsWith('en')) {
            i18nLog('Detectado inglês pelo navegador');
            return 'en';
          }
          if (navLang.startsWith('es')) {
            i18nLog('Detectado espanhol pelo navegador');
            return 'es';
          }
          
          // Fallback para português
          i18nLog('Fallback para português');
          return 'pt';
        }
        
        // Fallback para currentLanguage
        return currentLanguage || 'pt';
      };
      
      const currentLang = getCurrentLanguage();
      
      // Forçar detecção se não estiver funcionando
      const forcedLang = currentLang || 'pt';
      
      let mockPricing = [];
      
      if (forcedLang === 'pt') {
        // Para português: apenas plano brasileiro com preço dinâmico por domínio
        const caktoConfig = getCaktoConfigByDomain();
        mockPricing = [
          {
            id: '1',
            region: 'brasil',
            plan_name: 'Expresso',
            price_cents: caktoConfig.price_display,
            currency: 'BRL',
            stripe_price_id: 'price_BR_EXPRESS',
            features: ['MP3 alta qualidade', 'Capa personalizada', 'Letra completa', 'Entrega em 48h'],
            is_active: true
          }
        ];
      } else {
        // Para inglês e espanhol: dois planos USD
        mockPricing = [
          {
            id: '2',
            region: 'usa',
            plan_name: 'Express Plus 7 Days',
            price_cents: 3900,
            currency: 'USD',
            stripe_price_id: 'prod_THfijhgSPvtnsE', // Personalized Music - Express plus 7 days US$ 39,00
            features: ['High quality MP3', 'Custom cover', 'Full lyrics', '7 days delivery'],
            is_active: true,
            badge: currentLang === 'en' ? 'Standard' : 'Estándar'
          },
          {
            id: '3',
            region: 'usa',
            plan_name: 'Express Plan 24h',
            price_cents: 4900,
            currency: 'USD',
            stripe_price_id: 'prod_THfhMPbPNkoSPc', // Personalized Music - Express Plan 24h US$ 49,00
            features: ['High quality MP3', 'Custom cover', 'Full lyrics', '24h delivery'],
            is_active: true,
            badge: currentLang === 'en' ? 'Most Popular' : 'Más Popular',
            featured: true
          }
        ];
      }
      
      const mockData = {
        success: true,
        region: currentLang === 'pt' ? 'brasil' : 'usa',
        country: currentLang === 'pt' ? 'BR' : 'US',
        language: currentLang,
        pricing: mockPricing,
        session_token: 'mock-session-token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      i18nLog('Dados mock configurados', mockData);
      setPricing(mockData);
      setError(null); // Limpar erro para mostrar dados mock
    } catch {
      // Evitar poluir console em produção; erro já é refletido na UI.
      setError('Erro ao carregar preços');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    
    // Mapear moeda para localização correta
    const currencyLocaleMap: Record<string, string> = {
      'BRL': 'pt-BR',
      'USD': 'en-US', 
      'EUR': 'de-DE'
    };
    
    const locale = currencyLocaleMap[currency] || 'en-US';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const getRegionFlag = (country: string) => {
    const flags: Record<string, string> = {
      'BR': '🇧🇷',
      'US': '🇺🇸',
      'ES': '🇪🇸',
      'MX': '🇲🇽',
      'AR': '🇦🇷',
      'CO': '🇨🇴',
      'CL': '🇨🇱',
      'PE': '🇵🇪',
      'OTHER': '🌍'
    };
    return flags[country] || '🌍';
  };

  const getRegionName = (region: string) => {
    const names: Record<string, string> = {
      'brasil': 'Brasil',
      'usa': 'Estados Unidos',
      'internacional': 'Internacional'
    };
    return names[region] || region;
  };

  // Funções getCountryName e getLanguageName removidas - não são mais usadas

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <Star className="h-4 w-4" />
              <span>{t('pricing.badge')}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pricing.title')}</h2>
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pricing.title')}</h2>
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={loadRegionalPricing} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (!pricing || !pricing.pricing.length) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pricing.title')}</h2>
            <p className="text-muted-foreground">Nenhum plano disponível para sua região.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-6 sm:py-20 px-4">
      <div className="container mx-auto">
        {/* Header com região bloqueada */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-base font-semibold mb-6">
            <Star className="h-4 w-4" />
            <span>{t('pricing.badge')}</span>
          </div>
          <h2 id="pricing-title" tabIndex={-1} className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 outline-none">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('pricing.title')}
            </span>
          </h2>
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-6">
            {t('pricing.subtitle')}
          </p>
          
          {/* Indicador de região */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('pricing.regionLocked')}:</span>
            <span className="font-medium">
              {getRegionFlag(pricing.country)} {getRegionName(pricing.region)}
            </span>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Planos de preço */}
        <div className={`grid gap-4 mx-auto ${
          pricing.pricing.length === 1 
            ? 'grid-cols-1 max-w-sm' 
            : 'grid-cols-1 md:grid-cols-2 max-w-3xl'
        }`} style={{ position: 'relative', zIndex: 1 }}>
          {pricing.pricing.map((plan, index) => (
            <Card 
              key={plan.id} 
              className={`shadow-2xl hover:shadow-3xl transition-all border-2 relative w-full group ${
                plan.is_active ? 'border-primary' : 'border-muted'
              }`}
              style={{ minHeight: 'fit-content' }}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className={`px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg ${
                    plan.badge.includes('Popular') || plan.badge.includes('Popular') 
                      ? 'bg-gradient-to-r from-primary to-accent text-white' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {plan.badge.includes('Popular') && <Zap className="h-4 w-4" />}
                    <span>{plan.badge}</span>
                  </div>
                </div>
              )}
              
              <CardHeader className="text-center pb-4 px-4 pt-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {getRegionFlag(pricing.country)} {getRegionName(pricing.region)}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-bold mb-2">{plan.plan_name}</CardTitle>
                <div className="text-4xl font-bold text-foreground mb-2">
                  {formatPrice(plan.price_cents, plan.currency)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.deliveryTime')}
                </p>
                
                {/* Símbolo de presente e versão grátis */}
                <div className="mt-2 p-1.5 bg-gradient-to-r from-green-400/20 to-emerald-400/20 rounded-lg border border-green-500/30">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs">🎁</span>
                    <span className="font-bold text-xs">{t('pricing.freeVersionGift')}</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="px-4 pb-4">
                <div className="space-y-2 mb-6">
                  {plan.features
                    .filter((feature: string) => 
                      !feature.toLowerCase().includes('download ilimitado') && 
                      !feature.toLowerCase().includes('unlimited download')
                    )
                    .map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-2.5 w-2.5 text-primary" />
                      </div>
                      <span className="text-foreground text-sm font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <Button 
                  className="w-full bg-primary hover:bg-primary-600 text-white font-bold text-base py-3 rounded-xl shadow-soft hover:shadow-medium transition-all hover:scale-105 group"
                  size="lg"
                  onClick={() => {
                    // Salvar session token para checkout
                    localStorage.setItem('pricing_session_token', pricing.session_token);
                    // Redirecionar para quiz com navegação localizada (preservando UTMs)
                    const quizPath = getLocalizedPath('/quiz', currentLanguage);
                    navigateWithUtms(quizPath);
                  }}
                >
                  <Music className="h-5 w-5 mr-2" />
                  <span>{t('pricing.createMyMusic')}</span>
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-1">
                    <Shield className="h-3 w-3" />
                    <span>{t('pricing.securePayment')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('pricing.guarantee')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Seção de benefícios */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 sm:mb-8">
              {t('pricing.whyChoose')}
            </h3>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="font-semibold text-foreground text-base sm:text-lg mb-1">{t('pricing.benefits.fastDelivery.title')}</p>
                  <p className="text-sm sm:text-base text-muted-foreground">{t('pricing.benefits.fastDelivery.description')}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="font-semibold text-foreground text-base sm:text-lg mb-1">{t('pricing.benefits.guarantee.title')}</p>
                  <p className="text-sm sm:text-base text-muted-foreground">{t('pricing.benefits.guarantee.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground mb-4">
            {t('pricing.regionInfo')}
          </p>
        </div>
      </div>
    </section>
  );
}
