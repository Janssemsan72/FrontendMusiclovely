import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, X } from '@/utils/iconImports';
import { useTranslation } from '@/hooks/useTranslation';

interface CheckoutPaymentButtonProps {
  processing: boolean;
  buttonError: boolean;
  retryCount: number;
  email: string;
  whatsapp: string;
  whatsappError: string;
  cameFromRestore: boolean;
  onClick: () => void;
  variant?: 'mobile' | 'desktop' | 'fixed';
}

export default function CheckoutPaymentButton({
  processing,
  buttonError,
  retryCount,
  email,
  whatsapp,
  whatsappError,
  cameFromRestore,
  onClick,
  variant = 'desktop'
}: CheckoutPaymentButtonProps) {
  const { t } = useTranslation();

  const getButtonClassName = () => {
    const baseClasses = variant === 'fixed' 
      ? 'w-full btn-pulse h-14 font-bold text-base'
      : variant === 'mobile'
      ? 'w-full btn-pulse h-16 md:h-12 font-bold text-lg md:text-lg lg:text-xl md:hidden'
      : 'w-full btn-pulse h-12 font-bold text-lg lg:text-xl hidden md:block';

    const colorClasses = buttonError
      ? 'bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 animate-pulse'
      : cameFromRestore && email && whatsapp && !whatsappError
      ? variant === 'mobile'
        ? 'bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-700 hover:via-emerald-700 hover:to-green-800 animate-pulse'
        : 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 animate-pulse'
      : 'bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-800 hover:from-emerald-800 hover:via-green-800 hover:to-emerald-900';

    const shadowClasses = buttonError ? 'shadow-red-800/40' : 'shadow-emerald-800/40';

    return `${baseClasses} ${colorClasses} text-white shadow-lg ${shadowClasses} hover:scale-105 transition-transform disabled:opacity-100 disabled:cursor-not-allowed`;
  };

  const getButtonText = () => {
    if (processing) {
      return (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {retryCount > 0 ? `${t('checkout.trying')} (${retryCount}/2)` : t('checkout.processing')}
        </>
      );
    }
    
    if (buttonError) {
      return (
        <>
          <X className="mr-2 h-5 w-5" />
          {!email && !whatsapp ? 'Preencha os campos acima' : !email ? 'Preencha o email' : 'Preencha o WhatsApp'}
        </>
      );
    }
    
    return (
      <>
        <Gift className="mr-2 h-5 w-5" />
        {cameFromRestore && email && whatsapp ? '🚀 Pagar Agora' : t('checkout.createMyMusic')}
      </>
    );
  };

  return (
    <Button
      onClick={onClick}
      disabled={processing}
      className={getButtonClassName()}
      size="lg"
    >
      {getButtonText()}
    </Button>
  );
}
