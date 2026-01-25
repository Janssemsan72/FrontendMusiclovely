import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '@/contexts/LocaleContext';
import LocaleRouter from '@/components/LocaleRouter';

// Mock dos módulos
vi.mock('@/lib/languageAnalytics', () => ({
  default: {
    trackLanguageUsage: vi.fn(),
    trackAutoDetection: vi.fn(),
    trackManualChange: vi.fn(),
    trackUrlAccess: vi.fn(),
    trackCookieUsage: vi.fn(),
    getStats: vi.fn(() => ({
      totalEvents: 0,
      byLocale: {},
      bySource: {},
      recentEvents: []
    }))
  }
}));

vi.mock('@/lib/lazyTranslations', () => ({
  default: {
    load: vi.fn(() => Promise.resolve({
      hero: { title: 'Test Title' },
      navigation: { home: 'Home' }
    })),
    preload: vi.fn(),
    isLoaded: vi.fn(() => true),
    getStats: vi.fn(() => ({ loaded: [], loading: [] }))
  }
}));

vi.mock('@/lib/translationCache', () => ({
  default: {
    get: vi.fn(() => null),
    set: vi.fn(),
    has: vi.fn(() => false),
    clear: vi.fn(),
    getStats: vi.fn(() => ({ size: 0, maxSize: 5, entries: [] }))
  }
}));

vi.mock('@/lib/detectLocale', () => ({
  detectLocaleSimple: vi.fn(() => Promise.resolve('pt')),
  getCookieLocale: vi.fn(() => null),
  saveLocalePreference: vi.fn(),
  getLocaleFromPath: vi.fn((path) => {
    const segments = path.split('/').filter(Boolean);
    const firstSegment = segments[0];
    return firstSegment === 'pt' ? 'pt' : null;
  })
}));

vi.mock('@/lib/i18nRoutes', () => ({
  getCurrentLocale: vi.fn((path) => {
    const segments = path.split('/').filter(Boolean);
    const firstSegment = segments[0];
    return firstSegment === 'pt' ? 'pt' : null;
  }),
  getLocalizedPath: vi.fn((path, locale) => `/${locale}${path}`),
  removeLocalePrefix: vi.fn((path) => path.replace(/^\/(pt)/, '') || '/'),
  switchLocale: vi.fn((currentPath, newLocale) => `/${newLocale}${currentPath.replace(/^\/(pt)/, '')}`),
  hasLocalePrefix: vi.fn((path) => /^\/(pt)/.test(path)),
  getBasePath: vi.fn((path) => path.replace(/^\/(pt)/, ''))
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <LocaleProvider>
      {children}
    </LocaleProvider>
  </BrowserRouter>
);

describe('Força de Idioma por URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rotas /pt devem forçar idioma específico', () => {
    it('deve forçar português para /pt', async () => {
      window.history.pushState({}, '', '/pt');
      
      render(
        <TestWrapper>
          <LocaleRouter />
        </TestWrapper>
      );

      await waitFor(() => {
        // Verificar se o idioma foi forçado
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });

    
  });

  describe('Rotas com prefixo devem forçar idioma específico', () => {
    it('deve forçar português para /pt/about', async () => {
      window.history.pushState({}, '', '/pt/about');
      
      render(
        <TestWrapper>
          <LocaleRouter />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });

    
  });

  describe('Redirecionamentos automáticos', () => {
    it('deve redirecionar /pt para /', async () => {
      window.history.pushState({}, '', '/pt');
      
      render(
        <TestWrapper>
          <LocaleRouter />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/');
      });
    });
  });

  describe('Persistência do idioma forçado', () => {
    it('deve manter idioma forçado ao navegar entre rotas', async () => {
      // Primeiro acessar /pt
      window.history.pushState({}, '', '/pt');
      
      render(
        <TestWrapper>
          <LocaleRouter />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });

      // Depois navegar para /pt/about
      window.history.pushState({}, '', '/pt/about');
      
      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });
  });
});


