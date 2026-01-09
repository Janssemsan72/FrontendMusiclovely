import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { Globe, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function LanguageStatus() {
  const { t, locale, isLoading, redetect } = useTranslation();
  const [lastDetection, setLastDetection] = useState<string>('');
  const [detectionStatus, setDetectionStatus] = useState<'success' | 'error' | 'loading' | 'idle'>('idle');

  useEffect(() => {
    const lastDetection = localStorage.getItem('lastLocaleDetection');
    if (lastDetection) {
      const date = new Date(parseInt(lastDetection));
      // Usar locale baseado no idioma atual
      const localeMap = { 'pt': 'pt-BR', 'en': 'en-US', 'es': 'es-ES' };
      const currentLocale = localeMap[locale] || 'pt-BR';
      setLastDetection(date.toLocaleString(currentLocale));
    }
  }, [locale]);

  const handleRedetect = async () => {
    setDetectionStatus('loading');
    try {
      await redetect();
      setDetectionStatus('success');
      // Usar locale baseado no idioma atual
      const localeMap = { 'pt': 'pt-BR', 'en': 'en-US', 'es': 'es-ES' };
      const currentLocale = localeMap[locale] || 'pt-BR';
      const now = new Date().toLocaleString(currentLocale);
      setLastDetection(now);
      
      // Reset status after 3 seconds
      setTimeout(() => setDetectionStatus('idle'), 3000);
    } catch (error) {
      setDetectionStatus('error');
      setTimeout(() => setDetectionStatus('idle'), 3000);
    }
  };

  const getStatusIcon = () => {
    switch (detectionStatus) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Globe className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusText = () => {
    switch (detectionStatus) {
      case 'loading':
        return 'Detectando...';
      case 'success':
        return 'Idioma atualizado!';
      case 'error':
        return 'Erro na detecção';
      default:
        return 'Idioma detectado';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Status do Idioma</span>
          </div>
          <Button
            onClick={handleRedetect}
            disabled={isLoading || detectionStatus === 'loading'}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${(isLoading || detectionStatus === 'loading') ? 'animate-spin' : ''}`} />
            Re-detectar
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Idioma atual:</span>
            <span className="font-medium">{locale.toUpperCase()}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className={`font-medium ${
              detectionStatus === 'success' ? 'text-green-600' :
              detectionStatus === 'error' ? 'text-red-600' :
              detectionStatus === 'loading' ? 'text-blue-600' :
              'text-muted-foreground'
            }`}>
              {getStatusText()}
            </span>
          </div>

          {lastDetection && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última detecção:</span>
              <span className="text-xs text-muted-foreground">{lastDetection}</span>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            💡 <strong>Dica:</strong> Quando desligar o VPN, clique em "Re-detectar" 
            ou recarregue a página para atualizar o idioma automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}



