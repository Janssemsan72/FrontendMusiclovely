import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/utils/logger';

const laNaEscolaAudio = '/audio/la_na_escola-2.mp3';
const popFelizAudio = '/audio/pop_feliz.mp3';

export function useCheckoutAudio() {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
  const audioElementsRef = useRef<{ [key: number]: HTMLAudioElement | null }>({ 0: null, 1: null });
  const [currentTimes, setCurrentTimes] = useState<{ [key: number]: number }>({ 0: 0, 1: 0 });
  const [durations, setDurations] = useState<{ [key: number]: number }>({ 0: 0, 1: 0 });

  // Função para obter ou criar elemento de áudio sob demanda
  const getAudioElement = useCallback((index: number): HTMLAudioElement | null => {
    if (!audioElementsRef.current[index]) {
      // Criar apenas quando necessário
      const audioSrc = index === 0 ? laNaEscolaAudio : popFelizAudio;
      const audio = new Audio(audioSrc);
      audio.preload = 'none';
      audioElementsRef.current[index] = audio;
    }
    return audioElementsRef.current[index];
  }, []);

  const togglePlay = useCallback((index: number) => {
    const audio = getAudioElement(index);
    if (!audio) return;
    
    // Adicionar event listeners na primeira vez que o áudio é usado
    if (!audio.hasAttribute('data-listeners-added')) {
      audio.setAttribute('data-listeners-added', 'true');
      
      const handleLoadedMetadata = () => {
        setDurations(prev => ({ ...prev, [index]: audio.duration }));
      };
      
      const handleTimeUpdate = () => {
        setCurrentTimes(prev => ({ ...prev, [index]: audio.currentTime }));
      };
      
      const handleEnded = () => {
        setCurrentlyPlaying(null);
        setCurrentTimes(prev => ({ ...prev, [index]: 0 }));
      };
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
    }
    
    if (currentlyPlaying === index) {
      audio.pause();
      setCurrentlyPlaying(null);
    } else {
      // Pausar outros áudios
      Object.keys(audioElementsRef.current).forEach(key => {
        const otherIndex = parseInt(key);
        if (otherIndex !== index) {
          const otherAudio = audioElementsRef.current[otherIndex];
          if (otherAudio) {
            otherAudio.pause();
            otherAudio.currentTime = 0;
          }
        }
      });
      
      audio.play().catch(err => {
        logger.error('Erro ao reproduzir áudio:', err);
      });
      setCurrentlyPlaying(index);
    }
  }, [currentlyPlaying, getAudioElement]);

  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Limpar elementos de áudio quando componente desmontar
  useEffect(() => {
    return () => {
      // Limpar todos os elementos de áudio ao desmontar
      Object.values(audioElementsRef.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
          audio.src = '';
          audio.load();
        }
      });
      audioElementsRef.current = { 0: null, 1: null };
    };
  }, []);

  return {
    currentlyPlaying,
    currentTimes,
    durations,
    togglePlay,
    formatTime,
    audioElementsRef
  };
}
