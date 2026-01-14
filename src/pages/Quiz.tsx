import React, { useState, useEffect, memo, useCallback, useMemo, useRef, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
// ✅ OTIMIZAÇÃO FASE 2.2: Lazy load de componentes UI pesados apenas quando necessário
// ✅ CORREÇÃO BUG 4: Named exports precisam ser transformados corretamente
// Helper para logs condicionais (apenas em desenvolvimento)
const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};
const devWarn = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};
const devError = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

const Textarea = lazyWithRetry(() => 
  import('@/components/ui/textarea').then(module => ({ default: module.Textarea }))
);
const Progress = lazyWithRetry(() => 
  import('@/components/ui/progress').then(module => ({ default: module.Progress }))
);
import { ArrowLeft, ArrowRight, Loader2 } from '@/utils/iconImports';
import { toast } from 'sonner';
import { z } from 'zod';
import { useDebounce } from '@/hooks/use-debounce';
import { useTranslation } from '@/hooks/useTranslation';
import { useUtmParams } from '@/hooks/useUtmParams';
import { useUtmifyTracking } from '@/hooks/useUtmifyTracking';
import { validateQuiz, sanitizeQuiz, formatValidationErrors, type QuizData } from '@/utils/quizValidation';
import { saveQuizToStorage, loadQuizFromStorage, getOrCreateQuizSessionId } from '@/utils/quizSync';
import { insertQuizWithRetry, type QuizPayload } from '@/utils/quizInsert';
import { enqueueQuizToServer } from '@/utils/quizInsert';
import { useQuizValidation } from '@/hooks/useQuizValidation';
import QuizProgress from './QuizSteps/QuizProgress';
import QuizNavigation from './QuizSteps/QuizNavigation';
import QuizStep1 from './QuizSteps/QuizStep1';
import QuizStep2 from './QuizSteps/QuizStep2';
import QuizStep3 from './QuizSteps/QuizStep3';
import QuizStep4 from './QuizSteps/QuizStep4';
import QuizStep5 from './QuizSteps/QuizStep5';

// These will be replaced with translated versions in the component

