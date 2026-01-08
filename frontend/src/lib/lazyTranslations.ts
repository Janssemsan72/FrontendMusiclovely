import type { Locale } from './detectLocale';
import translationCache from './translationCache';
import { i18nLog, devLog } from '@/utils/debug/devLogger';

interface TranslationModule {
  default: Record<string, any>;
}

interface LazyTranslationLoader {
  load: (locale: Locale) => Promise<Record<string, any>>;
  preload: (locale: Locale) => Promise<void>;
  isLoaded: (locale: Locale) => boolean;
  getStats: () => { loaded: Locale[]; loading: Locale[] };
}

class LazyTranslationManager implements LazyTranslationLoader {
  private loadingPromises = new Map<Locale, Promise<Record<string, any>>>();
  private loadedLocales = new Set<Locale>();

  /**
   * Carrega traduções de forma lazy
   */
  async load(locale: Locale): Promise<Record<string, any>> {
    // Verificar cache primeiro
    const cached = translationCache.get(locale);
    if (cached) {
      this.loadedLocales.add(locale);
      return cached;
    }

    // Se já está carregando, aguardar a promise existente
    if (this.loadingPromises.has(locale)) {
      i18nLog('Aguardando carregamento existente para:', locale);
      return await this.loadingPromises.get(locale)!;
    }

    // Iniciar carregamento lazy
    const loadPromise = this.loadTranslations(locale);
    this.loadingPromises.set(locale, loadPromise);

    try {
      const translations = await loadPromise;
      this.loadedLocales.add(locale);
      this.loadingPromises.delete(locale);
      
      // Armazenar no cache
      translationCache.set(locale, translations);
      
      i18nLog('Traduções carregadas para:', locale);
      return translations;
    } catch (error) {
      this.loadingPromises.delete(locale);
      // Erro real: manter log, mas sem spam em produção
      devLog.error('[LazyTranslations] Erro ao carregar traduções', { locale, error });
      throw error;
    }
  }

  /**
   * Carrega traduções dinamicamente com retry logic
   */
  private async loadTranslations(locale: Locale, retryCount = 0): Promise<Record<string, any>> {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // 1 segundo
    
    i18nLog('Iniciando carregamento lazy para:', { locale, retryCount });

    try {
      // ✅ CORREÇÃO: Timeout de 10s para importações dinâmicas
      const loadWithTimeout = async (): Promise<TranslationModule> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout ao carregar traduções para ${locale} após 10s`));
          }, 10000);

          const importPromise = (async (): Promise<TranslationModule> => {
            switch (locale) {
              case 'pt':
                i18nLog('Carregando PT...');
                return await import('@/i18n/locales/pt.json');
              case 'en':
                i18nLog('Carregando EN...');
                return await import('@/i18n/locales/en.json');
              case 'es':
                i18nLog('Carregando ES...');
                return await import('@/i18n/locales/es.json');
              default:
                throw new Error(`Locale não suportado: ${locale}`);
            }
          })();

          importPromise
            .then((module) => {
              clearTimeout(timeoutId);
              resolve(module);
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        });
      };

      const module = await loadWithTimeout();
      const translations: Record<string, any> = (module as any).default ?? (module as any);
      
      i18nLog('Traduções carregadas', { locale, keys: Object.keys(translations) });
      
      // Validar se as traduções essenciais estão presentes
      if (!translations.pricing || !translations.pricing.whyChoose) {
        devLog.warn('[LazyTranslations] Tradução pricing.whyChoose não encontrada', { locale });
      }
      
      return translations;
    } catch (error) {
      devLog.error('[LazyTranslations] Erro na importação dinâmica', { locale, error });
      
      // ✅ CORREÇÃO: Retry logic para falhas de rede (especialmente mobile)
      if (retryCount < MAX_RETRIES && error instanceof Error && 
          (error.message.includes('Timeout') || error.message.includes('Failed to fetch') || error.message.includes('Network'))) {
        i18nLog('Tentando novamente', { locale, attempt: retryCount + 1, max: MAX_RETRIES });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return this.loadTranslations(locale, retryCount + 1);
      }
      
      throw new Error(`Falha ao carregar traduções para ${locale}: ${error}`);
    }
  }

  /**
   * Pré-carrega traduções em background
   */
  async preload(locale: Locale): Promise<void> {
    if (this.isLoaded(locale) || this.loadingPromises.has(locale)) {
      i18nLog('Traduções já carregadas ou carregando', { locale });
      return;
    }

    i18nLog('Pré-carregando traduções', { locale });
    
    // Carregar em background sem aguardar
    this.load(locale).catch(error => {
      devLog.warn('[LazyTranslations] Erro no pré-carregamento', { locale, error });
    });
  }

  /**
   * Verifica se um locale está carregado
   */
  isLoaded(locale: Locale): boolean {
    return this.loadedLocales.has(locale) || translationCache.has(locale);
  }

  /**
   * Obtém estatísticas de carregamento
   */
  getStats(): { loaded: Locale[]; loading: Locale[] } {
    return {
      loaded: Array.from(this.loadedLocales),
      loading: Array.from(this.loadingPromises.keys())
    };
  }

  /**
   * Pré-carrega todos os idiomas suportados
   */
  async preloadAll(): Promise<void> {
    const supportedLocales: Locale[] = ['pt', 'en', 'es'];
    
    i18nLog('Pré-carregando todos os idiomas...');
    
    const preloadPromises = supportedLocales.map(locale => 
      this.preload(locale).catch(error => 
        console.warn(`⚠️ [LazyTranslations] Erro ao pré-carregar ${locale}:`, error)
      )
    );

    await Promise.allSettled(preloadPromises);
    i18nLog('Pré-carregamento concluído');
  }

  /**
   * Limpa cache e estado
   */
  clear(): void {
    this.loadedLocales.clear();
    this.loadingPromises.clear();
    translationCache.clear();
    i18nLog('Estado limpo');
  }
}

// Instância singleton
export const lazyTranslations = new LazyTranslationManager();

export default lazyTranslations;
