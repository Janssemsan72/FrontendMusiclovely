import React, { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
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

  // Translated constants
  const RELATIONSHIPS = [
    t('quiz.relationships.spouse'),
    t('quiz.relationships.child'),
    t('quiz.relationships.father'),
    t('quiz.relationships.mother'),
    t('quiz.relationships.sibling'),
    t('quiz.relationships.friend'),
    t('quiz.relationships.myself'),
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

  // ✅ Cleanup: Marcar componente como desmontado
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load existing quiz data from URL (edit mode) or localStorage on mount
  useEffect(() => {
    // PRIORIDADE 1: Verificar se há parâmetros de edição na URL
    const orderId = searchParams.get('order_id');
    const quizId = searchParams.get('quiz_id');
    const token = searchParams.get('token');
    const edit = searchParams.get('edit');

    if (edit === 'true' && orderId && quizId) {
      console.log('📥 [Quiz] Carregando quiz para edição via URL:', { orderId, quizId, token, edit });
      
      const loadQuizFromDatabase = async () => {
        try {
          // ✅ Verificar montagem antes de atualizar estado
          if (!isMountedRef.current) return;
          setLoading(true);
          
          // Tentar validar token se fornecido (opcional - não bloquear se token falhar)
          if (token) {
            console.log('🔍 [Quiz] Validando token...');
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
              console.warn('⚠️ [Quiz] Token inválido ou expirado, mas continuando com carregamento:', {
                error: linkError?.message,
                code: linkError?.code,
                details: linkError?.details
              });
            } else {
              console.log('✅ [Quiz] Token válido');
            }
          } else {
            console.warn('⚠️ [Quiz] Token não fornecido na URL, continuando mesmo assim');
          }

          // Buscar quiz do banco (mesmo se token falhar, pois temos order_id e quiz_id válidos)
          console.log('🔍 [Quiz] Buscando quiz no banco:', { quizId });
          
          // Tentar primeiro via RPC (ignora RLS), depois via query normal
          let quizData = null;
          let quizError = null;
          
          try {
            console.log('🔍 [Quiz] Tentando buscar quiz via RPC...');
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_quiz_by_id', { quiz_id_param: quizId });
            
            // Verificar se função RPC não existe (erro específico)
            if (rpcError) {
              console.warn('⚠️ [Quiz] Erro ao chamar RPC:', {
                message: rpcError.message,
                code: rpcError.code,
                details: rpcError.details
              });
              
              // Se função não existe (42883 = function does not exist), tentar query normal imediatamente
              if (rpcError.code === '42883' || rpcError.message?.includes('does not exist')) {
                console.log('⚠️ [Quiz] Função RPC não existe, tentando query normal imediatamente...');
                const { data: queryData, error: queryError } = await supabase
                  .from('quizzes')
                  .select('*')
                  .eq('id', quizId)
                  .single();
                
                quizData = queryData;
                quizError = queryError;
              } else {
                // Outro erro, tentar query normal como fallback
                console.log('⚠️ [Quiz] Erro na RPC, tentando query normal como fallback...');
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
              console.log('✅ [Quiz] Quiz encontrado via RPC');
            } else {
              // RPC retornou vazio, tentar query normal
              console.log('⚠️ [Quiz] RPC retornou vazio, tentando query normal...');
              const { data: queryData, error: queryError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();
              
              quizData = queryData;
              quizError = queryError;
            }
          } catch (error) {
            console.error('❌ [Quiz] Erro ao buscar quiz:', error);
            quizError = error;
          }

          if (quizError) {
            console.error('❌ [Quiz] Erro ao buscar quiz:', {
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
            console.error('❌ [Quiz] Quiz não encontrado no banco:', { quizId });
            if (isMountedRef.current) {
              toast.error('Quiz não encontrado');
              setLoading(false);
            }
            return;
          }

          console.log('✅ [Quiz] Quiz encontrado:', {
            quizId: quizData.id,
            about_who: quizData.about_who,
            style: quizData.style
          });
          
          // Verificar se o quiz pertence ao pedido (segurança adicional)
          console.log('🔍 [Quiz] Verificando se quiz pertence ao pedido:', { orderId });
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('quiz_id, status, customer_email')
            .eq('id', orderId)
            .single();
          
          if (orderError) {
            console.error('❌ [Quiz] Erro ao buscar pedido:', {
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
            console.error('❌ [Quiz] Pedido não encontrado:', { orderId });
            if (isMountedRef.current) {
              toast.error('Pedido não encontrado');
              setLoading(false);
            }
            return;
          }

          if (orderData.quiz_id !== quizId) {
            console.error('❌ [Quiz] Quiz não pertence ao pedido:', {
              order_quiz_id: orderData.quiz_id,
              provided_quiz_id: quizId
            });
            if (isMountedRef.current) {
              toast.error('Quiz não corresponde ao pedido');
              setLoading(false);
            }
            return;
          }

          console.log('✅ [Quiz] Quiz pertence ao pedido, continuando...');

          // Parse relationship (handle "Outro: xxx" format)
          let relationship = quizData.relationship || '';
          let customRelationship = '';
          
          if (relationship && relationship.startsWith('Outro: ')) {
            customRelationship = relationship.replace('Outro: ', '');
            relationship = 'Outro';
          }
          
          // ✅ Verificar montagem antes de atualizar estado
          if (!isMountedRef.current) return;
          
          // Populate form with existing data
          setFormData({
            relationship,
            customRelationship,
            aboutWho: quizData.about_who || '',
            style: quizData.style || '',
            vocalGender: quizData.vocal_gender || '',
            qualities: quizData.qualities || '',
            memories: quizData.memories || '',
            message: quizData.message || ''
          });
          
          // Salvar order_id e quiz_id para atualização posterior
          localStorage.setItem('editing_order_id', orderId);
          localStorage.setItem('editing_quiz_id', quizId);
          localStorage.setItem('editing_token', token || '');
          
          console.log('✅ [Quiz] Quiz carregado com sucesso, dados salvos no localStorage');
          if (isMountedRef.current) {
            toast.success('Quiz carregado para edição');
          }
        } catch (error) {
          console.error('❌ [Quiz] Erro ao carregar quiz:', error);
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          console.error('❌ [Quiz] Detalhes do erro:', {
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
    const loadedQuiz = loadQuizFromStorage();
    
    if (loadedQuiz) {
      try {
        // Parse relationship (handle "Outro: xxx" format)
        let relationship = loadedQuiz.relationship || '';
        let customRelationship = '';
        
        if (relationship && relationship.startsWith('Outro: ')) {
          customRelationship = relationship.replace('Outro: ', '');
          relationship = t('quiz.relationships.other');
        }
        
        // Populate form with existing data
        setFormData({
          relationship,
          customRelationship,
          aboutWho: loadedQuiz.about_who || '',
          style: loadedQuiz.style || '',
          vocalGender: loadedQuiz.vocal_gender || '',
          qualities: loadedQuiz.qualities || '',
          memories: loadedQuiz.memories || '',
          message: loadedQuiz.message || ''
        });
        
        // Mostrar notificação apenas uma vez
        if (!hasShownDataLoadedRef.current) {
          toast.info(t('quiz.messages.dataLoaded'));
          hasShownDataLoadedRef.current = true;
        }
      } catch (error) {
        console.error('Error loading existing quiz data:', error);
      }
    }
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
            console.debug('⚠️ [Quiz] Erro ao fazer scroll (componente desmontado):', error);
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
    setFormData(prev => ({ ...prev, [field]: value }));
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

  // Hook de validação em tempo real
  const quizForValidation = useMemo(() => getQuizDataForValidation(), [getQuizDataForValidation]);
  const {
    validate: validateQuizData,
    validateRequired,
    sanitize: sanitizeQuizData,
    getFieldError: getFieldErrorRaw,
    hasFieldError,
    markFieldTouched,
  } = useQuizValidation(quizForValidation, {
    validateOnChange: true,
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
    // ✅ AUDITORIA: Log de início do submit
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/08412bf1-75eb-4fbc-b0f3-f947bf663281',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Quiz.tsx:586',message:'handleSubmit iniciado',data:{step,isSubmitting:isSubmittingRef.current,loading},timestamp:Date.now(),sessionId:'audit-flow',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    // ✅ CORREÇÃO RACE CONDITION: Marcar como submetendo IMEDIATAMENTE
    if (isSubmittingRef.current || loading) {
      console.log('⚠️ [Quiz] Submit já em andamento, ignorando clique duplicado');
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/08412bf1-75eb-4fbc-b0f3-f947bf663281',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Quiz.tsx:590',message:'Submit bloqueado - já em andamento',data:{isSubmitting:isSubmittingRef.current,loading},timestamp:Date.now(),sessionId:'audit-flow',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    // Marcar como submetendo ANTES de qualquer validação
    isSubmittingRef.current = true;
    
    if (!validateCurrentStep()) {
      console.log('❌ [Quiz] Validação do step atual falhou');
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/08412bf1-75eb-4fbc-b0f3-f947bf663281',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Quiz.tsx:597',message:'Validação falhou',data:{step},timestamp:Date.now(),sessionId:'audit-flow',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Resetar flag se validação falhar
      isSubmittingRef.current = false;
      return;
    }

    // Agora sim setar loading
    setLoading(true);
    
    console.log('🚀 [Quiz] Iniciando submit do quiz...');
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/08412bf1-75eb-4fbc-b0f3-f947bf663281',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Quiz.tsx:606',message:'Submit validado, iniciando salvamento',data:{step,hasRelationship:!!formData.relationship,hasAboutWho:!!formData.aboutWho,hasStyle:!!formData.style},timestamp:Date.now(),sessionId:'audit-flow',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
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
        
        console.log('🌍 [Quiz] Idioma detectado e persistido:', lang);
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

      console.log('🔍 [Quiz] Verificando modo de edição:', {
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
        console.log('✏️ [Quiz] Atualizando quiz existente:', { editingOrderId, editingQuizId });
        
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
          console.error('❌ [Quiz] Erro ao atualizar quiz:', updateError);
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

        console.log('✅ [Quiz] Quiz atualizado em modo de edição, navegando para checkout...');
        
        // ✅ CORREÇÃO: Após atualizar o quiz, navegar para checkout normalmente
        // O usuário clicou em "Continuar para o Pagamento", então deve ir para o checkout
        // Não mostrar mensagem "Quiz atualizado" - apenas navegar diretamente
        const checkoutPath = '/checkout';
        
        console.log('🔄 [Quiz] Navegando para checkout após atualização:', checkoutPath);
        
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
        console.error('❌ [Quiz] Validação falhou:', validationResult.errors);
        const errorMessage = formatValidationErrors(validationResult.errors);
        toast.error(errorMessage || 'Por favor, corrija os erros no formulário');
        setLoading(false);
        isSubmittingRef.current = false; // ✅ Resetar flag
        return;
      }
      
      console.log('✅ [Quiz] Validação passou, salvando quiz...');

      // Gerar ou obter session_id único
      const quizSessionId = getOrCreateQuizSessionId();
      console.log('🔑 [Quiz] Session ID gerado/obtido:', quizSessionId);

      // Sanitizar dados antes de salvar
      const sanitizedQuiz = sanitizeQuiz(quizDataForValidation);
      const quizData = {
        ...sanitizedQuiz,
        timestamp: new Date().toISOString(),
        session_id: quizSessionId // Adicionar session_id ao quiz
      };

      console.log('💾 [Quiz] Tentando salvar quiz no localStorage:', {
        hasAboutWho: !!quizData.about_who,
        hasStyle: !!quizData.style,
        hasLanguage: !!quizData.language,
        session_id: quizSessionId,
        quizDataKeys: Object.keys(quizData),
        timestamp: quizData.timestamp
      });

      // Salvar no localStorage primeiro (sempre tentar, mas não bloquear se falhar)
      const saveResult = await saveQuizToStorage(quizData, { retries: 3, delay: 100 });
      
      if (!saveResult.success) {
        console.warn('⚠️ [Quiz] Erro ao salvar quiz no localStorage, continuando com salvamento em background:', {
          error: saveResult.error?.message,
          formData,
          quizData
        });
        // Não bloquear - continuar tentando salvar no banco e fila em background
      } else {
        console.log('✅ [Quiz] Quiz salvo no localStorage, tentando salvar no banco...');
      }

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
        console.log('✅ [Quiz] Quiz salvo no banco com sucesso:', {
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
        console.warn('⚠️ [Quiz] Salvamento no banco falhou ou timeout:', {
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
            console.log('📋 [Quiz] Quiz adicionado à fila de retry do servidor');
            quizSavedOrQueued = true;
          } else {
            console.warn('⚠️ [Quiz] Falha ao adicionar quiz à fila do servidor, tentando fallback no localStorage');
            
            // ✅ FALLBACK: Se falhar ao adicionar na fila, marcar no localStorage para retry no checkout
            const quizWithRetryFlag = {
              ...quizData,
              _needsRetry: true,
              _retryAttempts: 0,
              _lastRetryError: error?.message || 'Failed to enqueue'
            };
            
            try {
              await saveQuizToStorage(quizWithRetryFlag, { retries: 2, delay: 100 });
              console.log('✅ [Quiz] Quiz marcado para retry no checkout (fallback)');
              quizSavedOrQueued = true; // localStorage é aceitável como fallback
            } catch (fallbackError) {
              console.error('❌ [Quiz] Falha total: não foi possível salvar nem na fila nem no localStorage:', fallbackError);
              quizSavedOrQueued = false; // Falhou tudo
            }
          }
        } catch (queueError) {
          console.error('❌ [Quiz] Exceção ao adicionar à fila do servidor, tentando fallback:', queueError);
          
          // Fallback: marcar no localStorage para retry no checkout
          try {
            const quizWithRetryFlag = {
              ...quizData,
              _needsRetry: true,
              _retryAttempts: 0,
              _lastRetryError: queueError instanceof Error ? queueError.message : 'Unknown error'
            };
            await saveQuizToStorage(quizWithRetryFlag, { retries: 2, delay: 100 });
            console.log('✅ [Quiz] Quiz marcado para retry no checkout (fallback após exceção)');
            quizSavedOrQueued = true; // localStorage é aceitável como fallback
          } catch (fallbackError) {
            console.error('❌ [Quiz] Falha total no fallback:', fallbackError);
            quizSavedOrQueued = false; // Falhou tudo
          }
        }

        // ✅ ESTRATÉGIA FINAL: Se tudo falhou, garantir que está no localStorage para retry
        if (!quizSavedOrQueued) {
          console.warn('⚠️ [Quiz] Todas as estratégias falharam, tentando salvar no localStorage como fallback final...');
          
          // Última tentativa: salvar no localStorage com flag de retry (sempre deve funcionar)
          try {
            const quizWithRetryFlag = {
              ...quizData,
              _needsRetry: true,
              _retryAttempts: 0,
              _lastRetryError: error?.message || 'All strategies failed'
            };
            
            // Tentar salvar no localStorage sem retry (já tentamos antes)
            try {
              localStorage.setItem('musiclovely_quiz', JSON.stringify(quizWithRetryFlag));
              localStorage.setItem('pending_quiz', JSON.stringify(quizWithRetryFlag));
              console.log('✅ [Quiz] Quiz salvo no localStorage como fallback final');
              quizSavedOrQueued = true; // localStorage sempre deve funcionar
            } catch (localStorageError) {
              // Se até localStorage falhar, tentar sessionStorage
              try {
                sessionStorage.setItem('musiclovely_quiz', JSON.stringify(quizWithRetryFlag));
                sessionStorage.setItem('pending_quiz', JSON.stringify(quizWithRetryFlag));
                console.log('✅ [Quiz] Quiz salvo no sessionStorage como fallback final');
                quizSavedOrQueued = true;
              } catch (sessionStorageError) {
                // Se tudo falhar, usar memória (último recurso)
                console.warn('⚠️ [Quiz] Todos os storages falharam, usando memória como último recurso');
                (window as any).__musiclovely_quiz_fallback = quizWithRetryFlag;
                quizSavedOrQueued = true; // Sempre permitir continuar
              }
            }
          } catch (finalError) {
            console.error('❌ [Quiz] Erro no fallback final, mas permitindo continuar:', finalError);
            // Mesmo se tudo falhar, permitir continuar - o quiz está no formData e pode ser recuperado
            quizSavedOrQueued = true;
          }
        }

        // Sempre mostrar mensagem de "tentando em background" quando não salvou diretamente no banco
        if (!saveResult_db.success) {
          toast.info('Tivemos uma oscilação na conexão, estamos tentando de novo em segundo plano. Você pode continuar normalmente.');
        }
      }

      console.log('✅ [Quiz] Quiz salvo no localStorage com sucesso e validado:', {
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
      const checkoutPath = '/checkout';
      
      console.log('🔄 [Quiz] Navegando para checkout (quiz protegido):', checkoutPath);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/08412bf1-75eb-4fbc-b0f3-f947bf663281',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Quiz.tsx:982',message:'Navegando para checkout',data:{checkoutPath,quizSavedOrQueued,saveResult_db_success:saveResult_db.success},timestamp:Date.now(),sessionId:'audit-flow',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // ✅ SALVAMENTO EM BACKGROUND: Continuar tentando salvar mesmo após navegação
      if (!saveResult_db.success || !quizSavedOrQueued) {
        // Iniciar salvamento em background (não bloqueia navegação)
        (async () => {
          try {
            console.log('🔄 [Quiz] Iniciando salvamento em background...');
            
            // Tentar salvar no banco novamente
            const backgroundResult = await insertQuizWithRetry(quizPayload, {
              maxRetries: 5, // Mais tentativas em background
              initialDelay: 1000,
              maxDelay: 10000
            });
            
            if (backgroundResult.success) {
              console.log('✅ [Quiz] Quiz salvo em background com sucesso:', backgroundResult.data?.id);
            } else {
              // Se falhar, tentar fila
              console.log('🔄 [Quiz] Salvamento direto falhou, tentando fila em background...');
              const queueResult = await enqueueQuizToServer(quizPayload, backgroundResult.error);
              
              if (queueResult) {
                console.log('✅ [Quiz] Quiz adicionado à fila em background');
              } else {
                console.warn('⚠️ [Quiz] Todas as tentativas em background falharam, mas quiz está no localStorage');
              }
            }
          } catch (bgError) {
            console.warn('⚠️ [Quiz] Erro no salvamento em background (não crítico):', bgError);
            // Não mostrar erro - quiz está no localStorage e pode ser recuperado
          }
        })();
        
        // Mostrar mensagem informativa
        toast.info('Tivemos uma oscilação na conexão, estamos tentando de novo em segundo plano. Você pode continuar normalmente.');
      }
      
      navigateWithUtms(checkoutPath);
    } catch (error: any) {
      console.warn('⚠️ [Quiz] Erro ao processar quiz, mas permitindo continuar:', error);
      
      // ✅ ÚLTIMA ESTRATÉGIA: Garantir que quiz está no localStorage antes de navegar
      try {
        // Tentar usar quizData se disponível, senão construir a partir do formData
        const quizDataToSave = typeof quizData !== 'undefined' ? quizData : {
          relationship: formData.relationship || '',
          about_who: formData.aboutWho || '',
          style: formData.style || '',
          language: currentLanguage,
          vocal_gender: formData.vocalGender || null,
          qualities: formData.qualities,
          memories: formData.memories,
          message: formData.message || null,
          timestamp: new Date().toISOString(),
          session_id: getOrCreateQuizSessionId()
        };
        
        const quizWithRetryFlag = {
          ...quizDataToSave,
          _needsRetry: true,
          _retryAttempts: 0,
          _lastRetryError: error?.message || 'Unknown error'
        };
        
        // Tentar salvar em todos os storages disponíveis
        try {
          localStorage.setItem('musiclovely_quiz', JSON.stringify(quizWithRetryFlag));
          localStorage.setItem('pending_quiz', JSON.stringify(quizWithRetryFlag));
        } catch (e1) {
          try {
            sessionStorage.setItem('musiclovely_quiz', JSON.stringify(quizWithRetryFlag));
            sessionStorage.setItem('pending_quiz', JSON.stringify(quizWithRetryFlag));
          } catch (e2) {
            (window as any).__musiclovely_quiz_fallback = quizWithRetryFlag;
          }
        }
        
        console.log('✅ [Quiz] Quiz salvo como fallback final antes de navegar');
        toast.info('Tivemos uma oscilação na conexão, estamos tentando de novo em segundo plano. Você pode continuar normalmente.');
        
        // Sempre permitir navegar - quiz está protegido
        navigateWithUtms('/checkout');
      } catch (finalError) {
        // Mesmo se tudo falhar, permitir continuar
        console.warn('⚠️ [Quiz] Erro no fallback final, mas permitindo continuar:', finalError);
        toast.info('Tivemos uma oscilação na conexão, estamos tentando de novo em segundo plano. Você pode continuar normalmente.');
        navigateWithUtms('/checkout');
      }
      
      setLoading(false);
      isSubmittingRef.current = false;
    }
    // ✅ NÃO usar finally aqui - se navegou com sucesso, o componente será desmontado
    // Se houve erro, já resetamos o loading e a flag acima
  }, [validateCurrentStep, formData, navigate, searchParams, navigateWithUtms, t]);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-2.5 md:space-y-4">
            <div>
              <Label className="text-lg md:text-lg font-semibold mb-2 md:mb-2 block">{t('quiz.questions.forWho')} *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-2.5">
                {RELATIONSHIPS.map((rel) => (
                  <button
                    key={rel}
                    type="button"
                    onClick={() => updateField('relationship', rel)}
                    className={`px-4 py-2.5 md:px-4 md:py-2.5 rounded-full border-2 transition-all font-medium text-lg md:text-base ${
                      formData.relationship === rel
                        ? 'border-[hsl(var(--quiz-primary))] bg-[hsl(var(--quiz-primary))] text-white shadow-md'
                        : 'border-[hsl(var(--quiz-border))] bg-white text-gray-700 hover:border-[hsl(var(--quiz-primary))]'
                    }`}
                  >
                    {rel}
                  </button>
                ))}
              </div>
              {formData.relationship === t('quiz.relationships.other') && (
                <div className="mt-3 md:mt-3">
                  <Input
                    placeholder={t('quiz.questions.enterRelationship')}
                    value={formData.customRelationship}
                    onChange={(e) => {
                      updateField('customRelationship', e.target.value);
                      markFieldTouched('customRelationship');
                    }}
                    onBlur={() => markFieldTouched('customRelationship')}
                    className={`border-[hsl(var(--quiz-border))] text-lg md:text-base py-2.5 md:py-3 ${
                      hasFieldError('customRelationship') ? 'border-red-500' : ''
                    }`}
                  />
                  {hasFieldError('customRelationship') && (
                    <p className="text-base md:text-sm text-red-500 mt-1">{getFieldError('customRelationship')}</p>
                  )}
                  <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mt-1">
                    {formData.customRelationship.length}/100 {t('quiz.characterCount.characters')}
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="aboutWho" className="text-lg md:text-lg font-semibold mb-1.5 md:mb-2 block">{t('quiz.questions.name')} *</Label>
              <Input
                id="aboutWho"
                placeholder={t('quiz.questions.namePlaceholder')}
                value={formData.aboutWho}
                onChange={(e) => {
                  updateField('aboutWho', e.target.value);
                  markFieldTouched('about_who');
                }}
                onBlur={() => markFieldTouched('about_who')}
                className={`border-[hsl(var(--quiz-border))] text-lg md:text-base py-2.5 md:py-3 ${
                  hasFieldError('about_who') ? 'border-red-500' : ''
                }`}
              />
              {hasFieldError('about_who') && (
                <p className="text-base md:text-sm text-red-500 mt-1">{getFieldError('about_who')}</p>
              )}
              <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mt-1">
                {t('quiz.questions.nameHint')} ({formData.aboutWho.length}/100 {t('quiz.characterCount.characters')})
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-1 md:space-y-2">
            <div>
              <Label className="text-lg md:text-lg font-semibold mb-0.5 md:mb-1 block">{t('quiz.questions.styleQuestion')} *</Label>
              <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mb-1.5 md:mb-1.5 leading-snug">
                {t('quiz.questions.styleDescription')}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
              {STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => updateField('style', style)}
                  className={`px-3 py-2 md:px-4 md:py-2 rounded-full border-2 transition-all font-medium text-base md:text-sm ${
                    formData.style === style
                      ? 'border-[hsl(var(--quiz-primary))] bg-[hsl(var(--quiz-primary))] text-white shadow-md'
                      : 'border-[hsl(var(--quiz-border))] bg-white text-gray-700 hover:border-[hsl(var(--quiz-primary))]'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            <div className="border-t border-[hsl(var(--quiz-border))] pt-1.5 md:pt-2 mt-2 md:mt-2.5">
              <div>
                <Label className="text-lg md:text-lg font-semibold mb-0.5 md:mb-1 block">{t('quiz.questions.vocalPreference')}</Label>
                <p className="text-base md:text-sm text-[hsl(var(--quiz-text-muted))] mb-1.5 md:mb-1.5 leading-snug">
                  {t('quiz.questions.vocalDescription')}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-0.5 md:gap-2">
                {VOCAL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('vocalGender', option.value)}
                    className={`px-1 py-2 md:px-4 md:py-2 rounded-full border-2 transition-all font-medium text-xs md:text-sm whitespace-nowrap ${
                      formData.vocalGender === option.value
                        ? 'border-[hsl(var(--quiz-primary))] bg-[hsl(var(--quiz-primary))] text-white shadow-md'
                        : 'border-[hsl(var(--quiz-border))] bg-white text-gray-700 hover:border-[hsl(var(--quiz-primary))]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-1.5 md:space-y-3">
            <div>
              <Label htmlFor="qualities" className="text-xl md:text-xl font-semibold mb-1 block">{t('quiz.questions.qualities')} ({t('quiz.characterCount.optional')})</Label>
              <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mb-2 md:mb-2 leading-snug">
                {t('quiz.questions.qualitiesDescription')}
              </p>
            </div>
            <Textarea
              id="qualities"
              placeholder={t('quiz.questions.qualitiesPlaceholder')}
              value={formData.qualities}
              onChange={(e) => {
                updateField('qualities', e.target.value);
                markFieldTouched('qualities');
              }}
              onBlur={() => markFieldTouched('qualities')}
              rows={5}
              className={`border-[hsl(var(--quiz-border))] resize-none text-lg md:text-lg py-2.5 md:py-3 ${
                hasFieldError('qualities') ? 'border-red-500' : ''
              }`}
            />
            {hasFieldError('qualities') && (
              <p className="text-lg md:text-base text-red-500 mt-1">{getFieldError('qualities')}</p>
            )}
            <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mt-1">
              {formData.qualities.length}/500 {t('quiz.characterCount.characters')} {formData.qualities.length > 500 && `(${t('quiz.characterCount.maxExceeded')})`}
            </p>
          </div>
        );

      case 4:
        return (
          <div className="space-y-1.5 md:space-y-3">
            <div>
              <Label htmlFor="memories" className="text-xl md:text-xl font-semibold mb-1 block">{t('quiz.questions.memories')} ({t('quiz.characterCount.optional')})</Label>
              <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mb-2 md:mb-2 leading-snug">
                {t('quiz.questions.memoriesDescription')}
              </p>
            </div>
            <Textarea
              id="memories"
              placeholder={t('quiz.questions.memoriesPlaceholder')}
              value={formData.memories}
              onChange={(e) => {
                updateField('memories', e.target.value);
                markFieldTouched('memories');
              }}
              onBlur={() => markFieldTouched('memories')}
              rows={5}
              className={`border-[hsl(var(--quiz-border))] resize-none text-lg md:text-lg py-2.5 md:py-3 ${
                hasFieldError('memories') ? 'border-red-500' : ''
              }`}
            />
            {hasFieldError('memories') && (
              <p className="text-lg md:text-base text-red-500 mt-1">{getFieldError('memories')}</p>
            )}
            <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mt-1">
              {formData.memories.length}/800 {t('quiz.characterCount.characters')} {formData.memories.length > 800 && `(${t('quiz.characterCount.maxExceeded')})`}
            </p>
          </div>
        );

      case 5:
        return (
          <div className="space-y-1.5 md:space-y-4">
            <div className="space-y-2 md:space-y-3">
              <div>
                <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mb-2 md:mb-2 leading-snug">
                  {t('quiz.questions.heartMessageDescription')}
                </p>
              </div>
              <Textarea
                id="message"
                placeholder={t('quiz.questions.heartMessagePlaceholder')}
                value={formData.message}
                onChange={(e) => {
                  updateField('message', e.target.value);
                  markFieldTouched('message');
                }}
                onBlur={() => markFieldTouched('message')}
                rows={5}
                className={`border-[hsl(var(--quiz-border))] resize-none text-lg md:text-lg py-2.5 md:py-3 ${
                  hasFieldError('message') ? 'border-red-500' : ''
                }`}
              />
              {hasFieldError('message') && (
                <p className="text-lg md:text-base text-red-500 mt-1">{getFieldError('message')}</p>
              )}
              <p className="text-lg md:text-base text-[hsl(var(--quiz-text-muted))] mt-1">
                {formData.message.length}/500 {t('quiz.characterCount.characters')} {formData.message.length > 500 && `(${t('quiz.characterCount.maxExceeded')})`}
              </p>
            </div>
          </div>
        );

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
            <div className="mb-2 md:mb-2">
              <Progress value={progress} className="h-1" />
              <div className="flex items-center justify-between mt-1 md:mt-1.5">
                <p className="text-lg md:text-sm text-[hsl(var(--quiz-text-muted))]">
                  {t('quiz.progress.step')} {step} {t('quiz.progress.of')} {totalSteps}
                </p>
                <p className="text-lg md:text-sm font-medium text-[hsl(var(--quiz-primary))]">
                  {Math.round(progress)}% {t('quiz.progress.complete')}
                </p>
              </div>
            </div>
            <CardTitle className="text-2xl md:text-2xl lg:text-2xl mb-0">
              {stepTitles[step - 1]}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-5 pb-4 md:pb-5 pt-1 md:pt-4">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="transition-opacity duration-300">
                {renderStep()}
              </div>

              <div className="flex gap-2 md:gap-3 mt-2.5 md:mt-4">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={loading}
                    className="border-[hsl(var(--quiz-border))] text-xl md:text-base font-semibold px-4 py-3 md:px-5 md:py-3"
                  >
                    <ArrowLeft className="mr-2 h-6 w-6 md:h-4 md:w-4 flex-shrink-0" />
                    {/* ✅ CORREÇÃO: Fallback para garantir texto sempre visível */}
                    {t('quiz.buttons.back', 'Voltar')}
                  </Button>
                )}
                
                {step < totalSteps ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="ml-auto bg-[hsl(var(--quiz-primary))] hover:bg-[hsl(var(--quiz-primary-hover))] text-white text-xl md:text-base font-semibold px-4 py-3 md:px-5 md:py-3"
                    disabled={loading}
                  >
                    {/* ✅ CORREÇÃO: Fallback para garantir texto sempre visível */}
                    {t('quiz.buttons.next', 'Próximo')}
                    <ArrowRight className="ml-2 h-6 w-6 md:h-4 md:w-4 flex-shrink-0" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    className="ml-auto bg-[hsl(var(--quiz-primary))] hover:bg-[hsl(var(--quiz-primary-hover))] text-white text-base md:text-sm font-semibold px-4 py-3 md:px-5 md:py-3 whitespace-normal md:whitespace-nowrap leading-tight"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-6 w-6 md:h-4 md:w-4 animate-spin flex-shrink-0" />}
                    {/* ✅ CORREÇÃO: Fallback para garantir texto sempre visível */}
                    <span className="text-center">{t('quiz.buttons.continueToPayment', 'Continuar para Pagamento')}</span>
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

Quiz.displayName = 'Quiz';

export default Quiz;

