import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Music, Calendar, Mail, AlertCircle, Trash2, RefreshCw, Send, Copy, Check, Loader2, Search, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmbeddedMusicPlayer } from "@/components/admin/EmbeddedMusicPlayer";
import { useReleases, useReleaseMutation } from "@/hooks/useAdminData";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { sendReleaseWebhook } from "@/utils/webhook";

/**
 * Função helper para validar e corrigir URLs de imagens do Supabase Storage
 * Se a URL for um path relativo, tenta gerar a URL pública
 */
const getValidImageUrl = async (coverUrl: string | null | undefined): Promise<string | null> => {
  if (!coverUrl) return null;
  
  // Se já for uma URL completa (http/https), usar diretamente
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl;
  }
  
  // Se for um path do Supabase Storage, tentar gerar URL pública
  try {
    // Extrair o path do bucket (formato: order_id/timestamp_cover.jpg)
    const path = coverUrl.startsWith('generated-songs/') 
      ? coverUrl.replace('generated-songs/', '')
      : coverUrl;
    
    const { data } = supabase.storage
      .from('generated-songs')
      .getPublicUrl(path);
    
    if (data?.publicUrl) {
      return data.publicUrl;
    }
  } catch (error) {
    console.warn('⚠️ [AdminReleases] Erro ao gerar URL pública para imagem:', coverUrl, error);
  }
  
  // Fallback: retornar URL original
  return coverUrl;
};

