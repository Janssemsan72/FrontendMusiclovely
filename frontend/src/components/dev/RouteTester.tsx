import React from 'react';
import { useLocation } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { getCurrentLocale, getLocalizedPath } from '@/lib/i18nRoutes';
import languageAnalytics from '@/lib/languageAnalytics';
import translationCache from '@/lib/translationCache';
import lazyTranslations from '@/lib/lazyTranslations';

export default function RouteTester() {
  const location = useLocation();
  const { locale, t, isLocaleForced } = useLocaleContext();
  const currentLocale = getCurrentLocale(location.pathname);

  const testRoutes = [
    '/',
    '/about',
    '/how-it-works',
    '/pricing',
    '/quiz',
    '/terms',
    '/privacy'
  ];

  return (
    <div className="p-6 bg-gray-100 rounded-lg m-4">
      <h2 className="text-xl font-bold mb-4">🌍 Route Tester - Sistema de Rotas Internacionalizadas</h2>
      
      <div className="mb-4">
        <p><strong>URL Atual:</strong> {location.pathname}</p>
        <p><strong>Locale da URL:</strong> {currentLocale || 'Nenhum (detecção automática)'}</p>
        <p><strong>Locale do Contexto:</strong> {locale}</p>
        <p><strong>Idioma Forçado:</strong> {isLocaleForced ? '✅ Sim' : '❌ Não'}</p>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2">Teste de Links Localizados:</h3>
        <div className="grid grid-cols-2 gap-2">
          {testRoutes.map(route => (
            <div key={route} className="p-2 bg-white rounded border">
              <div className="text-sm font-mono">{route}</div>
              <div className="text-xs text-gray-600">
                PT: <a href={getLocalizedPath(route, 'pt')} className="text-blue-600 hover:underline">
                  {getLocalizedPath(route, 'pt')}
                </a>
              </div>
              <div className="text-xs text-gray-600">
                EN: <a href={getLocalizedPath(route, 'en')} className="text-blue-600 hover:underline">
                  {getLocalizedPath(route, 'en')}
                </a>
              </div>
              <div className="text-xs text-gray-600">
                ES: <a href={getLocalizedPath(route, 'es')} className="text-blue-600 hover:underline">
                  {getLocalizedPath(route, 'es')}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2">Teste de Tradução:</h3>
        <p><strong>Hero Title:</strong> {t('hero.title')}</p>
        <p><strong>Navigation Home:</strong> {t('navigation.home')}</p>
        <p><strong>Navigation About:</strong> {t('navigation.about')}</p>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2">📊 Estatísticas de Performance:</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p><strong>Analytics:</strong> {languageAnalytics.getStats().totalEvents} eventos</p>
            <p><strong>Cache:</strong> {translationCache.getStats().size} entradas</p>
          </div>
          <div>
            <p><strong>Carregados:</strong> {lazyTranslations.getStats().loaded.length} idiomas</p>
            <p><strong>Carregando:</strong> {lazyTranslations.getStats().loading.length} idiomas</p>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>✅ Sistema implementado com sucesso!</p>
        <p>• Rotas com prefixo: /pt/*, /en/*, /es/*</p>
        <p>• Rota raiz com detecção automática: /</p>
        <p>• Admin sem prefixo: /admin/*</p>
        <p>• Troca de idioma atualiza URL</p>
        <p>• Links localizados funcionando</p>
        <p>• Cache de traduções ativo</p>
        <p>• Lazy loading implementado</p>
        <p>• Analytics funcionando</p>
        <p>• Testes automatizados criados</p>
      </div>
    </div>
  );
}
