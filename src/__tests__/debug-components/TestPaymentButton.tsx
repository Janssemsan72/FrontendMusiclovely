import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TestTube, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface TestPaymentButtonProps {
  language: 'pt' | 'en' | 'es';
  className?: string;
}

export default function TestPaymentButton({ language, className = '' }: TestPaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastTest, setLastTest] = useState<{ success: boolean; orderId?: string } | null>(null);

  // Só mostrar em desenvolvimento
  if (import.meta.env.PROD) {
    return null;
  }

  const getButtonText = () => {
    switch (language) {
      case 'pt': return 'Simular Pagamento';
      case 'en': return 'Simulate Payment';
      case 'es': return 'Simular Pago';
      default: return 'Test Payment';
    }
  };

  const getSuccessMessage = () => {
    switch (language) {
      case 'pt': return 'Pagamento simulado com sucesso!';
      case 'en': return 'Payment simulated successfully!';
      case 'es': return '¡Pago simulado con éxito!';
      default: return 'Payment simulated successfully!';
    }
  };

  const getErrorMessage = () => {
    switch (language) {
      case 'pt': return 'Erro ao simular pagamento';
      case 'en': return 'Error simulating payment';
      case 'es': return 'Error al simular pago';
      default: return 'Error simulating payment';
    }
  };

  const simulatePayment = async () => {
    setIsLoading(true);
    setLastTest(null);

    try {
      // 1. Criar usuário de teste
      const testEmail = `test-${language}-${Date.now()}@musiclovely.com`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: testEmail,
        password: 'test123456',
        options: {
          data: {
            display_name: `Test User ${language.toUpperCase()}`
          }
        }
      });

      if (authError) {
        throw new Error(`Auth error: ${authError.message}`);
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('User not created');
      }

      // 2. Criar perfil com idioma
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: `Test User ${language.toUpperCase()}`,
          preferred_language: language,
          email_notifications: true
        });

      if (profileError) {
        console.warn('Profile creation error (non-blocking):', profileError);
      }

      // 3. Criar quiz de teste
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          user_id: userId,
          customer_email: testEmail,
          about_who: language === 'pt' ? 'Minha esposa' : language === 'en' ? 'My wife' : 'Mi esposa',
          occasion: language === 'pt' ? 'Aniversário' : language === 'en' ? 'Birthday' : 'Cumpleaños',
          style: language === 'pt' ? 'MPB' : language === 'en' ? 'Pop' : 'Pop',
          language: language,
          key_moments: language === 'pt' ? 'Nosso primeiro encontro' : language === 'en' ? 'Our first date' : 'Nuestra primera cita',
          desired_tone: language === 'pt' ? 'Romântico' : language === 'en' ? 'Romantic' : 'Romántico',
          answers: {
            relationship: language === 'pt' ? 'esposa' : language === 'en' ? 'wife' : 'esposa',
            qualities: language === 'pt' ? 'carinhosa, inteligente' : language === 'en' ? 'caring, intelligent' : 'cariñosa, inteligente',
            message: language === 'pt' ? 'Te amo muito' : language === 'en' ? 'I love you so much' : 'Te amo mucho'
          }
        })
        .select()
        .single();

      if (quizError) {
        throw new Error(`Quiz creation error: ${quizError.message}`);
      }

      // 4. Criar pedido de teste
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          quiz_id: quizData.id,
          plan: 'standard',
          amount_cents: language === 'pt' ? 4790 : 3900, // R$ 47,90 ou $39
          status: 'pending',
          provider: language === 'pt' ? 'cakto' : 'stripe',
          customer_email: testEmail
        })
        .select()
        .single();

      if (orderError) {
        throw new Error(`Order creation error: ${orderError.message}`);
      }

      // 5. Simular pagamento (versão simplificada)
      console.log('💳 Simulando pagamento...');
      
      // Simular delay de processamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Pagamento simulado com sucesso (versão simplificada)');

      // 6. Verificar se email foi enviado
      const { data: emailResponse, error: emailError } = await supabase.functions.invoke(
        'send-email-with-variables',
        {
          body: {
            template_type: 'order_paid',
            order_id: orderData.id,
            language: language
          }
        }
      );

      if (emailError) {
        console.warn('Email sending error (non-blocking):', emailError);
      }

      setLastTest({ success: true, orderId: orderData.id });
      toast.success(getSuccessMessage());

    } catch (error: any) {
      console.error('Test payment error:', error);
      setLastTest({ success: false });
      toast.error(`${getErrorMessage()}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-center gap-2 mb-3">
          <TestTube className="h-4 w-4 text-orange-500" />
          <Badge variant="outline" className="text-xs">
            DEV TEST
          </Badge>
          <span className="text-xs text-gray-500 uppercase">{language}</span>
        </div>
        
        <Button
          onClick={simulatePayment}
          disabled={isLoading}
          size="sm"
          className="w-full"
          variant="outline"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {language === 'pt' ? 'Simulando...' : language === 'en' ? 'Simulating...' : 'Simulando...'}
            </>
          ) : (
            getButtonText()
          )}
        </Button>

        {lastTest && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            {lastTest.success ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span className="text-green-600">
                  {getSuccessMessage()}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span className="text-red-600">
                  {getErrorMessage()}
                </span>
              </>
            )}
          </div>
        )}

        {lastTest?.orderId && (
          <div className="mt-2 text-xs text-gray-500">
            Order ID: {lastTest.orderId}
          </div>
        )}
      </div>
    </div>
  );
}
