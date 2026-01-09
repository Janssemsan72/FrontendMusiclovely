import React from 'react';
import { SimpleLocaleProvider } from '@/contexts/SimpleLocaleContext';
import SimpleTranslationTest from '@/components/SimpleTranslationTest';

export default function SimpleLocaleTestPage() {
  return (
    <SimpleLocaleProvider>
      <div className="min-h-[100dvh] bg-background">
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-bold text-center mb-8">Teste de Sistema Simples</h1>
          <SimpleTranslationTest />
        </div>
      </div>
    </SimpleLocaleProvider>
  );
}



