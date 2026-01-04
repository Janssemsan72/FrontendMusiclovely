import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EnhancedProgress } from '@/components/ui/enhanced-progress';
import AudioProgressBarEnhanced from '@/components/AudioProgressBarEnhanced';
import { useProgressBar } from '@/hooks/useProgressBar';

export default function ProgressBarExample() {
  const [audioCurrent, setAudioCurrent] = useState(0);
  const [audioDuration, setAudioDuration] = useState(180); // 3 minutos
  const [audioLoaded, setAudioLoaded] = useState(true);

  // Exemplo de uso do hook
  const progressBar = useProgressBar({
    initialValue: 50,
    max: 100,
    step: 5,
    onValueChange: (value) => console.log('Progress changed:', value)
  });

  // Simular áudio
  const simulateAudio = () => {
    setAudioLoaded(false);
    setTimeout(() => {
      setAudioLoaded(true);
      setAudioCurrent(0);
    }, 1000);
  };

  const seekAudio = (time: number) => {
    setAudioCurrent(time);
    console.log('Seeking to:', time);
  };

  return (
    <div className="p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Barras de Progresso Melhoradas</h1>
        <p className="text-muted-foreground">
          Componentes otimizados para touch e desktop com funcionalidades avançadas
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Barra de Progresso Genérica */}
        <Card>
          <CardHeader>
            <CardTitle>Barra de Progresso Genérica</CardTitle>
            <CardDescription>
              Componente flexível para diferentes tipos de progresso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor: {progressBar.value}</label>
              <EnhancedProgress
                value={progressBar.value}
                max={100}
                onValueChange={progressBar.setValue}
                showTooltip={true}
                showLabels={true}
                size="md"
                variant="default"
                showThumb={true}
                step={5}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => progressBar.setValue(Math.max(0, progressBar.value - 10))}
              >
                -10
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => progressBar.setValue(Math.min(100, progressBar.value + 10))}
              >
                +10
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Barra de Progresso de Áudio */}
        <Card>
          <CardHeader>
            <CardTitle>Barra de Progresso de Áudio</CardTitle>
            <CardDescription>
              Especializada para controle de áudio com suporte a touch
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Áudio: {Math.floor(audioCurrent / 60)}:{(audioCurrent % 60).toFixed(0).padStart(2, '0')} / {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toFixed(0).padStart(2, '0')}
              </label>
              <AudioProgressBarEnhanced
                current={audioCurrent}
                duration={audioDuration}
                isLoaded={audioLoaded}
                onSeek={seekAudio}
                showTooltip={true}
                showTimeLabels={true}
                showBuffered={true}
                bufferedRanges={[
                  { start: 0, end: 30 },
                  { start: 60, end: 120 }
                ]}
                size="md"
                variant="default"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setAudioCurrent(Math.max(0, audioCurrent - 10))}
              >
                -10s
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setAudioCurrent(Math.min(audioDuration, audioCurrent + 10))}
              >
                +10s
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={simulateAudio}
              >
                Simular Áudio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demonstração de Diferentes Tamanhos */}
      <Card>
        <CardHeader>
          <CardTitle>Diferentes Tamanhos</CardTitle>
          <CardDescription>
            Barras de progresso em diferentes tamanhos para diferentes contextos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pequeno (sm)</label>
            <EnhancedProgress
              value={75}
              max={100}
              size="sm"
              variant="success"
              showThumb={true}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Médio (md)</label>
            <EnhancedProgress
              value={50}
              max={100}
              size="md"
              variant="warning"
              showThumb={true}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Grande (lg)</label>
            <EnhancedProgress
              value={25}
              max={100}
              size="lg"
              variant="destructive"
              showThumb={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Demonstração de Variantes */}
      <Card>
        <CardHeader>
          <CardTitle>Diferentes Variantes</CardTitle>
          <CardDescription>
            Cores diferentes para diferentes estados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Padrão</label>
            <EnhancedProgress value={80} max={100} variant="default" />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Sucesso</label>
            <EnhancedProgress value={90} max={100} variant="success" />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Aviso</label>
            <EnhancedProgress value={60} max={100} variant="warning" />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Erro</label>
            <EnhancedProgress value={30} max={100} variant="destructive" />
          </div>
        </CardContent>
      </Card>

      {/* Instruções de Uso */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
          <CardDescription>
            Instruções para implementar as barras de progresso melhoradas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Funcionalidades Principais:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Touch-friendly:</strong> Suporte completo para dispositivos touch</li>
              <li>• <strong>Drag & Drop:</strong> Arraste o thumb para ajustar o valor</li>
              <li>• <strong>Tooltip:</strong> Mostra o valor atual ao passar o mouse</li>
              <li>• <strong>Step support:</strong> Valores incrementais personalizáveis</li>
              <li>• <strong>Responsive:</strong> Adapta-se a diferentes tamanhos de tela</li>
              <li>• <strong>Acessibilidade:</strong> Suporte a teclado e screen readers</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Para Áudio:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Buffered ranges:</strong> Mostra áreas já carregadas</li>
              <li>• <strong>Time labels:</strong> Exibe tempo atual e total</li>
              <li>• <strong>Precise seeking:</strong> Navegação precisa no áudio</li>
              <li>• <strong>Touch gestures:</strong> Gestos touch otimizados</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
