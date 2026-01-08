import React, { useRef, useState, useEffect } from "react";
import { safeReload } from '@/utils/reload';
import { Play, Pause } from "@/utils/iconImports";
import { supabase } from "@/integrations/supabase/client";
import AudioProgressBar from "./AudioProgressBar";
import { useTranslation } from "@/hooks/useTranslation";
// Locale removido - apenas português
import { audioLog, devLog } from "@/utils/debug/devLogger";

export default function VinylPlayer() {
  const { t } = useTranslation();
  const currentLanguage = 'pt'; // Sempre português
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  // Inicializar com placeholder para vinyl aparecer imediatamente
  const [track, setTrack] = useState<{
    title: string;
    artist: string;
    audioUrl: string;
    coverUrl: string | null;
  }>({
    title: 'MusicLovely',
    artist: 'Carregando...',
    // Manter vazio no placeholder; não devemos renderizar <audio> com src vazio (gera erro no console)
    audioUrl: '',
    coverUrl: null
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLoadingTrackData, setIsLoadingTrackData] = useState(true);

  // Função para buscar música do banco de dados example_tracks
  const fetchTrackByLanguage = async (lang: string) => {
    try {
      audioLog('Buscando música para idioma: ' + lang);
      
      // Buscar música específica para o idioma na tabela example_tracks
      const { data, error } = await supabase
        .from('example_tracks')
        .select('*')
        .eq('language', lang)
        .eq('is_active', true)
        .order('display_order')
        .limit(1)
        .single();

      audioLog('Resultado da busca para ' + lang, { data, error });

      if (data && !error) {
        // Usar URL do Supabase Storage
        const STORAGE_URL = 'https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media';
        const newTrack = {
          title: data.title,
          artist: data.artist,
          audioUrl: `${STORAGE_URL}/${data.audio_path}`,
          coverUrl: data.cover_path ? `${STORAGE_URL}/${data.cover_path}` : null,
        };
        
        audioLog('Música encontrada no banco', newTrack);
        audioLog('URL do áudio: ' + newTrack.audioUrl);
        audioLog('Dados do banco', {
          title: data.title,
          artist: data.artist,
          audio_path: data.audio_path,
          cover_path: data.cover_path,
          language: data.language,
          is_active: data.is_active
        });
        
        // ✅ Não validar via HEAD em produção:
        // - Pode falhar por CORS mesmo quando o GET/stream funciona
        // - Evita requests extras e logs barulhentos
        // Em DEV verbose, ainda dá pra diagnosticar.
        if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_LOGGING === 'true') {
          try {
            const testResponse = await fetch(newTrack.audioUrl, { method: 'HEAD' });
            audioLog('Teste de URL (HEAD)', {
              url: newTrack.audioUrl,
              status: testResponse.status,
              ok: testResponse.ok
            });
          } catch (urlError) {
            audioLog('Falha no teste HEAD (ignorando)', urlError);
          }
        }
        
        return newTrack;
      } else {
        audioLog('Nenhuma música encontrada para idioma: ' + lang, error);
        
        // Tentar buscar qualquer música ativa como fallback
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('example_tracks')
          .select('*')
          .eq('is_active', true)
          .order('display_order')
          .limit(1)
          .single();
        
        if (fallbackData && !fallbackError) {
          audioLog('Usando música de fallback do banco', fallbackData);
          const STORAGE_URL = 'https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media';
          return {
            title: fallbackData.title,
            artist: fallbackData.artist,
            audioUrl: `${STORAGE_URL}/${fallbackData.audio_path}`,
            coverUrl: fallbackData.cover_path ? `${STORAGE_URL}/${fallbackData.cover_path}` : null,
          };
        }
        
        // Fallback final: usar músicas locais como backup
        const fallbackTracks = {
          'pt': {
            title: 'La na Escola',
            artist: 'MusicLovely',
            audioUrl: '/audio/la_na_escola-2.mp3',
            coverUrl: null
          },
          'en': {
            title: 'Happy Pop',
            artist: 'MusicLovely', 
            audioUrl: '/audio/pop_feliz.mp3',
            coverUrl: null
          },
          'es': {
            title: 'La na Escola',
            artist: 'MusicLovely',
            audioUrl: '/audio/la_na_escola-2.mp3',
            coverUrl: null
          }
        };
        
        const fallbackTrack = fallbackTracks[lang as keyof typeof fallbackTracks] || fallbackTracks['pt'];
        audioLog('Usando música local de fallback', fallbackTrack);
        return fallbackTrack;
      }
    } catch (error) {
      devLog.error('Erro ao buscar música', error);
      
      // Fallback final em caso de erro
      const fallbackTrack = {
        title: 'La na Escola',
        artist: 'MusicLovely',
        audioUrl: '/audio/la_na_escola-2.mp3',
        coverUrl: null
      };
      
      audioLog('Usando fallback final', fallbackTrack);
      return fallbackTrack;
    }
  };

  // Efeito para detectar mudanças de idioma e recarregar música
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const loadTrackForLanguage = async () => {
      audioLog('Carregando música (apenas português)');
      
      setIsTransitioning(true);
      setIsLoadingTrackData(true);
      
      // Parar música atual se estiver tocando
      const currentAudio = audioRef.current;
      if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        setPlaying(false);
      }
      
      // Sempre português - idiomas removidos
      const targetLanguage = 'pt';
      
      // Buscar música para português
      const newTrack = await fetchTrackByLanguage(targetLanguage);
      
      if (newTrack) {
        audioLog('Nova música carregada', newTrack);
        setTrack(newTrack);
      } else {
        audioLog('Nenhuma música encontrada, mantendo atual');
      }
      
      setIsLoadingTrackData(false);
      
      // Resetar tempo
      setTime({ current: 0, duration: 0 });
      
      // Finalizar transição com debounce
      timeoutId = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    };

    loadTrackForLanguage();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []); // Sempre português - não precisa de dependências

  // Carregar música inicial baseada no idioma atual
  useEffect(() => {
    const loadInitialTrack = async () => {
      setIsLoadingTrackData(true);
      audioLog('Carregando música inicial (português)');
      const initialTrack = await fetchTrackByLanguage('pt');
      if (initialTrack) {
        setTrack(initialTrack);
      }
      setIsLoadingTrackData(false);
    };

    loadInitialTrack();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    // Só configurar áudio se tiver uma URL válida
    if (!audio || !track.audioUrl || track.audioUrl === '') return;

    audioLog('Configurando áudio para: ' + track.audioUrl);

    // Não fazer preload automático - só carregar quando usuário apertar play
    audio.preload = 'none';
    audio.setAttribute('preload', 'none');

    const onTimeUpdate = () => {
      setTime(prev => ({ 
        current: audio.currentTime, 
        duration: prev.duration || audio.duration || 0 
      }));
    };

    const onLoadedMetadata = () => {
      audioLog('Metadados carregados, duração: ' + audio.duration);
      setTime({ current: 0, duration: audio.duration || 0 });
      // Quando metadados carregam, já podemos parar o loading inicial
      setIsLoading(false);
    };

    const onCanPlay = () => {
      audioLog('Áudio pronto para reprodução (tem dados suficientes)');
      setIsBuffering(false);
      setAudioError(null);
      
      // Se estava aguardando para tocar, começar agora
      if (playing && audio.paused) {
        audio.play().catch(err => {
          // Erro esperado em alguns navegadores; não poluir console em produção
          audioLog('Erro ao iniciar após canplay', err);
        });
      }
    };

    const onCanPlayThrough = () => {
      audioLog('Áudio totalmente carregado (buffering completo)');
      setIsBuffering(false);
    };

    const onLoadStart = () => {
      audioLog('Iniciando carregamento do áudio');
      setIsBuffering(true);
      setAudioError(null);
    };

    const onProgress = () => {
      // Mostrar progresso de buffering no console
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const duration = audio.duration || 0;
        if (duration > 0) {
          const bufferedPercent = (bufferedEnd / duration) * 100;
          audioLog('Buffered: ' + bufferedPercent.toFixed(1) + '%');
          
          // Se tem dados suficientes para tocar, parar indicador de buffering
          if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !playing) {
            setIsBuffering(false);
          }
        }
      }
    };

    const onWaiting = () => {
      // Áudio está esperando por mais dados durante a reprodução
      audioLog('Áudio aguardando dados (buffering)');
      setIsBuffering(true);
    };

    const onPlaying = () => {
      // Áudio começou a tocar, parar indicador de buffering
      audioLog('Áudio tocando normalmente');
      setIsBuffering(false);
      setIsLoading(false);
    };

    const onError = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      const error = audio.error;
      let errorMessage = 'Erro ao carregar áudio';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Reprodução cancelada';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Erro de rede - verifique sua conexão';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Formato de áudio não suportado';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Formato de áudio não suportado';
            break;
          default:
            errorMessage = `Erro de áudio (${error.code})`;
        }
      }
      
      // Erro de mídia pode ocorrer por bloqueios/formatos; evitar console em produção
      audioLog('Erro no áudio', { error, errorMessage, audioSrc: audio.src });
      setPlaying(false);
      setIsLoading(false);
      setIsBuffering(false);
      setAudioError(errorMessage);
    };

    const onEnded = () => {
      audioLog('Áudio finalizado');
      setPlaying(false);
      setTime(prev => ({ current: 0, duration: prev.duration }));
    };

    // Adicionar todos os event listeners
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("canplaythrough", onCanPlayThrough);
    audio.addEventListener("progress", onProgress);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);

    // Não carregar automaticamente - aguardar usuário clicar em play
    audioLog('Áudio configurado - aguardando play do usuário');

    return () => {
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("canplaythrough", onCanPlayThrough);
      audio.removeEventListener("progress", onProgress);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, [track?.audioUrl, playing]);


  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !track.audioUrl || track.audioUrl === '') {
      devLog.warn('Áudio ainda não carregado - aguarde');
      return;
    }

    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
        audioLog('Áudio pausado');
      } else {
        audioLog('Iniciando reprodução (streaming progressivo)');
        
        // Tentar reproduzir imediatamente - não esperar download completo
        // O áudio vai tocar assim que tiver dados suficientes (streaming)
        try {
          // Se ainda não começou a carregar, forçar carregamento
          if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
            audioLog('Forçando carregamento antes de tocar');
            audio.load();
          }
          
          await audio.play();
          setPlaying(true);
          audioLog('Reprodução iniciada - streaming em andamento');
          
        } catch (playError: any) {
          // Tratamento de erros específicos
          if (playError.name === 'NotAllowedError') {
            devLog.warn('Reprodução bloqueada pelo navegador (requer interação do usuário)');
            throw playError;
          } else if (playError.name === 'NotSupportedError') {
            setAudioError('Formato de áudio não suportado');
            throw playError;
          } else if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
            // Ainda não tem dados suficientes - mostrar buffering e aguardar
            audioLog('Aguardando buffering inicial...');
            setIsBuffering(true);
            
            // Aguardar dados e tentar novamente
            setTimeout(async () => {
              try {
                await audio.play();
                setPlaying(true);
                setIsBuffering(false);
                audioLog('Reprodução iniciada após buffering');
              } catch (retryError) {
                audioLog('Erro ao reproduzir após buffering', retryError);
                setIsBuffering(false);
                setPlaying(false);
              }
            }, 800);
          } else {
            throw playError;
          }
        }
      }
    } catch (error) {
      audioLog('Erro ao controlar reprodução', error);
      setIsLoading(false);
      setIsBuffering(false);
      setPlaying(false);
    }
  };

  const handleSeek = (newTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (!isNaN(newTime) && newTime >= 0 && newTime <= time.duration) {
      audio.currentTime = newTime;
      setTime(prev => ({ ...prev, current: newTime }));
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };

  if (audioError) {
    return (
      <section
        id="radiola"
        className="glass rounded-3xl p-4 md:p-6 shadow-glass border border-border/50 h-full min-h-[400px] flex items-center justify-center"
      >
        <div className="text-center">
          <p className="text-red-500 mb-2">❌ Erro no áudio</p>
          <p className="text-xs text-muted-foreground mb-3">{audioError}</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => {
                setAudioError(null);
                setIsLoading(true);
                // Tentar recarregar a música atual
                if (track) {
                  const audio = audioRef.current;
                  if (audio) {
                    audio.load();
                  }
                }
              }} 
              className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/80"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={() => safeReload({ reason: 'VinylPlayer' })} 
              className="px-3 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      </section>
    );
  }


  return (
    <section
      id="radiola"
      className="glass rounded-2xl sm:rounded-3xl p-2 sm:p-4 md:p-6 shadow-glass border border-border/50 w-full h-full min-h-[400px] flex flex-col justify-center overflow-hidden"
    >
      <div className="w-full mx-auto">
        <h2 id="radiola-title" tabIndex={-1} className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-foreground text-center mb-1 outline-none">
          {t('vinyl.title')}
        </h2>
        <p className="text-muted-foreground mb-2 sm:mb-4 text-center text-xs px-2">
          {t('vinyl.subtitle')}
        </p>

        {/* Vinyl Record */}
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-52 lg:h-52 mx-auto mb-2 sm:mb-4">
        <div
          className={`relative w-full h-full rounded-full shadow-soft transition-all duration-300 vinyl-spin-realistic ${
            playing ? "vinyl-playing" : "vinyl-paused"
          } ${isTransitioning ? "opacity-50 scale-95" : "opacity-100 scale-100"}`}
        >
          {/* Vinyl disc */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900" />
          
          {/* Grooves effect */}
          <div className="absolute inset-4 rounded-full border-[20px] border-neutral-700/30" />
          <div className="absolute inset-8 rounded-full border-[15px] border-neutral-700/20" />
          <div className="absolute inset-12 rounded-full border-[10px] border-neutral-700/10" />

          {/* Center label with cover */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-card border-4 border-card shadow-soft overflow-hidden">
            {track.coverUrl ? (
              <img 
                src={track.coverUrl} 
                alt={track.title}
                className={`w-full h-full object-cover vinyl-spin-slow ${
                  playing ? "vinyl-playing" : "vinyl-paused"
                }`}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <span className={`text-2xl vinyl-spin-slow ${
                  playing ? "vinyl-playing" : "vinyl-paused"
                }`}>🎵</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track Info */}
      <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-foreground mb-0.5 text-center px-2">
          {track.title}
        </h3>
        {track.artist && (
          <p className={`text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 text-center px-2 ${isLoadingTrackData ? 'animate-pulse' : ''}`}>
            {track.artist}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full mb-2 sm:mb-3">
        <AudioProgressBar
          current={time.current}
          duration={time.duration}
          isLoaded={time.duration > 0}
          onSeek={handleSeek}
          showTimeLabels={true}
        />
      </div>

      {/* Play/Pause Button */}
      <div className="flex justify-center">
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white grid place-items-center shadow-soft transition-all hover:scale-105 ${
            isLoading
              ? 'bg-muted cursor-not-allowed' 
              : 'bg-primary hover:bg-primary-600'
          }`}
        >
          {isLoading ? (
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : playing ? (
            <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
          )}
        </button>
      </div>
      </div>

      {/* ✅ Evitar erro do navegador com src vazio (gera "Erro no elemento audio" no console) */}
      {track.audioUrl ? (
        <audio
          ref={audioRef}
          src={track.audioUrl}
          preload="none"
          crossOrigin="anonymous"
        />
      ) : null}
    </section>
  );
}