const Quiz = memo(() => {
  
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Preservar UTMs através do funil
  const { navigateWithUtms, utms } = useUtmParams();
  const { trackEvent } = useUtmifyTracking();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const hasShownDataLoadedRef = useRef(false);
  const isSubmittingRef = useRef(false); // ✅ Proteção contra cliques duplicados
  const isMountedRef = useRef(true); // ✅ Verificação de montagem para prevenir erros de DOM
  const dataLoadedRef = useRef(false); // ✅ Flag para indicar que dados foram carregados
  const [formData, setFormData] = useState({
    relationship: '',
    customRelationship: '',
    aboutWho: '',
    style: '',
    vocalGender: '',
    qualities: '',
    memories: '',
    message: ''
  });

  // Translated constants - Opções separadas por gênero
  const RELATIONSHIPS = [
    t('quiz.relationships.spouse_male'),
    t('quiz.relationships.spouse_female'),
    t('quiz.relationships.child_male'),
    t('quiz.relationships.child_female'),
    t('quiz.relationships.father'),
    t('quiz.relationships.mother'),
    t('quiz.relationships.sibling_male'),
    t('quiz.relationships.sibling_female'),
    t('quiz.relationships.friend_male'),
    t('quiz.relationships.friend_female'),
    t('quiz.relationships.myself_male'),
    t('quiz.relationships.myself_female'),
    t('quiz.relationships.other')
  ] as const;

  const STYLES = [
    t('quiz.styles.pop'),
    t('quiz.styles.rock'),
    t('quiz.styles.mpb'),
    t('quiz.styles.sertanejo'),
    t('quiz.styles.forro'),
    t('quiz.styles.jazz'),
    t('quiz.styles.gospel'),
    t('quiz.styles.reggae'),
    t('quiz.styles.electronic'),
    t('quiz.styles.rap')
  ] as const;

  const VOCAL_OPTIONS = [
    { value: '', label: t('quiz.vocalOptions.noPreference') },
    { value: 'f', label: t('quiz.vocalOptions.female') },
    { value: 'm', label: t('quiz.vocalOptions.male') }
  ] as const;

  const totalSteps = 5;
  const progress = useMemo(() => (step / totalSteps) * 100, [step]);

  const [searchParams] = useSearchParams();

  // ✅ OTIMIZAÇÃO: Preload agressivo do Checkout quando usuário está no Quiz
  // Preload quando chega no step 2 ou mais (mais cedo para garantir que está pronto)
  useEffect(() => {
    // Preload Checkout quando usuário está no step 2 ou mais
    if (step >= 2) {
      // Preload imediato e agressivo (sem esperar requestIdleCallback)
      import('../pages/Checkout').catch(() => {});
      
      // Preload de recursos críticos do Checkout imediatamente
      Promise.all([
        import('@/components/ui/button').catch(() => {}),
        import('@/components/ui/card').catch(() => {}),
        import('@/components/ui/input').catch(() => {}),
        import('@/components/ui/badge').catch(() => {}),
        import('lucide-react').catch(() => {}),
      ]).catch(() => {});
    }
    
    // Preload ainda mais agressivo quando está no último step
    if (step >= 4) {
      // Preload de tudo novamente para garantir que está em cache
      import('../pages/Checkout').catch(() => {});
    }
  }, [step]);
  
  // ✅ OTIMIZAÇÃO: Preload quando usuário começa a preencher o último step
  useEffect(() => {
    if (step >= 4 && formData.message) {
      // Usuário está preenchendo a última pergunta - preload imediato
      import('../pages/Checkout').catch(() => {});
    }
  }, [step, formData.message]);

  // ✅ Cleanup: Marcar componente como desmontado
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ OTIMIZAÇÃO FASE 2.1: Deferir carregamento de dados do quiz para não bloquear renderização inicial
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    let cancelled = false;
    const loadQuizData = () => {
      if (cancelled) return;
      
      // ✅ CORREÇÃO: Evitar recarregar se dados já foram carregados
      if (dataLoadedRef.current) {
        return;
      }
      
      // PRIORIDADE 1: Verificar se há parâmetros de edição na URL
      const orderId = searchParams.get('order_id');
      const quizId = searchParams.get('quiz_id');
      const token = searchParams.get('token');
      const edit = searchParams.get('edit');

      if (edit === 'true' && orderId && quizId) {
      devLog('📥 [Quiz] Carregando quiz para edição via URL:', { orderId, quizId, token, edit });
      
      const loadQuizFromDatabase = async () => {
        try {
          // ✅ Verificar montagem antes de atualizar estado
          if (!isMountedRef.current) return;
          setLoading(true);
          
          // Tentar validar token se fornecido (opcional - não bloquear se token falhar)
          if (token) {
            devLog('🔍 [Quiz] Validando token...');
            const { data: linkData, error: linkError } = await supabase
              .from('checkout_links')
              .select('*')
              .eq('order_id', orderId)
              .eq('quiz_id', quizId)
              .eq('token', token)
              .gt('expires_at', new Date().toISOString())
              .is('used_at', null)
              .single();

            if (linkError || !linkData) {
              devWarn('⚠️ [Quiz] Token inválido ou expirado, mas continuando com carregamento:', {
                error: linkError?.message,
                code: linkError?.code,
                details: linkError?.details
              });
            } else {
              devLog('✅ [Quiz] Token válido');
            }
          } else {
            devWarn('⚠️ [Quiz] Token não fornecido na URL, continuando mesmo assim');
          }

          // Buscar quiz do banco (mesmo se token falhar, pois temos order_id e quiz_id válidos)
          devLog('🔍 [Quiz] Buscando quiz no banco:', { quizId });
          
          // Tentar primeiro via RPC (ignora RLS), depois via query normal
          let quizData = null;
          let quizError = null;
          
          try {
            devLog('🔍 [Quiz] Tentando buscar quiz via RPC...');
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_quiz_by_id', { quiz_id_param: quizId });
            
            // Verificar se função RPC não existe (erro específico)
            if (rpcError) {
              devWarn('⚠️ [Quiz] Erro ao chamar RPC:', {
                message: rpcError.message,
                code: rpcError.code,
                details: rpcError.details
              });
              
              // Se função não existe (42883 = function does not exist), tentar query normal imediatamente
              if (rpcError.code === '42883' || rpcError.message?.includes('does not exist')) {
                devLog('⚠️ [Quiz] Função RPC não existe, tentando query normal imediatamente...');
                const { data: queryData, error: queryError } = await supabase
                  .from('quizzes')
                  .select('*')
                  .eq('id', quizId)
                  .single();
                
                quizData = queryData;
                quizError = queryError;
              } else {
                // Outro erro, tentar query normal como fallback
                devLog('⚠️ [Quiz] Erro na RPC, tentando query normal como fallback...');
                const { data: queryData, error: queryError } = await supabase
                  .from('quizzes')
                  .select('*')
                  .eq('id', quizId)
                  .single();
                
                quizData = queryData;
                quizError = queryError;
              }
            } else if (rpcData && rpcData.length > 0) {
              quizData = rpcData[0];
              devLog('✅ [Quiz] Quiz encontrado via RPC');
            } else {
              // RPC retornou vazio, tentar query normal
              devLog('⚠️ [Quiz] RPC retornou vazio, tentando query normal...');
              const { data: queryData, error: queryError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();
              
              quizData = queryData;
              quizError = queryError;
            }
          } catch (error) {
            devError('❌ [Quiz] Erro ao buscar quiz:', error);
            quizError = error;
          }

          if (quizError) {
            devError('❌ [Quiz] Erro ao buscar quiz:', {
              error: quizError.message,
              code: quizError.code,
              details: quizError.details,
              hint: quizError.hint,
              quizId
            });
            if (isMountedRef.current) {
              toast.error(`Erro ao carregar quiz: ${quizError.message || 'Quiz não encontrado'}`);
              setLoading(false);
            }
            return;
          }

          if (!quizData) {
            devError('❌ [Quiz] Quiz não encontrado no banco:', { quizId });
            if (isMountedRef.current) {
              toast.error('Quiz não encontrado');
              setLoading(false);
            }
            return;
          }

          devLog('✅ [Quiz] Quiz encontrado:', {
            quizId: quizData.id,
            about_who: quizData.about_who,
            style: quizData.style
          });
          
          // Verificar se o quiz pertence ao pedido (segurança adicional)
          devLog('🔍 [Quiz] Verificando se quiz pertence ao pedido:', { orderId });
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('quiz_id, status, customer_email')
            .eq('id', orderId)
            .single();
          
          if (orderError) {
            devError('❌ [Quiz] Erro ao buscar pedido:', {
              error: orderError.message,
              code: orderError.code,
              details: orderError.details,
              orderId
            });
            if (isMountedRef.current) {
              toast.error(`Erro ao verificar pedido: ${orderError.message || 'Pedido não encontrado'}`);
              setLoading(false);
            }
            return;
          }

          if (!orderData) {
            devError('❌ [Quiz] Pedido não encontrado:', { orderId });
            if (isMountedRef.current) {
              toast.error('Pedido não encontrado');
              setLoading(false);
            }
            return;
          }

          if (orderData.quiz_id !== quizId) {
            devError('❌ [Quiz] Quiz não pertence ao pedido:', {
              order_quiz_id: orderData.quiz_id,
              provided_quiz_id: quizId
            });
            if (isMountedRef.current) {
              toast.error('Quiz não corresponde ao pedido');
              setLoading(false);
            }
            return;
          }

          devLog('✅ [Quiz] Quiz pertence ao pedido, continuando...');

          // Parse relationship (handle "Outro: xxx" format)
          let relationship = quizData.relationship || '';
          let customRelationship = '';
          
          if (relationship && relationship.startsWith('Outro: ')) {
            customRelationship = relationship.replace('Outro: ', '');
            relationship = 'Outro';
          }
          
          // ✅ Verificar montagem antes de atualizar estado
          if (!isMountedRef.current) return;
          
          // ✅ CORREÇÃO: Resetar loading ANTES de carregar dados para garantir que campos estejam editáveis
          setLoading(false);
          
          // Populate form with existing data usando função funcional para garantir atualização
          if (!dataLoadedRef.current) {
            setFormData(prev => ({
              ...prev,
              relationship,
              customRelationship,
              aboutWho: quizData.about_who || '',
              style: quizData.style || '',
              vocalGender: quizData.vocal_gender || '',
              qualities: quizData.qualities || '',
              memories: quizData.memories || '',
              message: quizData.message || ''
            }));
            dataLoadedRef.current = true; // ✅ Marcar que dados foram carregados
          }
          
          // Salvar order_id e quiz_id para atualização posterior
          localStorage.setItem('editing_order_id', orderId);
          localStorage.setItem('editing_quiz_id', quizId);
          localStorage.setItem('editing_token', token || '');
          
          devLog('✅ [Quiz] Quiz carregado com sucesso, dados salvos no localStorage');
          if (isMountedRef.current) {
            toast.success('Quiz carregado para edição');
          }
        } catch (error) {
          devError('❌ [Quiz] Erro ao carregar quiz:', error);
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          devError('❌ [Quiz] Detalhes do erro:', {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            error
          });
          if (isMountedRef.current) {
            toast.error(`Erro ao carregar quiz: ${errorMessage}`);
            setLoading(false);
          }
        } finally {
          if (isMountedRef.current) {
            setLoading(false);
          }
        }
      };

        loadQuizFromDatabase();
        return;
      }

      // PRIORIDADE 2: Carregar do localStorage usando utilitário
      // ✅ CORREÇÃO: Evitar recarregar se dados já foram carregados
      if (dataLoadedRef.current) {
        return;
      }
      
      const loadedQuiz = loadQuizFromStorage();
    
    if (loadedQuiz) {
      try {
        // ✅ CORREÇÃO: Resetar loading ANTES de carregar dados para garantir que campos estejam editáveis
        if (isMountedRef.current) {
          setLoading(false);
        }
        
        // Parse relationship (handle "Outro: xxx" format)
        let relationship = loadedQuiz.relationship || '';
        let customRelationship = '';
        
        if (relationship && relationship.startsWith('Outro: ')) {
          customRelationship = relationship.replace('Outro: ', '');
          relationship = t('quiz.relationships.other');
        }
        
        // ✅ Mapear valores antigos para novos (compatibilidade retroativa)
        const relationshipMapping: Record<string, string> = {
          'Esposo(a)': t('quiz.relationships.spouse_male'),
          'Esposa': t('quiz.relationships.spouse_female'),
          'Filho(a)': t('quiz.relationships.child_male'),
          'Filho': t('quiz.relationships.child_male'),
          'Filha': t('quiz.relationships.child_female'),
          'Irmão(ã)': t('quiz.relationships.sibling_male'),
          'Irmão': t('quiz.relationships.sibling_male'),
          'Irmã': t('quiz.relationships.sibling_female'),
          'Amigo(a)': t('quiz.relationships.friend_male'),
          'Amigo': t('quiz.relationships.friend_male'),
          'Amiga': t('quiz.relationships.friend_female'),
          'Eu mesmo(a)': t('quiz.relationships.myself_male'),
          'Eu mesmo': t('quiz.relationships.myself_male'),
          'Eu mesma': t('quiz.relationships.myself_female'),
        };
        
        // Se o relacionamento está no mapeamento, usar o valor mapeado
        if (relationship && relationshipMapping[relationship]) {
          relationship = relationshipMapping[relationship];
        }
        
        // Populate form with existing data usando função funcional para garantir atualização
        if (isMountedRef.current && !dataLoadedRef.current) {
          setFormData(prev => ({
            ...prev,
            relationship,
            customRelationship,
            aboutWho: loadedQuiz.about_who || '',
            style: loadedQuiz.style || '',
            vocalGender: loadedQuiz.vocal_gender || '',
            qualities: loadedQuiz.qualities || '',
            memories: loadedQuiz.memories || '',
            message: loadedQuiz.message || ''
          }));
          dataLoadedRef.current = true; // ✅ Marcar que dados foram carregados
        }
        
        // Mostrar notificação apenas uma vez
        if (!hasShownDataLoadedRef.current && isMountedRef.current) {
          toast.info(t('quiz.messages.dataLoaded'));
          hasShownDataLoadedRef.current = true;
        }
      } catch (error) {
        devError('Error loading existing quiz data:', error);
        // ✅ CORREÇÃO: Resetar loading mesmo em caso de erro
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }
    };

    // Deferir usando requestIdleCallback ou setTimeout
    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(loadQuizData, { timeout: 2000 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = globalThis.setTimeout(loadQuizData, 2000);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [searchParams, t]);

  // Rastrear início do quiz quando usuário começa (step 1)
  useEffect(() => {
    if (step === 1) {
      trackEvent('quiz_started', {
        pathname: window.location.pathname,
      });
      
    }
  }, [step, trackEvent]);

  // Auto-scroll to top on step change
  useEffect(() => {
    // ✅ Verificar montagem antes de manipular DOM
    if (!isMountedRef.current) return;
    
    // ✅ Usar requestAnimationFrame para garantir que o DOM está pronto
    requestAnimationFrame(() => {
      if (isMountedRef.current) {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
          // Suprimir erros de scroll se o componente foi desmontado
          if (import.meta.env.DEV) {
            if (import.meta.env.DEV) {
              console.debug('⚠️ [Quiz] Erro ao fazer scroll (componente desmontado):', error);
            }
          }
        }
      }
    });
  }, [step]);

  // ✅ NOVO: Função para scroll suave até elemento com erro
  const scrollToElement = useCallback((selector: string, focus: boolean = false) => {
    setTimeout(() => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        if (focus && element instanceof HTMLElement) {
          // Pequeno delay adicional para focar após scroll
          setTimeout(() => {
            element.focus();
          }, 300);
        }
      }
    }, 100);
  }, []);

  const updateField = useCallback((field: string, value: string) => {
    // ✅ CORREÇÃO: Garantir que o estado seja atualizado mesmo quando dados foram carregados
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      devLog(`🔄 [Quiz] updateField: ${field} = ${value}`, { prev, updated });
      return updated;
    });
  }, []);

  // Preparar dados do quiz para validação
  const getQuizDataForValidation = useCallback((): QuizData => {
    const finalRelationship = formData.relationship === t('quiz.relationships.other') 
      ? `${t('quiz.relationships.other')}: ${formData.customRelationship}` 
      : formData.relationship;
    
    return {
      relationship: finalRelationship,
      about_who: formData.aboutWho,
      style: formData.style,
      vocal_gender: formData.vocalGender || null,
      qualities: formData.qualities,
      memories: formData.memories,
      message: formData.message,
      language: 'pt', // Será atualizado no submit
    };
  }, [formData, t]);

  // ✅ CORREÇÃO BUG 2 e 3: Sempre passar dados reais para validação, apenas deferir validateOnChange
  const quizForValidation = useMemo(() => getQuizDataForValidation(), [getQuizDataForValidation]);
  const [validationReady, setValidationReady] = useState(false);
  
  // Inicializar validação apenas quando necessário (deferido)
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    let cancelled = false;
    const initValidation = () => {
      if (cancelled) return;
      setValidationReady(true);
    };

    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(initValidation, { timeout: 1500 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = globalThis.setTimeout(initValidation, 1500);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  // ✅ CORREÇÃO BUG 2: Sempre passar dados reais, apenas deferir validateOnChange
  const {
    validate: validateQuizData,
    validateRequired,
    sanitize: sanitizeQuizData,
    getFieldError: getFieldErrorRaw,
    hasFieldError,
    markFieldTouched,
  } = useQuizValidation(quizForValidation, {
    validateOnChange: validationReady,
    strict: false,
  });

  // Função helper para traduzir mensagens de erro
  const getFieldError = useCallback((field: string): string | undefined => {
    const errorMsg = getFieldErrorRaw(field);
    if (!errorMsg) return undefined;
    
    // Mapear mensagens hardcoded para chaves de tradução
    const translationMap: Record<string, string> = {
      'Nome é obrigatório': 'quiz.validation.enterName',
      'Relacionamento é obrigatório': 'quiz.validation.selectRelationship',
      'Estilo musical é obrigatório': 'quiz.validation.selectStyle',
      'Idioma é obrigatório': 'quiz.validation.selectStyle', // Fallback
    };
    
    // Verificar se a mensagem precisa ser traduzida
    for (const [hardcodedMsg, translationKey] of Object.entries(translationMap)) {
      if (errorMsg.includes(hardcodedMsg) || errorMsg === hardcodedMsg) {
        return t(translationKey, hardcodedMsg);
      }
    }
    
    // Se contém "é obrigatório", tentar traduzir baseado no campo
    if (errorMsg.includes('é obrigatório')) {
      if (field === 'about_who') {
        return t('quiz.validation.enterName', 'Nome é obrigatório');
      }
      if (field === 'relationship') {
        return t('quiz.validation.selectRelationship', 'Relacionamento é obrigatório');
      }
      if (field === 'style') {
        return t('quiz.validation.selectStyle', 'Estilo musical é obrigatório');
      }
    }
    
    return errorMsg;
  }, [getFieldErrorRaw, t]);

  const validateCurrentStep = useCallback(() => {
    // #endregion
    // Validação completa usando o utilitário centralizado
    switch (step) {
      case 1:
        // Validar relationship e about_who
        if (!formData.relationship.trim()) {
          toast.error(t('quiz.validation.selectRelationship'));
          markFieldTouched('relationship');
          // ✅ NOVO: Scroll até primeira opção de relacionamento
          scrollToElement('button[type="button"]');
          return false;
        }
        if (formData.relationship === t('quiz.relationships.other') && !formData.customRelationship.trim()) {
          toast.error(t('quiz.validation.enterRelationship'));
          markFieldTouched('customRelationship');
          // ✅ NOVO: Scroll até input de relacionamento customizado
          scrollToElement('input[placeholder*="relacionamento"]', true);
          return false;
        }
        if (!formData.aboutWho || !formData.aboutWho.trim()) {
          toast.error(t('quiz.validation.enterName', 'Nome é obrigatório'));
          markFieldTouched('about_who');
          // ✅ NOVO: Scroll até campo de nome e focar
          scrollToElement('#aboutWho', true);
          return false;
        }
        // Validação de tamanho
        if (formData.aboutWho.trim().length > 100) {
          toast.error(t('quiz.validation.nameTooLong'));
          markFieldTouched('about_who');
          // ✅ NOVO: Scroll até campo de nome e focar
          scrollToElement('#aboutWho', true);
          return false;
        }
        break;
      case 2:
        if (!formData.style.trim()) {
          toast.error(t('quiz.validation.selectStyle'));
          markFieldTouched('style');
          // ✅ NOVO: Scroll até primeira opção de estilo
          scrollToElement('button[type="button"]');
          return false;
        }
        break;
      case 3:
        // Validar tamanho máximo de qualities (500 caracteres)
        if (formData.qualities && formData.qualities.length > 500) {
          toast.error(t('quiz.validation.maxCharacters'));
          markFieldTouched('qualities');
          // ✅ NOVO: Scroll até textarea de qualidades
          scrollToElement('#qualities', true);
          return false;
        }
        break;
      case 4:
        // Validar tamanho máximo de memories (800 caracteres)
        if (formData.memories && formData.memories.length > 800) {
          toast.error(t('quiz.validation.maxMemories'));
          markFieldTouched('memories');
          // ✅ NOVO: Scroll até textarea de memórias
          scrollToElement('#memories', true);
          return false;
        }
        break;
      case 5:
        // Validar tamanho máximo de message (500 caracteres)
        if (formData.message && formData.message.length > 500) {
          toast.error(t('quiz.validation.maxMessage'));
          markFieldTouched('message');
          // ✅ NOVO: Scroll até textarea de mensagem
          scrollToElement('#message', true);
          return false;
        }
        break;
    }
    return true;
  }, [step, formData, t, markFieldTouched, scrollToElement]);

  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      const nextStep = step + 1;
      setStep(nextStep);
      
      // Rastrear conclusão do step atual
      trackEvent('quiz_step_completed', {
        step,
        nextStep,
        about_who: formData.aboutWho,
        style: formData.style,
        relationship: formData.relationship,
      });
    }
  }, [validateCurrentStep, step, formData, trackEvent]);

  const handleBack = useCallback(() => {
    setStep(step - 1);
  }, [step]);

  const handleSubmit = useCallback(async () => {
    // ✅ OTIMIZAÇÃO: Preload imediato do Checkout quando usuário clica em submit
    // Isso garante que o Checkout esteja pronto quando a navegação acontecer
    import('../pages/Checkout').catch(() => {});
    
    // ✅ CORREÇÃO RACE CONDITION: Marcar como submetendo IMEDIATAMENTE
    if (isSubmittingRef.current || loading) {
      devLog('⚠️ [Quiz] Submit já em andamento, ignorando clique duplicado');
      return;
    }
    
    // Marcar como submetendo ANTES de qualquer validação
    isSubmittingRef.current = true;
    
    if (!validateCurrentStep()) {
      devLog('❌ [Quiz] Validação do step atual falhou');
      // Resetar flag se validação falhar
      isSubmittingRef.current = false;
      return;
    }

    // Agora sim setar loading
    setLoading(true);
    
    devLog('🚀 [Quiz] Iniciando submit do quiz...');
    
    try {
      const finalRelationship = formData.relationship === t('quiz.relationships.other') 
        ? `${t('quiz.relationships.other')}: ${formData.customRelationship}` 
        : formData.relationship;

      // Detectar e persistir idioma
      const detectAndPersistLanguage = () => {
        const pathname = window.location.pathname;
        let lang = 'en'; // fallback inglês
        
        if (pathname.startsWith('/pt')) lang = 'pt';
        else if (pathname.startsWith('/es')) lang = 'es';
        else if (pathname.startsWith('/en')) lang = 'en';
        else {
          const stored = localStorage.getItem('musiclovely_language');
          if (stored && ['pt', 'en', 'es'].includes(stored)) lang = stored;
          else {
            const nav = navigator.language?.slice(0, 2);
            if (nav && ['pt', 'en', 'es'].includes(nav)) lang = nav;
          }
        }
        
        localStorage.setItem('musiclovely_language', lang);
        document.cookie = `lang=${lang};path=/;max-age=${60*60*24*365};samesite=lax`;
        document.documentElement.lang = lang;
        
        devLog('🌍 [Quiz] Idioma detectado e persistido:', lang);
        return lang;
      };

      const currentLanguage = detectAndPersistLanguage();

      // Verificar se está em modo de edição
      // ✅ CORREÇÃO: Verificar TANTO localStorage QUANTO URL para garantir que realmente está em modo de edição
      // Isso evita que a mensagem "Quiz atualizado" apareça quando não deveria
      const editingOrderId = localStorage.getItem('editing_order_id');
      const editingQuizId = localStorage.getItem('editing_quiz_id');
      const editingToken = localStorage.getItem('editing_token');
      
      // Verificar também se a URL tem edit=true (garantia adicional)
      const urlEdit = searchParams.get('edit');
      const urlOrderId = searchParams.get('order_id');
      const urlQuizId = searchParams.get('quiz_id');
      
      // Só considerar modo de edição se TANTO localStorage QUANTO URL indicarem edição
      const isEditMode = editingOrderId && editingQuizId && editingToken && 
                         urlEdit === 'true' && urlOrderId === editingOrderId && urlQuizId === editingQuizId;

      devLog('🔍 [Quiz] Verificando modo de edição:', {
        hasEditingFlags: !!(editingOrderId && editingQuizId && editingToken),
        urlEdit,
        urlOrderId,
        urlQuizId,
        isEditMode,
        editingOrderId,
        editingQuizId
      });

      if (isEditMode) {
        // Modo de edição: atualizar quiz no banco
        devLog('✏️ [Quiz] Atualizando quiz existente:', { editingOrderId, editingQuizId });
        
        const quizUpdateData = {
          relationship: finalRelationship,
          about_who: formData.aboutWho,
          style: formData.style,
          vocal_gender: formData.vocalGender || null,
          qualities: formData.qualities,
          memories: formData.memories,
          message: formData.message || null,
          language: currentLanguage,
          updated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabase
          .from('quizzes')
          .update(quizUpdateData)
          .eq('id', editingQuizId);

        if (updateError) {
          devError('❌ [Quiz] Erro ao atualizar quiz:', updateError);
          toast.error('Erro ao atualizar quiz');
          setLoading(false);
          isSubmittingRef.current = false; // ✅ Resetar flag
          return;
        }

        // Salvar também no localStorage para checkout
        const quizData = {
          ...quizUpdateData,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('pending_quiz', JSON.stringify(quizData));
        
        // Limpar flags de edição
        localStorage.removeItem('editing_order_id');
        localStorage.removeItem('editing_quiz_id');
        localStorage.removeItem('editing_token');

        devLog('✅ [Quiz] Quiz atualizado em modo de edição, navegando para checkout...');
        
        // ✅ CORREÇÃO: Após atualizar o quiz, navegar para checkout normalmente
        // O usuário clicou em "Continuar para o Pagamento", então deve ir para o checkout
        // Não mostrar mensagem "Quiz atualizado" - apenas navegar diretamente
        // ✅ CORREÇÃO: Remover sistema de rotas com prefixo de idioma
        const checkoutPath = '/checkout';
        
        devLog('🔄 [Quiz] Navegando para checkout após atualização:', checkoutPath);
        
        // Navegar preservando UTMs
        navigateWithUtms(checkoutPath);
        
        // ✅ NÃO resetar loading aqui - a navegação vai desmontar o componente
        // Não resetar isSubmittingRef também - será resetado quando o componente desmontar
        return;
      }

      // Modo normal: validar e salvar no localStorage
      // ✅ VALIDAÇÃO COMPLETA: Usar utilitário centralizado
      const quizDataForValidation: QuizData = {
        relationship: finalRelationship,
        about_who: formData.aboutWho,
        style: formData.style,
        vocal_gender: formData.vocalGender || null,
        qualities: formData.qualities,
        memories: formData.memories,
        message: formData.message || null,
        language: currentLanguage,
      };

      // Validar quiz completo antes de salvar
      const validationResult = validateQuiz(quizDataForValidation, { strict: false });
      if (!validationResult.valid) {
        devError('❌ [Quiz] Validação falhou:', validationResult.errors);
        const errorMessage = formatValidationErrors(validationResult.errors);
        toast.error(errorMessage || 'Por favor, corrija os erros no formulário');
        setLoading(false);
        isSubmittingRef.current = false; // ✅ Resetar flag
        return;
      }
      
      devLog('✅ [Quiz] Validação passou, salvando quiz...');

      // Gerar ou obter session_id único
      const quizSessionId = getOrCreateQuizSessionId();
      devLog('🔑 [Quiz] Session ID gerado/obtido:', quizSessionId);

      // Sanitizar dados antes de salvar
      const sanitizedQuiz = sanitizeQuiz(quizDataForValidation);
      const quizData = {
        ...sanitizedQuiz,
        timestamp: new Date().toISOString(),
        session_id: quizSessionId // Adicionar session_id ao quiz
      };

      devLog('💾 [Quiz] Tentando salvar quiz no localStorage:', {
        hasAboutWho: !!quizData.about_who,
        hasStyle: !!quizData.style,
        hasLanguage: !!quizData.language,
        session_id: quizSessionId,
        quizDataKeys: Object.keys(quizData),
        timestamp: quizData.timestamp
      });

      // Salvar no localStorage primeiro
      const saveResult = await saveQuizToStorage(quizData, { retries: 3, delay: 100 });
      
      if (!saveResult.success) {
        devError('❌ [Quiz] Erro ao salvar quiz no localStorage:', {
          error: saveResult.error?.message,
          errorStack: saveResult.error?.stack,
          formData,
          quizData
        });
        toast.error(`Erro ao salvar quiz: ${saveResult.error?.message || 'Erro desconhecido'}. Por favor, tente novamente.`);
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }
      
      devLog('✅ [Quiz] Quiz salvo no localStorage, tentando salvar no banco...');

      // ✅ SALVAMENTO ANTECIPADO: Salvar no banco antes de navegar
      // Aguardar até 5-7 segundos pelo primeiro save (não bloquear indefinidamente)
      const MAX_WAIT_TIME = 6000; // 6 segundos (aumentado para conexões lentas)
      const startTime = Date.now();

      // Preparar payload para o banco
      const quizPayload: QuizPayload = {
        user_id: null,
        customer_email: null, // Sem email ainda - será preenchido no checkout
        customer_whatsapp: null, // Sem WhatsApp ainda
        about_who: sanitizedQuiz.about_who,
        relationship: sanitizedQuiz.relationship,
        style: sanitizedQuiz.style,
        language: currentLanguage,
        vocal_gender: sanitizedQuiz.vocal_gender || null,
        qualities: sanitizedQuiz.qualities,
        memories: sanitizedQuiz.memories,
        message: sanitizedQuiz.message || null,
        key_moments: (quizData as any).key_moments || null,
        occasion: (quizData as any).occasion || null,
        desired_tone: (quizData as any).desired_tone || null,
        answers: { ...quizData, session_id: quizSessionId },
        session_id: quizSessionId // Coluna dedicada
      };

      // Tentar salvar no banco com timeout
      const saveToDatabase = async (): Promise<{ success: boolean; quizId?: string; error?: any }> => {
        try {
          const insertResult = await insertQuizWithRetry(quizPayload, {
            maxRetries: 2 // Menos tentativas para não demorar muito
          });

          if (insertResult.success && insertResult.data?.id) {
            return { success: true, quizId: insertResult.data.id };
          } else {
            return { success: false, error: insertResult.error };
          }
        } catch (error) {
          return { success: false, error };
        }
      };

      // Aguardar save com timeout
      const savePromise = saveToDatabase();
      const timeoutPromise = new Promise<{ success: false; timeout: true }>((resolve) => {
        setTimeout(() => resolve({ success: false, timeout: true }), MAX_WAIT_TIME);
      });

      const saveResult_db = await Promise.race([savePromise, timeoutPromise]);
      const elapsedTime = Date.now() - startTime;

      let quizSavedOrQueued = false; // Flag para garantir que foi salvo ou foi para fila

      if (saveResult_db.success && saveResult_db.quizId) {
        // ✅ SUCESSO: Quiz salvo no banco
        devLog('✅ [Quiz] Quiz salvo no banco com sucesso:', {
          quiz_id: saveResult_db.quizId,
          session_id: quizSessionId,
          elapsed_ms: elapsedTime
        });
        
        const updatedQuizData = { ...quizData, id: saveResult_db.quizId };
        await saveQuizToStorage(updatedQuizData, { retries: 1, delay: 50 });
        quizSavedOrQueued = true;
      } else {
        // ⚠️ FALHOU ou TIMEOUT - garantir que foi para fila ANTES de navegar
        const error = (saveResult_db as any).timeout ? new Error('Timeout ao salvar quiz') : (saveResult_db as any).error;
        devWarn('⚠️ [Quiz] Salvamento no banco falhou ou timeout:', {
          error: error?.message || 'Timeout',
          timeout: (saveResult_db as any).timeout,
          elapsed_ms: elapsedTime,
          session_id: quizSessionId
        });

        // ✅ PRIORIDADE 1: Garantir que foi para fila ANTES de navegar
        let queueSuccess = false;
        try {
          queueSuccess = await enqueueQuizToServer(quizPayload, error);
          
          if (queueSuccess) {
            devLog('📋 [Quiz] Quiz adicionado à fila de retry do servidor');
            quizSavedOrQueued = true;
          } else {
            devWarn('⚠️ [Quiz] Falha ao adicionar quiz à fila do servidor, tentando fallback no localStorage');
            
            // ✅ FALLBACK: Se falhar ao adicionar na fila, marcar no localStorage para retry no checkout
            const quizWithRetryFlag = {
              ...quizData,
              _needsRetry: true,
              _retryAttempts: 0,
              _lastRetryError: error?.message || 'Failed to enqueue'
            };
            
            try {
              await saveQuizToStorage(quizWithRetryFlag, { retries: 2, delay: 100 });
              devLog('✅ [Quiz] Quiz marcado para retry no checkout (fallback)');
              quizSavedOrQueued = true; // localStorage é aceitável como fallback
            } catch (fallbackError) {
              devError('❌ [Quiz] Falha total: não foi possível salvar nem na fila nem no localStorage:', fallbackError);
              quizSavedOrQueued = false; // Falhou tudo
            }
          }
        } catch (queueError) {
          devError('❌ [Quiz] Exceção ao adicionar à fila do servidor, tentando fallback:', queueError);
          
          // Fallback: marcar no localStorage para retry no checkout
          try {
            const quizWithRetryFlag = {
              ...quizData,
              _needsRetry: true,
              _retryAttempts: 0,
              _lastRetryError: queueError instanceof Error ? queueError.message : 'Unknown error'
            };
            await saveQuizToStorage(quizWithRetryFlag, { retries: 2, delay: 100 });
            devLog('✅ [Quiz] Quiz marcado para retry no checkout (fallback após exceção)');
            quizSavedOrQueued = true; // localStorage é aceitável como fallback
          } catch (fallbackError) {
            devError('❌ [Quiz] Falha total no fallback:', fallbackError);
            quizSavedOrQueued = false; // Falhou tudo
          }
        }

        // ✅ REGRA DE OURO: Se não salvou E não foi para fila, NÃO navegar
        if (!quizSavedOrQueued) {
          devError('❌ [Quiz] CRÍTICO: Não foi possível salvar quiz nem na fila. Bloqueando navegação.');
          toast.error('Erro ao salvar suas respostas. Por favor, tente novamente. Se o problema persistir, entre em contato conosco.');
          setLoading(false);
          isSubmittingRef.current = false;
          return; // NÃO navegar - proteger as respostas do usuário
        }

        // Se chegou aqui, foi para fila ou localStorage - processar em background silenciosamente
      }

      // ✅ VALIDAÇÃO FINAL: Só navegar se quiz foi salvo ou foi para fila
      if (!quizSavedOrQueued) {
        devError('❌ [Quiz] CRÍTICO: Validação final falhou - quiz não foi salvo nem foi para fila');
        toast.error('Erro ao salvar suas respostas. Por favor, tente novamente.');
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      devLog('✅ [Quiz] Quiz salvo no localStorage com sucesso e validado:', {
        hasAboutWho: !!quizData.about_who,
        hasStyle: !!quizData.style,
        hasLanguage: !!quizData.language,
        hasRelationship: !!quizData.relationship,
        session_id: quizSessionId,
        quiz_id: saveResult_db.success ? saveResult_db.quizId : 'pending',
        saved_to_db: saveResult_db.success,
        queued_for_retry: !saveResult_db.success && quizSavedOrQueued,
        quizData
      });
      
      // Rastrear conclusão do quiz
      trackEvent('quiz_completed', {
        quiz_id: saveResult_db.success ? saveResult_db.quizId : quizData.timestamp,
        session_id: quizSessionId,
        about_who: quizData.about_who,
        style: quizData.style,
        language: quizData.language,
        relationship: quizData.relationship,
        has_vocal_gender: !!quizData.vocal_gender,
        has_qualities: !!quizData.qualities,
        has_memories: !!quizData.memories,
        has_message: !!quizData.message,
        saved_to_db: saveResult_db.success,
        queued_for_retry: !saveResult_db.success && quizSavedOrQueued
      });
      
      // ✅ Só navegar se chegou até aqui (quiz foi salvo ou foi para fila)
      // ✅ CORREÇÃO: Remover sistema de rotas com prefixo de idioma
      const checkoutPath = '/checkout';
      
      devLog('🔄 [Quiz] Navegando para checkout (quiz protegido):', checkoutPath);
      navigateWithUtms(checkoutPath);
    } catch (error: any) {
      devError('❌ [Quiz] Erro ao salvar quiz:', error);
      toast.error(t('quiz.messages.errorSaving'));
      setLoading(false);
      isSubmittingRef.current = false; // ✅ Resetar flag em caso de erro
    }
    // ✅ NÃO usar finally aqui - se navegou com sucesso, o componente será desmontado
    // Se houve erro, já resetamos o loading e a flag acima
  }, [validateCurrentStep, formData, navigate, searchParams, navigateWithUtms, t]);

  const renderStep = () => {
    const commonProps = {
      formData,
      updateField,
      markFieldTouched,
      hasFieldError,
      getFieldError
    };

    switch (step) {
      case 1:
        return (
          <QuizStep1
            {...commonProps}
            relationships={RELATIONSHIPS}
          />
        );
      case 2:
        return (
          <QuizStep2
            {...commonProps}
            styles={STYLES}
            vocalOptions={VOCAL_OPTIONS}
          />
        );
      case 3:
        return <QuizStep3 {...commonProps} />;
      case 4:
        return <QuizStep4 {...commonProps} />;
      case 5:
        return <QuizStep5 {...commonProps} />;
      default:
        return null;
    }
  };

  const stepTitles = useMemo(() => [
    t('quiz.stepTitles.step1'),
    t('quiz.stepTitles.step2'),
    t('quiz.stepTitles.step3'),
    t('quiz.stepTitles.step4'),
    t('quiz.stepTitles.step5')
  ], [t]);

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--quiz-background))] p-3 md:p-6" style={{ minHeight: 'var(--dvh)' }}>
      <div className="max-w-[700px] lg:max-w-[600px] mx-auto py-4 md:py-4">
        <Card className="relative border-[hsl(var(--quiz-border))] shadow-lg">
          <CardHeader className="pb-0 md:pb-3 px-4 md:px-5 pt-4 md:pt-5">
            <QuizProgress step={step} totalSteps={totalSteps} progress={progress} />
            <CardTitle className="text-2xl md:text-2xl lg:text-2xl mb-0">
              {stepTitles[step - 1]}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-5 pb-4 md:pb-5 pt-1 md:pt-4">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="transition-opacity duration-300">
                {renderStep()}
              </div>

              <QuizNavigation
                step={step}
                totalSteps={totalSteps}
                loading={loading}
                onBack={handleBack}
                onNext={handleNext}
                onSubmit={handleSubmit}
              />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

Quiz.displayName = 'Quiz';

export default Quiz;

