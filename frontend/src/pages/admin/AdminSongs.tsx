import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, Search, Music, Eye, Clock, XCircle, CheckCircle, Play, Pause } from "lucide-react";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";
import { useDebounce } from "@/hooks/use-debounce";
import { useSongs } from "@/hooks/useAdminData";
// import { SongStatusBadge } from "@/components/admin/SongStatusBadge"; // Não usado no momento

interface Song {
  id: string;
  title: string;
  status: string;
  audio_url?: string;
  cover_url?: string;
  lyrics?: string;
  release_at: string | null;
  released_at?: string | null;
  quiz_id?: string | null;
  customer_email?: string;
  about_who?: string;
  style?: string;
  created_at: string;
  updated_at?: string;
  order_id: string;
  variant_number: number;
  orders?: {
    customer_email: string;
  } | Array<{
    customer_email: string;
  }>;
  quizzes?: {
    about_who: string;
    style: string;
  } | Array<{
    about_who: string;
    style: string;
  }>;
}

interface SongGroup {
  order_id: string;
  customer_email: string;
  about_who?: string;
  style?: string;
  songs: Song[];
  status: string;
  release_at: string | null;
  released_at?: string | null;
}

interface Stats {
  total: number;
  overdue: number;
  releasedToday: number;
  failed: number;
}

