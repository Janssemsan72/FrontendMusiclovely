import { useState, useRef, useCallback } from 'react';
import { emailSchema, whatsappSchema, formatWhatsappForCakto } from '@/pages/Checkout/utils/checkoutValidation';
import { sanitizeEmail } from '@/utils/sanitize';
import { ZodError } from 'zod';
import { logger } from '@/utils/logger';

export function useCheckoutForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const [buttonError, setButtonError] = useState(false);
  
  // ✅ OTIMIZAÇÃO: Dados normalizados antecipadamente (evita processamento no clique)
  const normalizedEmailRef = useRef<string>('');
  const normalizedWhatsAppRef = useRef<string>('');

  // Função para formatar WhatsApp com máscara visual
  const formatWhatsApp = useCallback((value: string): string => {
    // Remove tudo exceto números
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos (DDD + número)
    const limitedNumbers = numbers.slice(0, 11);
    
    // Aplica máscara: (XX) XXXXX-XXXX
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7, 11)}`;
    }
  }, []);

  const validateEmail = useCallback((): boolean => {
    setEmailError('');
    try {
      emailSchema.parse(email);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        setEmailError(error.errors[0].message);
      }
      return false;
    }
  }, [email]);

  const validateWhatsApp = useCallback((): boolean => {
    setWhatsappError('');
    try {
      whatsappSchema.parse(whatsapp);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        setWhatsappError(error.errors[0].message);
      }
      return false;
    }
  }, [whatsapp]);

  const handleEmailChange = useCallback((newEmail: string) => {
    setEmail(newEmail);
    setEmailError('');
    setButtonError(false);
    // ✅ OTIMIZAÇÃO: Normalizar email antecipadamente
    if (newEmail && emailSchema.safeParse(newEmail).success) {
      normalizedEmailRef.current = sanitizeEmail(newEmail);
    }
  }, []);

  const handleWhatsAppChange = useCallback((newWhatsapp: string) => {
    const formatted = formatWhatsApp(newWhatsapp);
    setWhatsapp(formatted);
    setWhatsappError('');
    setButtonError(false);
    // ✅ OTIMIZAÇÃO: Normalizar WhatsApp antecipadamente
    if (formatted && whatsappSchema.safeParse(formatted).success) {
      normalizedWhatsAppRef.current = formatWhatsappForCakto(formatted);
    }
  }, [formatWhatsApp]);

  return {
    email,
    whatsapp,
    emailError,
    whatsappError,
    buttonError,
    setEmail: handleEmailChange,
    setWhatsapp: handleWhatsAppChange,
    setButtonError,
    validateEmail,
    validateWhatsApp,
    formatWhatsApp,
    normalizedEmailRef,
    normalizedWhatsAppRef
  };
}
