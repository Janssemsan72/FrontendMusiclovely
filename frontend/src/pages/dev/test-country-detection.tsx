import React from 'react';
import CountryDetectionOverride from '@/components/dev/CountryDetectionOverride';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, MapPin, RefreshCw } from 'lucide-react';

export default function TestCountryDetection() {
  return (
    <div className="min-h-[100dvh] bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Globe className="h-6 w-6" />
                Teste de Detecção de País/Idioma
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Esta página permite testar e controlar a detecção de país/idioma do sistema.
                Use para testar com VPN ou simular diferentes localizações.
              </p>
            </CardContent>
          </Card>

          <CountryDetectionOverride />

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Instruções de Teste
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Teste com VPN</h4>
                  <ol className="text-green-700 text-sm space-y-1">
                    <li>1. Conecte sua VPN para um país específico</li>
                    <li>2. Clique em "Detectar País Real"</li>
                    <li>3. O sistema detectará o novo país</li>
                    <li>4. Teste diferentes países mudando a VPN</li>
                  </ol>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Simulação Manual</h4>
                  <ol className="text-blue-700 text-sm space-y-1">
                    <li>1. Use o seletor "Override Manual"</li>
                    <li>2. Escolha um país para simular</li>
                    <li>3. O sistema usará esse país até limpar o cache</li>
                    <li>4. Ideal para testes sem VPN</li>
                  </ol>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Dicas Importantes</h4>
                <ul className="text-yellow-700 text-sm space-y-1">
                  <li>• O sistema mantém cache por 30 segundos para evitar detecções excessivas</li>
                  <li>• Use "Limpar Todo o Cache" para resetar completamente</li>
                  <li>• A detecção real sempre sobrescreve o override manual</li>
                  <li>• Teste em modo incógnito para evitar cache do navegador</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