export default function AdminSongs() {
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 200); // ✅ 200ms para resposta mais rápida
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  
  // ✅ PAGINAÇÃO: 20 grupos por página (otimizado para velocidade)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isChangingPage, setIsChangingPage] = useState(false);
  
  // ✅ OTIMIZAÇÃO: Usar React Query para cache automático (SEM LIMITE)
  const { data: songsData, isLoading: loading, refetch, isFetching, error: songsError } = useSongs({
    search: debouncedSearchTerm,
    status: statusFilter,
    period: periodFilter,
  });
  
  const [songGroups, setSongGroups] = useState<SongGroup[]>([]);
  const [filteredSongGroups, setFilteredSongGroups] = useState<SongGroup[]>([]);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [releaseEdit, setReleaseEdit] = useState<Record<string, string>>({}); // order_id -> 'YYYY-MM-DDTHH:mm'
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  
  // ✅ OTIMIZAÇÃO: Calcular stats com useMemo (agrupando por gerações de 2 músicas)
  const stats = useMemo(() => {
    if (!songsData || songsData.length === 0) {
      return { total: 0, overdue: 0, releasedToday: 0, failed: 0 };
    }
    
    // Total de GERAÇÕES (cada geração = 2 músicas)
    const totalGenerations = Math.ceil(songsData.length / 2);
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Otimização: usar reduce para calcular tudo em uma passada
    const statsCalc = songsData.reduce((acc, song) => {
      // Atrasadas (não released e com data passada)
      if (song.release_at && song.status !== 'released') {
        const releaseDate = new Date(song.release_at);
        if (releaseDate < now) {
          acc.overdue++;
        }
      }
      
      // Liberadas hoje
      if (song.released_at) {
        const releasedDate = new Date(song.released_at);
        if (releasedDate >= todayStart) {
          acc.releasedToday++;
        }
      }
      
      // Falhadas
      if (song.status === 'failed') {
        acc.failed++;
      }
      
      return acc;
    }, { overdue: 0, releasedToday: 0, failed: 0 });
    
    return { 
      total: totalGenerations, 
      overdue: Math.ceil(statsCalc.overdue / 2), // Agrupar por gerações
      releasedToday: Math.ceil(statsCalc.releasedToday / 2), // Agrupar por gerações
      failed: Math.ceil(statsCalc.failed / 2) // Agrupar por gerações
    };
  }, [songsData]);

  const toInputLocal = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  // ✅ OTIMIZAÇÃO: Memoizar função de status para evitar recalcular
  const getDetailedStatus = useCallback((songGroup: SongGroup) => {
    // Verificações de segurança
    if (!songGroup || !songGroup.songs || songGroup.songs.length === 0) {
      return { label: 'Desconhecido', color: 'bg-gray-500' };
    }
    
    // Determinar status do grupo baseado nas músicas
    const allReleased = songGroup.songs.every(song => song && song.status === 'released');
    const allApproved = songGroup.songs.every(song => song && song.status === 'approved');
    const allReady = songGroup.songs.every(song => song && song.status === 'ready');
    const anyFailed = songGroup.songs.some(song => song && song.status === 'failed');
    
    if (allReleased) {
      return { label: 'Aprovada e Enviada', color: 'bg-green-600' };
    }
    if (allApproved) {
      if (songGroup.release_at) {
        const releaseDate = new Date(songGroup.release_at);
        const now = new Date();
        if (releaseDate > now && !isNaN(releaseDate.getTime())) {
          return { 
            label: `Aprovada e Agendada (${releaseDate.toLocaleString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            })})`, 
            color: 'bg-blue-600'
          };
        }
      }
      return { label: 'Aprovada (pronta)', color: 'bg-blue-500' };
    }
    if (allReady) {
      return { label: 'Pronta', color: 'bg-yellow-500' };
    }
    if (anyFailed) {
      return { label: 'Falhou', color: 'bg-red-600' };
    }
    return { label: 'Processando', color: 'bg-gray-500' };
  }, []);

  const applyFilters = useCallback(() => {
    // ✅ OTIMIZAÇÃO: Proteção contra chamada quando songGroups está vazio
    if (!songGroups || songGroups.length === 0) {
      setFilteredSongGroups([]);
      return;
    }
    
    // ✅ OTIMIZAÇÃO: Se não há filtros, retornar direto sem processar
    if (!debouncedSearchTerm && statusFilter === 'all' && periodFilter === 'all') {
      setFilteredSongGroups(songGroups);
      return;
    }
    
    let filtered = songGroups;

    // ✅ OTIMIZAÇÃO: Search filter com toLowerCase pré-calculado
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (group) =>
          group.songs.some(song => song.title?.toLowerCase().includes(searchLower)) ||
          group.customer_email?.toLowerCase().includes(searchLower) ||
          group.about_who?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((group) => {
        if (statusFilter === 'released') {
          return group.songs.every(song => song.status === 'released');
        }
        if (statusFilter === 'approved') {
          return group.songs.every(song => song.status === 'approved');
        }
        if (statusFilter === 'ready') {
          return group.songs.every(song => song.status === 'ready');
        }
        if (statusFilter === 'failed') {
          return group.songs.some(song => song.status === 'failed');
        }
        return true;
      });
    }

    // Period filter
    if (periodFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter((group) => {
        if (!group.release_at || group.release_at === null || group.release_at === '') {
          return periodFilter === 'scheduled' ? false : true;
        }
        try {
          const releaseDate = new Date(group.release_at);
          if (isNaN(releaseDate.getTime())) {
            return periodFilter === 'scheduled' ? false : true;
          }
          
          switch (periodFilter) {
            case "today":
              return releaseDate.toDateString() === today.toDateString();
            case "overdue":
              return releaseDate < now && !group.songs.every(song => song.status === "released");
            case "scheduled":
              return releaseDate > now;
            default:
              return true;
          }
        } catch (e) {
          return periodFilter === 'scheduled' ? false : true;
        }
      });
    }

    // ✅ OTIMIZAÇÃO: Reordenar apenas se necessário (não reordenar se já está ordenado)
    // Só reordenar se há filtros de status ou período aplicados
    if (statusFilter !== 'all' || periodFilter !== 'all') {
      filtered = filtered.sort((a, b) => {
      const now = new Date();
      
      // Função auxiliar para determinar tipo de status
      const getStatusType = (group: SongGroup): number => {
        // Verificações de segurança
        if (!group || !group.songs || group.songs.length === 0) {
          return 4;
        }
        
        // Verificar status das músicas
        const allReleased = group.songs.every(s => s && s.status === 'released');
        const allApproved = group.songs.every(s => s && s.status === 'approved');
        
        // PRIORIDADE 3: "Aprovada e Enviada" - verificar primeiro
        // TODAS as músicas são released
        if (allReleased) {
          return 3;
        }
        
        // PRIORIDADE 1: "Aprovada e Agendada"
        // TODAS approved E tem release_at futuro
        if (allApproved && !allReleased) {
          if (group.release_at) {
            try {
              const releaseDate = new Date(group.release_at);
              if (!isNaN(releaseDate.getTime()) && releaseDate > now) {
                return 1;
              }
            } catch (e) {
              // Data inválida, tratar como "Aprovada (pronta)"
            }
          }
          // Se não tem release_at futuro ou já passou, é "Aprovada (pronta)"
          return 2;
        }
        
        // PRIORIDADE 4: Outros status
        return 4;
      };
      
      const aType = getStatusType(a);
      const bType = getStatusType(b);
      
      // Se tipos diferentes, priorizar por tipo
      if (aType !== bType) {
        return aType - bType; // 1 < 2 < 3 < 4
      }
      
      // Se ambos são "Aprovada e Agendada", ordenar por release_at (mais recente primeiro)
      if (aType === 1 && bType === 1) {
        try {
          const aRelease = a.release_at ? new Date(a.release_at).getTime() : 0;
          const bRelease = b.release_at ? new Date(b.release_at).getTime() : 0;
          if (!isNaN(aRelease) && !isNaN(bRelease)) {
            return bRelease - aRelease;
          }
        } catch (e) {
          // Erro ao processar datas, manter ordem original
        }
      }
      
      // Se ambos são "Aprovada (pronta)", ordenar por created_at (mais recente primeiro)
      if (aType === 2 && bType === 2) {
        try {
          const aCreated = a.songs[0]?.created_at ? new Date(a.songs[0].created_at).getTime() : 0;
          const bCreated = b.songs[0]?.created_at ? new Date(b.songs[0].created_at).getTime() : 0;
          if (!isNaN(aCreated) && !isNaN(bCreated)) {
            return bCreated - aCreated;
          }
        } catch (e) {
          // Erro ao processar datas
        }
      }
      
      // Se ambos são "Aprovada e Enviada" ou outros, ordenar por created_at (mais recente primeiro)
      try {
        const aCreated = a.songs[0]?.created_at ? new Date(a.songs[0].created_at).getTime() : 0;
        const bCreated = b.songs[0]?.created_at ? new Date(b.songs[0].created_at).getTime() : 0;
        if (!isNaN(aCreated) && !isNaN(bCreated)) {
          return bCreated - aCreated;
        }
      } catch (e) {
        // Erro ao processar datas, manter ordem original
      }
      return 0;
      });
    }

    setFilteredSongGroups(filtered);
  }, [songGroups, debouncedSearchTerm, statusFilter, periodFilter]);

  // ✅ A função loadSongs foi removida - React Query gerencia o carregamento

  // ✅ OTIMIZAÇÃO: Processar dados do React Query quando mudam (agrupamento rápido)
  useEffect(() => {
    if (!songsData || songsData.length === 0) {
        setSongGroups([]);
        return;
      }

    console.time('⚡ Agrupamento de músicas');
    
    // Agrupar músicas por order_id (usando Map para melhor performance)
    const groupedMap = new Map<string, SongGroup>();
    
    for (const song of songsData) {
      const orderId = song.order_id;
      if (!orderId) continue;
      
      let group = groupedMap.get(orderId);
      
      if (!group) {
        // Extrair dados de forma segura e eficiente
        const ordersData = Array.isArray(song.orders) ? song.orders[0] : song.orders;
        const quizzesData = Array.isArray(song.quizzes) ? song.quizzes[0] : song.quizzes;
        
        group = {
          order_id: orderId,
          release_at: song.release_at || null,
          released_at: song.released_at || null,
          songs: [],
          customer_email: ordersData?.customer_email || 'N/A',
          about_who: quizzesData?.about_who,
          style: quizzesData?.style,
          status: song.status
        };
        
        groupedMap.set(orderId, group);
      }
      
      group.songs.push(song);
    }
    
    // Converter para array e ordenar músicas dentro de cada grupo
    const grouped = Array.from(groupedMap.values());
    
    // Ordenar músicas dentro de cada grupo por variant_number
    for (const group of grouped) {
      group.songs.sort((a, b) => a.variant_number - b.variant_number);
      
      // Atualizar status do grupo baseado nas músicas
      const allReleased = group.songs.every(s => s.status === 'released');
      const allApproved = group.songs.every(s => s.status === 'approved');
      group.status = allReleased ? 'released' : (allApproved ? 'approved' : group.songs[0]?.status || 'unknown');
    }
    
    // Ordenar grupos por data de criação (mais recentes primeiro)
    grouped.sort((a, b) => {
      const aTime = a.songs[0]?.created_at ? new Date(a.songs[0].created_at).getTime() : 0;
      const bTime = b.songs[0]?.created_at ? new Date(b.songs[0].created_at).getTime() : 0;
      return bTime - aTime;
    });
    
    console.timeEnd('⚡ Agrupamento de músicas');
    console.log(`✅ ${grouped.length} grupos criados de ${songsData.length} músicas`);
    
    setSongGroups(grouped);
  }, [songsData]);
  
  // ✅ Realtime removido - React Query gerencia atualizações

  // ✅ CORREÇÃO: Aplicar filtros quando songGroups ou filtros mudarem
  useEffect(() => {
    applyFilters();
    // Reset para primeira página apenas quando filtros mudarem (não quando songGroups mudar)
    if (searchTerm || statusFilter !== 'all' || periodFilter !== 'all') {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songGroups, debouncedSearchTerm, statusFilter, periodFilter]); // applyFilters já depende dessas variáveis
  
  // ✅ PAGINAÇÃO: Calcular itens da página atual
  const totalPages = Math.ceil(filteredSongGroups.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageItems = filteredSongGroups.slice(startIndex, endIndex);
  
  // Handlers de navegação
  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    if (newPage === currentPage) return;
    
    setIsChangingPage(true);
    setCurrentPage(newPage);
    
    // Scroll suave para o topo da página
    const container = document.querySelector('.container');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Remover indicador de transição após um curto delay
    setTimeout(() => setIsChangingPage(false), 300);
  };
  
  const goToNextPage = () => goToPage(currentPage + 1);
  const goToPreviousPage = () => goToPage(currentPage - 1);

  const applyNewReleaseAt = async (orderId: string) => {
    try {
      const value = releaseEdit[orderId];
      if (!value) return;
      // value já está no fuso local: construir Date e salvar como ISO (UTC) preservando o instante escolhido
      const localDate = new Date(value);
      const iso = new Date(localDate.getTime()).toISOString();
      const { error } = await supabase
        .from('songs')
        .update({ release_at: iso, updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('status', 'approved');
      if (error) throw error;
      toast.success('Horário de envio atualizado');
      // refletir no estado exibido
      setSongGroups(prev => prev.map(g => g.order_id === orderId ? { ...g, release_at: iso } : g));
      refetch();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Erro ao atualizar horário';
      toast.error(errorMessage);
    }
  };

  const togglePlay = (songId: string, audioUrl: string) => {
    // Pausar todos os outros áudios
    Object.keys(audioRefs.current).forEach(id => {
      if (id !== songId && audioRefs.current[id]) {
        audioRefs.current[id].pause();
      }
    });

    // Toggle do áudio atual
    if (playingSongId === songId) {
      audioRefs.current[songId]?.pause();
      setPlayingSongId(null);
    } else {
      if (!audioRefs.current[songId]) {
        audioRefs.current[songId] = new Audio(audioUrl);
        audioRefs.current[songId].addEventListener('ended', () => setPlayingSongId(null));
      }
      audioRefs.current[songId].play();
      setPlayingSongId(songId);
    }
  };

  const isInitialLoading = loading && !songsData;

  // ✅ CORREÇÃO: Tratamento de erro
  if (songsError) {
    return (
      <div className="container mx-auto p-2 md:p-6 space-y-2 md:space-y-6">
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">Erro ao carregar músicas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {songsError instanceof Error ? songsError.message : 'Erro desconhecido ao carregar músicas'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 md:p-6 space-y-2 md:space-y-6">
      {/* ✅ OTIMIZAÇÃO: Removido banner de loading duplicado - usar apenas o loading unificado */}
      
      <div className="flex items-center justify-between mb-2 md:mb-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Músicas
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">
            Gerenciar gerações de músicas {songsData && songsData.length > 0 && `(${songsData.length} músicas carregadas)`}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 md:mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      {isInitialLoading ? (
        <AdminPageLoading text="Carregando músicas..." />
      ) : (
        <>
          {/* Statistics Cards - 2 colunas em mobile */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <Card
          className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0"
          data-testid="stats-total-songs"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Total de Gerações</CardTitle>
            <Music className="h-3 w-3 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
            <div className="text-xl md:text-3xl font-bold">
              {stats.total}
              {isFetching && <span className="ml-2 text-xs text-muted-foreground">↻</span>}
            </div>
            {songsData && songsData.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {songsData.length} músicas
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card
          className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0"
          data-testid="stats-overdue-songs"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-bl-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Pendentes</CardTitle>
            <Clock className="h-3 w-3 text-yellow-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
            <div className="text-xl md:text-3xl font-bold text-yellow-600">{stats.overdue}</div>
          </CardContent>
        </Card>
        
        <Card
          className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0"
          data-testid="stats-released-today"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Liberadas Hoje</CardTitle>
            <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
            <div className="text-xl md:text-3xl font-bold text-green-600">{stats.releasedToday}</div>
          </CardContent>
        </Card>
        
        <Card
          className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0"
          data-testid="stats-failed-songs"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Falhadas</CardTitle>
            <XCircle className="h-3 w-3 text-red-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
            <div className="text-xl md:text-3xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>
        </>
      )}

      {!isInitialLoading && (
      <Card className="admin-card-compact border-2 hover:shadow-lg transition-shadow overflow-hidden z-0">
        <CardHeader className="p-1 md:p-2 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-[10px] md:text-xs font-medium">
              Gerações de Música (2 Músicas por Geração)
              {totalPages > 1 && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  - Página {currentPage} de {totalPages}
                </span>
              )}
            </CardTitle>
          </div>
          <div className="space-y-2 md:space-y-4 mt-2 md:mt-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                data-testid="search-input"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-14"
                style={{ paddingLeft: '3.5rem' }}
              />
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter" className="w-full md:w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="released" data-testid="status-option-released">Liberada</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="ready">Pronta</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger data-testid="period-filter" className="w-full md:w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="today" data-testid="period-option-today">Hoje</SelectItem>
                  <SelectItem value="week">Últimos 7 dias</SelectItem>
                  <SelectItem value="month">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6 pt-0 relative z-10">
          {/* Paginação */}
          {filteredSongGroups.length > 0 && (
            <div className="mb-4">
              {/* Controles de Paginação - Topo */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1}-{Math.min(endIndex, filteredSongGroups.length)} de {filteredSongGroups.length}
                    </p>
                    <Select 
                      value={itemsPerPage.toString()} 
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[100px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                    >
                      ← Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {/* Primeira página */}
                      {currentPage > 3 && (
                        <>
                          <Button
                            variant={currentPage === 1 ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(1)}
                            className="w-10"
                          >
                            1
                          </Button>
                          {currentPage > 4 && <span className="text-muted-foreground">...</span>}
                        </>
                      )}
                      
                      {/* Páginas próximas */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        if (pageNum < 1 || pageNum > totalPages) return null;
                        if (currentPage > 3 && pageNum === 1) return null;
                        if (currentPage < totalPages - 2 && pageNum === totalPages) return null;
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      
                      {/* Última página */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && <span className="text-muted-foreground">...</span>}
                          <Button
                            variant={currentPage === totalPages ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(totalPages)}
                            className="w-10"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Próxima →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className={`space-y-6 transition-opacity duration-200 ${isChangingPage ? 'opacity-50' : 'opacity-100'}`}>
            {filteredSongGroups.length === 0 ? (
              <div className="text-center py-12 md:py-16">
                <Music className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground text-sm md:text-base font-medium mb-2">
                  Nenhuma música encontrada
                </p>
                <p className="text-muted-foreground text-xs md:text-sm">
                  {searchTerm || statusFilter !== "all" || periodFilter !== "all"
                    ? "Tente ajustar os filtros de busca"
                    : "Quando houver músicas, elas aparecerão aqui"}
                </p>
              </div>
            ) : (
              currentPageItems.map((group) => (
                <div
                  key={group.order_id}
                  data-testid={`song-group-${group.order_id}`}
                  role="group"
                  className="border rounded-lg p-4 space-y-4"
                >
                  {/* Header do Grupo */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-12 h-12 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                        <Music className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            Geração de Música {group.songs.length > 1 ? '(2 versões)' : '(1 versão)'}
                          </p>
                          <span
                            className={`text-xs px-2 py-1 rounded-full text-white ${getDetailedStatus(group).color} shrink-0`}
                            data-testid="group-status"
                            data-testid-fallback={`status-badge-${group.order_id}`}
                          >
                            {getDetailedStatus(group).label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate" data-testid="group-customer-email">
                          Cliente: {group.customer_email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.about_who ? `Para: ${group.about_who}` : 'Música Personalizada'} • 
                          Estilo: {group.style || 'N/A'} • 
                          Criado:{' '}
                          <time
                            data-testid="group-date"
                            dateTime={group.songs && group.songs[0]?.created_at ? group.songs[0].created_at : undefined}
                          >
                            {group.songs && group.songs[0]?.created_at ? new Date(group.songs[0].created_at).toLocaleDateString("pt-BR") : 'N/A'}
                          </time>
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/admin/orders/${group.order_id}`)}
                    >
                      <Eye className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Ver Pedido</span>
                    </Button>
                  </div>

                  {/* Editor de agendamento quando todas estão aprovadas */}
                  {group.songs.every(s => s.status === 'approved') && (
                    <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-md">
                      <Input
                        type="datetime-local"
                        value={releaseEdit[group.order_id] || toInputLocal(group.release_at)}
                        onChange={(e) => setReleaseEdit(prev => ({ ...prev, [group.order_id]: e.target.value }))}
                        className="max-w-xs"
                      />
                      <Button size="sm" onClick={() => applyNewReleaseAt(group.order_id)}>Salvar horário</Button>
                    </div>
                  )}

                  {/* Músicas do Grupo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.songs.map((song, index) => (
                      <div
                        key={song.id}
                        data-testid={`song-item-${song.id}`}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {song.cover_url ? (
                            <img
                              src={song.cover_url}
                              alt={song.title}
                              className="w-10 h-10 rounded object-cover shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                              <Music className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              Versão {song.variant_number}: {song.title}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full text-white ${
                                song.status === 'released' ? 'bg-green-600' :
                                song.status === 'approved' ? 'bg-blue-600' :
                                song.status === 'ready' ? 'bg-yellow-500' :
                                song.status === 'failed' ? 'bg-red-600' : 'bg-gray-500'
                              }`}>
                                {song.status === 'released' ? 'Enviada' :
                                 song.status === 'approved' ? 'Aprovada' :
                                 song.status === 'ready' ? 'Pronta' :
                                 song.status === 'failed' ? 'Falhou' : song.status}
                              </span>
                              {song.audio_url && (
                                <span className="text-xs text-green-600" data-testid="audio-indicator">✓ Áudio</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {song.audio_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => togglePlay(song.id, song.audio_url!)}
                              data-testid="play-button"
                              aria-label={playingSongId === song.id ? "Pausar" : "Reproduzir"}
                            >
                              {playingSongId === song.id ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => navigate(`/admin/songs/${song.id}`)}
                            data-testid="view-song-button"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Controles de Paginação - Final */}
          {filteredSongGroups.length > 0 && totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1}-{Math.min(endIndex, filteredSongGroups.length)} de {filteredSongGroups.length}
                </p>
                <Select 
                  value={itemsPerPage.toString()} 
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  ← Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {/* Primeira página */}
                  {currentPage > 3 && (
                    <>
                      <Button
                        variant={currentPage === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(1)}
                        className="w-10"
                      >
                        1
                      </Button>
                      {currentPage > 4 && <span className="text-muted-foreground">...</span>}
                    </>
                  )}
                  
                  {/* Páginas próximas */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    if (currentPage > 3 && pageNum === 1) return null;
                    if (currentPage < totalPages - 2 && pageNum === totalPages) return null;
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="w-10"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  {/* Última página */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="text-muted-foreground">...</span>}
                      <Button
                        variant={currentPage === totalPages ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(totalPages)}
                        className="w-10"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  Próxima →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
