import React from 'react';
import { LocaleProvider } from '@/contexts/LocaleContext';
import LocaleSystemTest from '@/components/dev/LocaleSystemTest';

export default function TestLocalePage() {
  return (
    <LocaleProvider>
      <div className="min-h-[100dvh] bg-gray-50">
        <div className="container mx-auto py-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Teste do Sistema de Detecção de Idioma
            </h1>
            <p className="text-gray-600">
              Esta página testa todos os componentes do sistema de detecção de localização e idioma.
            </p>
          </div>
          
          <LocaleSystemTest />
        </div>
      </div>
    </LocaleProvider>
  );
}