export default function AdminReleases() {
  // ✅ OTIMIZAÇÃO: Usar React Query para cache automático
  const { data: orders, isLoading: loading, refetch } = useReleases();
  const releaseMutation = useReleaseMutation();
  
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // ✅ NOVO: Rastrear cards que foram enviados para remover imediatamente
  const [sentOrderIds, setSentOrderIds] = useState<Set<string>>(new Set());
  // ✅ NOVO: Rastrear URLs de imagens que falharam ao carregar
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  // ✅ OTIMIZAÇÃO: React Query cuida do cache, apenas configurar realtime para updates
  useEffect(() => {
    let channel: any = null;
    
    // ✅ CORREÇÃO ERRO 401: Verificar autenticação antes de criar subscription
    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // Não criar subscription se não autenticado
        
        channel = supabase
          .channel('releases-realtime')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'songs' }, () => {
            refetch();
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'songs',
            filter: 'status=eq.released'
          }, () => {
            refetch();
          })
          .subscribe();
      } catch (error) {
        // Erro ao verificar autenticação ou criar subscription
        // Não fazer nada - a página continuará funcionando sem Realtime
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refetch]);

  // ✅ OTIMIZAÇÃO: loadReleases removida - useReleases hook cuida do carregamento com cache

  const deleteSong = async (songId: string, songTitle: string) => {
    // Confirmação antes de deletar
    if (!confirm(`Tem certeza que deseja deletar a música "${songTitle}"?\n\nArquivos de áudio e capas serão removidos permanentemente.\nAs letras serão preservadas.`)) {
      return;
    }

    try {
      setDeletingSongId(songId);
      console.log(`🗑️  Deletando música: ${songId}`);

      const { data, error } = await supabase.functions.invoke('admin-delete-song', {
        body: { song_id: songId }
      });

      if (error) {
        throw error;
      }

      toast.success(`✅ Música "${songTitle}" deletada com sucesso!`);

      // ✅ OTIMIZAÇÃO: React Query cuida do refetch
      refetch();
    } catch (error: any) {
      console.error('❌ Erro ao deletar música:', error);
      toast.error(`Erro ao deletar: ${error?.message || error?.error?.message || 'Erro desconhecido'}`);
    } finally {
      setDeletingSongId(null);
    }
  };

  const releaseNow = async (orderIds: string | string[]) => {
    // ✅ CORREÇÃO: Aceitar string ou array de order_ids para suportar agrupamento por email
    const orderIdsArray = Array.isArray(orderIds) ? orderIds : [orderIds];
    
    if (!orderIdsArray || orderIdsArray.length === 0 || orderIdsArray.some(id => !id || typeof id !== 'string' || id.trim() === '')) {
      toast.error('ID(s) do(s) pedido(s) inválido(s)');
      console.error('❌ [AdminReleases] ID(s) do(s) pedido(s) inválido(s):', orderIdsArray);
      return;
    }

    try {
      // Não setar processingOrderId aqui - já está sendo feito no onClick do botão
      console.log("🚀 [AdminReleases] Liberando pedido(s) agora:", orderIdsArray);
      
      // 1. Buscar músicas dos pedidos que estão prontas para liberar (mesmo filtro do card)
      // ✅ CORREÇÃO: Buscar apenas músicas com status 'ready', sem released_at e com audio_url
      // Isso garante que só tentamos liberar as músicas que aparecem no card
      const { data: songs, error: fetchError } = await supabase
        .from('songs')
        .select('id, variant_number, title, audio_url, status, order_id, released_at')
        .in('order_id', orderIdsArray) // ✅ Buscar de todos os pedidos
        .eq('status', 'ready') // ✅ Apenas músicas prontas
        .is('released_at', null) // ✅ Apenas não liberadas
        .order('variant_number', { ascending: true });

      if (fetchError) {
        console.error("❌ [AdminReleases] Erro ao buscar músicas:", fetchError);
        throw new Error(`Erro ao buscar músicas: ${fetchError.message || 'Erro desconhecido'}`);
      }
      
      // ✅ CORREÇÃO: Se não encontrou músicas com status 'ready', verificar se há músicas com outros status válidos
      if (!songs || songs.length === 0) {
        console.log("⚠️ [AdminReleases] Nenhuma música com status 'ready' encontrada. Verificando outros status...");
        
        // Buscar todas as músicas dos pedidos para debug
        const { data: allSongs, error: allSongsError } = await supabase
          .from('songs')
          .select('id, variant_number, title, audio_url, status, order_id, released_at')
          .in('order_id', orderIdsArray)
          .order('variant_number', { ascending: true });
        
        if (!allSongsError && allSongs && allSongs.length > 0) {
          console.log(`📊 [AdminReleases] Encontradas ${allSongs.length} música(s) total(is) para os pedidos:`, 
            allSongs.map(s => ({ 
              id: s.id, 
              title: s.title, 
              status: s.status, 
              has_audio: !!s.audio_url,
              has_released_at: !!s.released_at 
            }))
          );
          
          // Verificar se há músicas com audio_url mas status diferente de 'ready'
          const songsWithAudioButNotReady = allSongs.filter(s => 
            s.audio_url && 
            s.audio_url.trim() !== '' && 
            s.status !== 'ready' && 
            !s.released_at
          );
          
          if (songsWithAudioButNotReady.length > 0) {
            console.log(`⚠️ [AdminReleases] Encontradas ${songsWithAudioButNotReady.length} música(s) com áudio mas status diferente de 'ready':`, 
              songsWithAudioButNotReady.map(s => ({ id: s.id, title: s.title, status: s.status }))
            );
            throw new Error(`Encontradas ${songsWithAudioButNotReady.length} música(s) com áudio mas status '${songsWithAudioButNotReady[0].status}' (esperado: 'ready'). Verifique o status das músicas.`);
          }
        }
        
        throw new Error('Nenhuma música encontrada para este pedido. Verifique se há músicas com status "ready" e sem released_at.');
      }

      // ✅ CORREÇÃO: Filtrar manualmente músicas sem audio_url (fallback adicional)
      // Mesmo que o filtro do Supabase funcione, garantimos que só processamos músicas com áudio
      const songsWithAudio = songs.filter(s => s.audio_url && s.audio_url.trim() !== '');
      
      if (songsWithAudio.length === 0) {
        throw new Error('Nenhuma música com áudio encontrada');
      }
      
      // ✅ CORREÇÃO: Se houver mais de 2 músicas, selecionar apenas as 2 mais recentes
      let songsToRelease = songsWithAudio;
      if (songsWithAudio.length > 2) {
        console.log(`⚠️ [AdminReleases] Encontradas ${songsWithAudio.length} músicas. Selecionando apenas as 2 mais recentes.`);
        // Ordenar por created_at descendente (mais recente primeiro) ou variant_number descendente
        songsToRelease = [...songsWithAudio].sort((a, b) => {
          // Tentar ordenar por created_at primeiro, se disponível
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          // Fallback: ordenar por variant_number (maior = mais recente)
          return (b.variant_number || 0) - (a.variant_number || 0);
        }).slice(0, 2); // Pegar apenas as 2 primeiras (mais recentes)
      }
      
      // ✅ VALIDAÇÃO: Garantir que temos pelo menos 2 músicas para liberar
      if (songsToRelease.length < 2) {
        throw new Error(`É necessário ter pelo menos 2 músicas para enviar. Encontradas ${songsToRelease.length} música(s) válida(s) de ${songsWithAudio.length} total.`);
      }
      
      // Verificar se todas têm audio_url - se não, verificar jobs.suno_audio_url como fallback
      const songsWithoutAudio = songs.filter(s => !s.audio_url || s.audio_url.trim() === '');
      
      if (songsWithoutAudio.length > 0) {
        console.log(`⚠️ [AdminReleases] ${songsWithoutAudio.length} música(s) sem audio_url, verificando jobs...`);
        
        // Para cada música sem áudio, verificar se há job com suno_audio_url
        const songsToFix = [];
        
        for (const song of songsWithoutAudio) {
          // Buscar jobs do pedido com suno_audio_url
          const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, suno_audio_url, status')
            .eq('order_id', song.order_id)
            .not('suno_audio_url', 'is', null)
            .neq('suno_audio_url', '')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!jobsError && jobs && jobs.length > 0) {
            const job = jobs[0];
            const audioUrl = job.suno_audio_url;
            
            if (audioUrl && audioUrl.trim() !== '') {
              console.log(`   🔧 Encontrado suno_audio_url no job ${job.id} para song ${song.id}, atualizando...`);
              
              // Atualizar song com audio_url do job
              const { error: updateError } = await supabase
                .from('songs')
                .update({
                  audio_url: audioUrl,
                  updated_at: new Date().toISOString()
                })
                .eq('id', song.id);
              
              if (!updateError) {
                songsToFix.push(song.id);
              } else {
                console.error(`❌ Erro ao atualizar song ${song.id}:`, updateError);
              }
            }
          }
        }
        
        // Remover das songsWithoutAudio as que foram corrigidas
        const stillWithoutAudio = songsWithoutAudio.filter(s => !songsToFix.includes(s.id));
        
        if (stillWithoutAudio.length > 0) {
          // Verificar se há jobs processando
          const orderIds = [...new Set(stillWithoutAudio.map(s => s.order_id))];
          const { data: processingJobs } = await supabase
            .from('jobs')
            .select('order_id, status, error')
            .in('order_id', orderIds)
            .eq('status', 'processing');
          
          const hasProcessingJobs = processingJobs && processingJobs.length > 0;
          
          const missingTitles = stillWithoutAudio.map(s => s.title || `V${s.variant_number}`).join(', ');
          
          if (hasProcessingJobs) {
            throw new Error(`${stillWithoutAudio.length} música(s) ainda sem áudio: ${missingTitles}. Aguarde o processamento do áudio.`);
          } else {
            throw new Error(`${stillWithoutAudio.length} música(s) ainda sem áudio: ${missingTitles}. Verifique se o áudio foi gerado corretamente.`);
          }
        }
      }

      // Verificar se há músicas que já foram liberadas
      const alreadyReleased = songs.filter(s => s.status === 'released' && s.released_at);
      if (alreadyReleased.length > 0) {
        console.warn(`⚠️ [AdminReleases] ${alreadyReleased.length} música(s) já foi(ram) liberada(s)`);
      }

      // 2. Atualizar todas para 'released' (apenas as que estão prontas e não foram liberadas)
      const now = new Date().toISOString();
      
      // ✅ CORREÇÃO: Usar os IDs das músicas que foram validadas (com áudio)
      // Isso garante que só atualizamos as músicas que realmente podem ser liberadas
      // ✅ CORREÇÃO: Usar songsToRelease (já filtrado para as 2 mais recentes se houver mais de 2)
      const songIdsToRelease = songsToRelease.map(s => s.id);
      
      if (songIdsToRelease.length === 0) {
        throw new Error('Nenhuma música válida para liberar após validação');
      }
      
      console.log(`📝 [AdminReleases] Atualizando ${songIdsToRelease.length} música(s) para 'released'...`);
      
      const { data: updatedSongs, error: updateError } = await supabase
        .from('songs')
        .update({ 
          released_at: now, 
          status: 'released',
          updated_at: now
        })
        .in('id', songIdsToRelease) // ✅ Usar IDs específicos em vez de order_id
        .select();

      if (updateError) {
        console.error("❌ [AdminReleases] Erro ao atualizar músicas:", updateError);
        throw new Error(`Erro ao atualizar músicas: ${updateError.message || 'Erro desconhecido'}`);
      }

      // Validação crítica: verificar se status foi realmente atualizado
      if (!updatedSongs || updatedSongs.length === 0) {
        // Se não atualizou nenhuma, pode ser que todas já estejam released
        const allAlreadyReleased = songs.every(s => s.status === 'released');
        if (allAlreadyReleased) {
          toast.info('Todas as músicas deste pedido já foram liberadas anteriormente');
          refetch();
          return;
        }
        throw new Error('Nenhuma música foi atualizada. Verifique os dados.');
      }

      const allReleased = updatedSongs.every(s => s.status === 'released' && s.released_at);
      if (!allReleased) {
        console.error("❌ [AdminReleases] ERRO: Nem todas as músicas foram marcadas como 'released'");
        const failed = updatedSongs.filter(s => s.status !== 'released' || !s.released_at);
        console.error('Músicas que falharam:', failed);
        throw new Error('Falha ao atualizar status de algumas músicas para released');
      }

      console.log(`✅ [AdminReleases] ${updatedSongs.length} música(s) marcada(s) como 'released'`);

      // 3. Buscar dados completos do pedido para webhook e email
      const firstSong = songsToRelease[0];
      const orderIdForEmail = firstSong.order_id || orderIdsArray[0];
      
      // Buscar order completo com customer_whatsapp e quiz para obter "about"
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          customer_email,
          customer_whatsapp,
          plan,
          magic_token,
          quiz_id,
          quizzes:quiz_id (
            about_who
          )
        `)
        .eq('id', orderIdForEmail)
        .single();

      if (orderError) {
        console.warn("⚠️ [AdminReleases] Erro ao buscar dados do pedido para webhook:", orderError);
      }

      const about = (orderData?.quizzes as any)?.about_who || 'N/A';

      // 4. Enviar email e webhook em paralelo
      console.log("📧 [AdminReleases] Enviando email com primeira música:", firstSong.id, "para pedido:", orderIdForEmail);
      
      try {
        // Enviar email e webhook em paralelo
        const [emailResult, webhookResult] = await Promise.allSettled([
          // Enviar email
          supabase.functions.invoke(
          'send-music-released-email', 
          { 
            body: { 
              songId: firstSong.id, 
              orderId: orderIdForEmail,
              force: true  // Sempre força envio quando admin clica no botão
            } 
          }
          ),
          // Enviar webhook (apenas se tiver dados do pedido)
          orderData ? sendReleaseWebhook(
            {
              id: orderData.id,
              customer_email: orderData.customer_email || '',
              customer_whatsapp: orderData.customer_whatsapp || null,
              plan: orderData.plan || 'unknown',
              magic_token: orderData.magic_token || ''
            },
            songsToRelease.map(s => ({
              id: s.id,
              title: s.title || 'Música sem título',
              variant_number: s.variant_number || 1,
              audio_url: s.audio_url || undefined
            })),
            about
          ) : Promise.resolve()
        ]);
        
        // Processar resultado do email
        if (emailResult.status === 'fulfilled') {
          const { data: emailResponse, error: emailError } = emailResult.value;
        
        if (emailError) {
          console.error("❌ [AdminReleases] Erro ao enviar email:", emailError);
          // Não bloquear o fluxo se o email falhar - músicas já foram liberadas
          toast.warning(`Músicas liberadas, mas houve erro ao enviar email: ${emailError.message || 'Erro desconhecido'}`);
        } else {
          toast.success(`✅ ${updatedSongs.length} música(s) liberada(s) e email enviado!`);
          }
        } else {
          console.error("❌ [AdminReleases] Exceção ao enviar email:", emailResult.reason);
          toast.warning(`Músicas liberadas, mas houve erro ao enviar email: ${emailResult.reason?.message || 'Erro desconhecido'}`);
        }

        // Processar resultado do webhook (apenas log, não mostrar toast)
        if (webhookResult.status !== 'fulfilled') {
          console.error("❌ [AdminReleases] Erro ao enviar webhook (não bloqueante):", webhookResult.reason);
        }
      } catch (emailException: any) {
        console.error("❌ [AdminReleases] Exceção ao enviar email:", emailException);
        // Não bloquear o fluxo se o email falhar
        toast.warning(`Músicas liberadas, mas houve erro ao enviar email: ${emailException.message || 'Erro desconhecido'}`);
      }
      
      // ✅ OTIMIZAÇÃO: React Query cuida do refetch automático via mutation
      // Não precisa chamar refetch aqui - a mutation já invalida o cache
      
    } catch (error: any) {
      console.error("❌ [AdminReleases] Erro completo ao liberar:", error);
      
      // Extrair mensagem de erro detalhada
      let errorMessage = 'Erro desconhecido ao liberar músicas';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      }
      
      toast.error(`Erro ao liberar músicas: ${errorMessage}`);
      // Não resetar processingOrderId aqui - já está sendo feito no onClick do botão
    }
  };


  const handleCopyEmail = async (email: string) => {
    if (!email) {
      toast.error('Email não disponível');
      return;
    }

    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      toast.success('Email copiado!');
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      // Fallback para navegadores que não suportam clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = email;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedEmail(email);
        toast.success('Email copiado!');
        setTimeout(() => setCopiedEmail(null), 2000);
      } catch (err) {
        toast.error('Erro ao copiar email');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  // ✅ MELHORIA: Filtrar e ordenar pedidos
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    let filtered = [...orders];
    
    // ✅ NOVO: Remover cards que foram enviados (removidos localmente)
    filtered = filtered.filter(order => !sentOrderIds.has(order.id));
    
    // Filtro de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.email?.toLowerCase().includes(term) ||
        order.about?.toLowerCase().includes(term) ||
        order.songs?.some((song: any) => song.title?.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [orders, searchTerm, sentOrderIds]);


  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Lista atualizada!");
    } catch (error) {
      toast.error("Erro ao atualizar lista");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ready: { 
        label: 'Pronta', 
        className: 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0' 
      },
      approved: { 
        label: 'Agendada', 
        className: 'bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground border-0' 
      },
      released: { 
        label: 'Enviada', 
        className: 'bg-gradient-to-r from-muted to-muted/60 text-muted-foreground border border-border' 
      },
    };
    
    const config = variants[status as keyof typeof variants] || { 
      label: status, 
      className: 'bg-muted text-muted-foreground' 
    };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto p-2 md:p-6 space-y-2 md:space-y-6">
        {/* Header compacto com busca na mesma linha */}
        <div className="mb-2 md:mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Releases
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">
                Aprovações e envios
              </p>
            </div>
            
            {/* Busca na mesma linha do título */}
            {!loading && orders && orders.length > 0 && (
              <div className="flex-1 ml-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    placeholder="Buscar por email, nome ou música..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 pr-10 w-full"
                    style={{ paddingLeft: '2.75rem' }}
                    aria-label="Buscar pedidos"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 hover:bg-muted"
                      onClick={() => setSearchTerm("")}
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              {!loading && orders && (
                <Badge variant="secondary" className="text-[10px] md:text-sm px-2 md:px-3 py-0.5 md:py-1">
                  {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRefreshing || loading}
                    className="h-8 w-8"
                    aria-label="Atualizar lista"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Atualizar lista</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      
      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Carregando releases...</p>
          </div>
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card className="admin-card-compact border-dashed border-2 border-border/50 bg-gradient-to-br from-muted/30 to-transparent">
          <CardContent className="p-4 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-muted to-muted/50 mb-2 md:mb-4">
              <Music className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">Nenhuma música para liberar</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-xs md:text-sm">
              Quando músicas estiverem prontas, elas aparecerão aqui para aprovação e envio.
            </p>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="admin-card-compact border-dashed border-2 border-border/50 bg-gradient-to-br from-muted/30 to-transparent">
          <CardContent className="p-4 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-muted to-muted/50 mb-2 md:mb-4">
              <Search className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">Nenhum resultado encontrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-xs md:text-sm">
              Tente ajustar os filtros de busca.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
              }}
              className="mt-4"
            >
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4">
          {filteredOrders.map(order => (
            <Card 
              key={order.id} 
              className="admin-card-compact group overflow-hidden border-primary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300"
            >
              <CardContent className="p-1.5 md:p-3">
                {/* Order Header - Layout Horizontal Compacto */}
                <div className="space-y-1 mb-2 pb-1.5 border-b border-border/50">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold truncate">
                      {order.about}
                    </h3>
                    <div className="flex items-center gap-1 group/email">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-1 min-w-0">
                        <Mail className="h-2.5 w-2.5 flex-shrink-0" />
                        <span 
                          className="truncate select-text cursor-text"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            const range = document.createRange();
                            range.selectNodeContents(e.currentTarget);
                            const selection = window.getSelection();
                            selection?.removeAllRanges();
                            selection?.addRange(range);
                          }}
                          title="Duplo clique para selecionar"
                        >
                          {order.email}
                        </span>
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyEmail(order.email);
                        }}
                        className="opacity-0 group-hover/email:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                        title="Copiar email"
                      >
                        {copiedEmail === order.email ? (
                          <Check className="h-2.5 w-2.5 text-green-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </div>
                    <Badge variant="secondary" className="text-[9px] w-fit px-1.5 py-0">
                      {order.plan === 'express' ? '⚡ Express (48h)' : '📅 Standard (7 dias)'}
                    </Badge>
                  </div>
                </div>
                
                {/* Botão Enviar */}
                <div className="mb-2">
                  {(() => {
                    const songsCount = order.songs?.length || 0;
                    // ✅ CORREÇÃO: Permitir envio quando houver pelo menos 1 música pronta
                    const hasEnoughSongs = songsCount >= 1;
                    const isThisCardLoading = releasingOrderId === order.id;
                    // ✅ CORREÇÃO: Remover releaseMutation.isPending para permitir múltiplos envios paralelos
                    const isDisabled = isThisCardLoading || !hasEnoughSongs;
                    
                    // ✅ DEBUG: Log do estado do botão
                    if (isDisabled) {
                      console.log(`🔒 [AdminReleases] Botão desabilitado para ${order.id}:`, {
                        isThisCardLoading,
                        hasEnoughSongs,
                        songsCount,
                        releasingOrderId
                      });
                    }
                    
                    return (
                      <Button
                        onClick={async () => {
                          // ✅ LOG INICIAL: Garantir que o onClick está sendo executado
                          console.log('🖱️ [AdminReleases] ===== BOTÃO CLICADO =====');
                          console.log('🖱️ [AdminReleases] Order:', order.id);
                          console.log('🖱️ [AdminReleases] Songs count:', songsCount);
                          console.log('🖱️ [AdminReleases] hasEnoughSongs:', hasEnoughSongs);
                          console.log('🖱️ [AdminReleases] isDisabled:', isDisabled);
                          
                          if (!hasEnoughSongs) {
                            console.warn('⚠️ [AdminReleases] Não há músicas suficientes');
                            toast.error(`É necessário ter pelo menos 1 música pronta para enviar. Atualmente há ${songsCount} música(s).`);
                            return;
                          }
                          
                          // ✅ CORREÇÃO: Validar order_ids antes de usar
                          if (!order.order_ids || !Array.isArray(order.order_ids) || order.order_ids.length === 0) {
                            console.error('❌ [AdminReleases] order.order_ids inválido:', order.order_ids);
                            toast.error('Erro: IDs dos pedidos não encontrados. Por favor, recarregue a página.');
                            return;
                          }
                          
                          const orderIdToRelease = order.id; // groupKey para controle de estado
                          console.log('🔄 [AdminReleases] Definindo estado de loading para:', orderIdToRelease);
                          setReleasingOrderId(orderIdToRelease);
                          
                          // ✅ CORREÇÃO CRÍTICA: Timeout de segurança para garantir que o estado seja resetado
                          const timeoutId = setTimeout(() => {
                            console.warn('⚠️ [AdminReleases] TIMEOUT: Operação demorou mais de 60 segundos, resetando estado...');
                            setReleasingOrderId((current) => {
                              if (current === orderIdToRelease) {
                                console.log('🔄 [AdminReleases] [Timeout] Resetando estado de loading');
                                return null;
                              }
                              return current;
                            });
                          }, 60000); // 60 segundos de timeout
                          
                          try {
                            // ✅ CORREÇÃO: Adicionar timeout na mutation para evitar travamento
                            const mutationPromise = releaseMutation.mutateAsync({
                              orderIds: order.order_ids,
                              songs: order.songs // ✅ Passar músicas já carregadas
                            });
                            
                            const mutationTimeout = new Promise((_, reject) => 
                              setTimeout(() => reject(new Error('Mutation timeout após 30 segundos')), 30000)
                            );
                            
                            await Promise.race([mutationPromise, mutationTimeout]);
                            
                            // ✅ NOVO: Remover card imediatamente da lista local após sucesso da mutation
                            setSentOrderIds(prev => new Set(prev).add(orderIdToRelease));
                            
                            // ✅ CORREÇÃO: Forçar refetch imediato após sucesso para atualizar a lista
                            // Aguardar um pouco para garantir que o banco foi atualizado
                            await new Promise(resolve => setTimeout(resolve, 300));
                            
                            try {
                              await refetch();
                              
                              // ✅ NOVO: O card já foi removido localmente e o refetch confirmou
                              // Se o refetch trouxer o card de volta (erro no envio), ele aparecerá novamente
                              // após limpar o estado de remoção local
                              setTimeout(() => {
                                setSentOrderIds(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(orderIdToRelease);
                                  return newSet;
                                });
                              }, 500);
                            } catch (refetchError) {
                              console.error('❌ [AdminReleases] Erro no refetch:', refetchError);
                              // Se o refetch falhar, manter o card removido localmente
                              // O próximo refetch automático ou manual trará o card de volta se necessário
                            }
                          } catch (error: any) {
                            // Erro já tratado pelo onError do mutation
                            console.error('❌ [AdminReleases] Erro ao processar release:', error);
                            // Não mostrar toast aqui pois o onError do mutation já mostra
                          } finally {
                            // ✅ CORREÇÃO CRÍTICA: Limpar timeout e resetar estado SEMPRE
                            clearTimeout(timeoutId);
                            setReleasingOrderId((current) => {
                              if (current === orderIdToRelease) {
                                return null;
                              }
                              console.log('⚠️ [AdminReleases] [Finally] Estado já foi alterado, mantendo:', current);
                              return current;
                            });
                          }
                        }}
                        disabled={isDisabled}
                        className="w-full bg-[#B88860] hover:bg-[#A67850] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-70 text-xs py-1.5 h-8"
                        title={!hasEnoughSongs ? `É necessário ter pelo menos 2 músicas para enviar. Atualmente há ${songsCount} música(s).` : songsCount > 2 ? `Enviar as 2 músicas mais recentes (de ${songsCount} disponíveis)` : 'Enviar músicas'}
                      >
                        {isThisCardLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                            Enviando...
                          </>
                        ) : !hasEnoughSongs ? (
                          <>
                            <AlertCircle className="w-4 h-4 mr-1.5" />
                            Aguardando 2 músicas ({songsCount}/2)
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1.5" />
                            Enviar
                          </>
                        )}
                      </Button>
                    );
                  })()}
                </div>
                
                {/* Songs Grid - Layout Responsivo (apenas 2 músicas) */}
                <div className="grid grid-cols-2 gap-1.5">
                  {/* ✅ VALIDAÇÃO: Garantir que apenas 2 músicas sejam exibidas */}
                  {order.songs.slice(0, 2).map((song: any) => (
                    <Card key={song.id} className="w-full min-w-0 overflow-hidden border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-0">
                        {/* Capa estilo iPod - Bordas autênticas */}
                        <div className="p-0.5">
                          <div className="relative rounded-lg overflow-hidden border border-gray-800 shadow-md bg-black mx-auto" style={{ width: '100%', aspectRatio: '1' }}>
                            {song.cover_url && !failedImageUrls.has(song.cover_url) ? (
                              <img 
                                src={song.cover_url} 
                                alt={song.title}
                                className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform duration-300"
                                onClick={() => setSelectedCover(song.cover_url)}
                                onError={async (e) => {
                                  const target = e.target as HTMLImageElement;
                                  const failedUrl = target.src;
                                  
                                  console.error('❌ [AdminReleases] Erro ao carregar imagem da capa:', {
                                    songId: song.id,
                                    songTitle: song.title,
                                    coverUrl: song.cover_url,
                                    attemptedUrl: failedUrl
                                  });
                                  
                                  // Marcar URL como falhada
                                  setFailedImageUrls(prev => new Set(prev).add(song.cover_url!));
                                  
                                  // Tentar gerar URL válida do Supabase Storage
                                  const validUrl = await getValidImageUrl(song.cover_url);
                                  if (validUrl && validUrl !== song.cover_url) {
                                    console.log('🔄 [AdminReleases] Tentando URL alternativa:', validUrl);
                                    target.src = validUrl;
                                    // Remover da lista de falhas se a nova URL funcionar
                                    setFailedImageUrls(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(song.cover_url!);
                                      return newSet;
                                    });
                                  } else {
                                    // Se não conseguir URL alternativa, esconder imagem e mostrar placeholder
                                    target.style.display = 'none';
                                    const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                                    if (placeholder) {
                                      placeholder.style.display = 'flex';
                                    }
                                  }
                                }}
                                onLoad={() => {
                                  // Remover da lista de falhas quando carregar com sucesso
                                  if (failedImageUrls.has(song.cover_url!)) {
                                    setFailedImageUrls(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(song.cover_url!);
                                      return newSet;
                                    });
                                  }
                                  // Esconder placeholder quando imagem carregar
                                  const placeholder = document.querySelector(`[data-song-id="${song.id}"] .image-placeholder`) as HTMLElement;
                                  if (placeholder) {
                                    placeholder.style.display = 'none';
                                  }
                                }}
                              />
                            ) : null}
                            {/* Placeholder que aparece quando não há cover_url ou quando há erro */}
                            <div 
                              className={`image-placeholder w-full h-full flex items-center justify-center bg-muted ${song.cover_url && !failedImageUrls.has(song.cover_url) ? 'hidden' : ''}`}
                              data-song-id={song.id}
                            >
                              <Music className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Título + Versão */}
                        <div className="px-1 pb-1 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <h3 className="font-semibold text-xs mb-0.5 truncate cursor-help" title={song.title}>
                                {song.title}
                              </h3>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{song.title}</p>
                              {song.created_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Criada em {format(new Date(song.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-[10px] text-muted-foreground">V{song.variant_number}</p>
                          {song.created_at && (
                            <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                              {format(new Date(song.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        
                        {/* Player Embutido */}
                        <div className="px-1 pb-1">
                          {song.audio_url ? (
                            <EmbeddedMusicPlayer 
                              audioUrl={song.audio_url}
                              compact
                            />
                          ) : (
                            <div className="text-center space-y-0.5 py-0.5">
                              <div className="w-3 h-3 rounded-full bg-muted animate-pulse mx-auto" />
                              <p className="text-[9px] text-muted-foreground">Processando...</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Badges de Status */}
                        <div className="px-1 pb-1 flex flex-wrap justify-center gap-0.5">
                          {getStatusBadge(song.status)}
                          
                          {song.release_at && song.status === 'approved' && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              <Calendar className="w-2.5 h-2.5 mr-0.5" />
                              {format(new Date(song.release_at), "dd/MM HH:mm", { locale: ptBR })}
                            </Badge>
                          )}
                          
                          {song.email_sent && (
                            <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200 px-1 py-0">
                              <Mail className="w-2.5 h-2.5 mr-0.5" />
                              Enviado
                            </Badge>
                          )}
                        </div>

                        {/* Botão Deletar */}
                        <div className="px-1 pb-1">
                          <Button
                            onClick={() => deleteSong(song.id, song.title || 'Música')}
                            disabled={deletingSongId === song.id}
                            variant="destructive"
                            size="sm"
                            className="w-full text-[10px] px-2 py-1 h-6"
                          >
                            {deletingSongId === song.id ? (
                              <>
                                <div className="w-2.5 h-2.5 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Deletando...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3 h-3 mr-1" />
                                Deletar
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cover Modal com backdrop blur */}
      <Dialog 
        open={!!selectedCover} 
        onOpenChange={(open) => {
          // ✅ CORREÇÃO: Garantir que o Dialog fecha corretamente
          if (!open) {
            setSelectedCover(null);
          }
        }}
      >
        <DialogContent 
          className="max-w-4xl p-0 border-0 bg-transparent shadow-none"
          onEscapeKeyDown={() => setSelectedCover(null)}
          onPointerDownOutside={() => setSelectedCover(null)}
          onInteractOutside={() => setSelectedCover(null)}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Preview da capa</DialogTitle>
            <DialogDescription>Visualização ampliada da capa selecionada.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            {selectedCover && (
              <>
                {/* Backdrop blur effect */}
                <div className="absolute inset-0 -z-10 backdrop-blur-3xl bg-black/40 rounded-2xl" />
                <img 
                  src={selectedCover} 
                  alt="Capa ampliada" 
                  className="w-full rounded-2xl shadow-2xl ring-1 ring-white/10" 
                  onError={async (e) => {
                    const target = e.target as HTMLImageElement;
                    console.error('❌ [AdminReleases] Erro ao carregar imagem ampliada:', {
                      coverUrl: selectedCover,
                      attemptedUrl: target.src
                    });
                    
                    // Tentar gerar URL válida do Supabase Storage
                    const validUrl = await getValidImageUrl(selectedCover);
                    if (validUrl && validUrl !== selectedCover) {
                      console.log('🔄 [AdminReleases] Tentando URL alternativa para modal:', validUrl);
                      target.src = validUrl;
                    } else {
                      // Se não conseguir URL alternativa, fechar o dialog
                      console.error('❌ [AdminReleases] Não foi possível carregar a imagem, fechando modal');
                      setSelectedCover(null);
                    }
                  }}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </TooltipProvider>
  );
}
