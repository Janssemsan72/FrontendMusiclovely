import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SongStatusBadge } from "@/components/admin/SongStatusBadge";
import { ArrowLeft, Play, Pause, Download, Calendar, Clock, Music2, Globe, RefreshCw, Trash2 } from "lucide-react";
import { JobStatusBadge } from "@/components/admin/JobStatusBadge";

interface Song {
  id: string;
  title: string;
  status: string;
  audio_url?: string;
  cover_url?: string;
  lyrics?: string;
  style?: string;
  emotion?: string;
  language: string;
  duration_sec?: number;
  release_at: string;
  released_at?: string;
  created_at: string;
  updated_at: string;
  order_id: string;
  user_id?: string;
  orders?: {
    customer_email: string;
    id: string;
  };
}

interface Job {
  id: string;
  status: string;
  gpt_prompt?: string;
  gpt_lyrics?: any;
  suno_task_id?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export default function AdminSongDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedSong, setEditedSong] = useState<Partial<Song>>({});
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadSongDetails();
  }, [id]);

  const loadSongDetails = async () => {
    try {
      setLoading(true);
      
      // Load song
      const { data: songData, error: songError } = await supabase
        .from("songs")
        .select("*, orders(customer_email, id)")
        .eq("id", id!)
        .single();

      if (songError) throw songError;
      setSong(songData);
      setEditedSong(songData);

      // Load related jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select("id, order_id, status, created_at, updated_at, error, gpt_lyrics, suno_task_id")
        .eq("order_id", songData.order_id)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);
    } catch (error) {
      console.error("Error loading song:", error);
      toast.error("Erro ao carregar música");
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseNow = async () => {
    if (!song) return;
    
    try {
      const { error } = await supabase.functions.invoke("admin-song-actions", {
        body: { action: "release_now", songId: song.id }
      });

      if (error) throw error;
      toast.success("Música liberada com sucesso!");
      loadSongDetails();
    } catch (error: any) {
      console.error("Error releasing song:", error);
      toast.error(error.message || "Erro ao liberar música");
    }
  };

  const handlePostpone = async () => {
    if (!song) return;
    
    const newDate = prompt("Nova data de liberação (YYYY-MM-DD HH:mm):");
    if (!newDate) return;

    try {
      const { error } = await supabase.functions.invoke("admin-song-actions", {
        body: { 
          action: "postpone", 
          songId: song.id,
          payload: { release_at: newDate }
        }
      });

      if (error) throw error;
      toast.success("Data de liberação atualizada!");
      loadSongDetails();
    } catch (error: any) {
      console.error("Error postponing:", error);
      toast.error(error.message || "Erro ao adiar liberação");
    }
  };

  const handleSaveMetadata = async () => {
    if (!song) return;

    try {
      const { error } = await supabase.functions.invoke("admin-song-actions", {
        body: { 
          action: "update_metadata", 
          songId: song.id,
          payload: {
            title: editedSong.title,
            style: editedSong.style,
            emotion: editedSong.emotion,
            lyrics: editedSong.lyrics
          }
        }
      });

      if (error) throw error;
      toast.success("Metadados atualizados!");
      setEditMode(false);
      loadSongDetails();
    } catch (error: any) {
      console.error("Error updating metadata:", error);
      toast.error(error.message || "Erro ao atualizar metadados");
    }
  };

  const handleDelete = async () => {
    if (!song) return;
    
    const confirm = window.confirm(
      "Tem certeza que deseja deletar esta música? Esta ação não pode ser desfeita."
    );
    if (!confirm) return;

    try {
      const { error } = await supabase.functions.invoke("admin-song-actions", {
        body: { action: "delete", songId: song.id }
      });

      if (error) throw error;
      toast.success("Música deletada com sucesso!");
      navigate("/admin/songs");
    } catch (error: any) {
      console.error("Error deleting song:", error);
      toast.error(error.message || "Erro ao deletar música");
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="container mx-auto p-0">
        <p className="text-center text-muted-foreground">Música não encontrada</p>
      </div>
    );
  }

  const isOverdue = new Date(song.release_at) < new Date() && song.status !== "released";
  const daysUntilRelease = Math.ceil(
    (new Date(song.release_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/songs")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{song.title}</h1>
            <p className="text-sm text-muted-foreground">ID: {song.id}</p>
          </div>
          <SongStatusBadge status={song.status} />
        </div>
        <div className="flex gap-2">
          {song.status === "ready" || (song.status === "processing" && song.audio_url) ? (
            <>
              <Button onClick={handleReleaseNow} variant="default">
                Liberar Agora
              </Button>
              <Button onClick={handlePostpone} variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Adiar
              </Button>
            </>
          ) : null}
          <Button onClick={handleDelete} variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Deletar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{song.orders?.customer_email || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Order ID</Label>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => navigate(`/admin/orders/${song.order_id}`)}
                  >
                    {song.order_id.slice(0, 8)}...
                  </Button>
                </div>
                <div>
                  <Label className="text-muted-foreground">Criada em</Label>
                  <p>{new Date(song.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Atualizada em</Label>
                  <p>{new Date(song.updated_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Metadados Musicais</CardTitle>
              {!editMode ? (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveMetadata}>
                    Salvar
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título</Label>
                {editMode ? (
                  <Input
                    value={editedSong.title || ""}
                    onChange={(e) => setEditedSong({ ...editedSong, title: e.target.value })}
                  />
                ) : (
                  <p className="font-medium">{song.title}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Estilo</Label>
                  {editMode ? (
                    <Input
                      value={editedSong.style || ""}
                      onChange={(e) => setEditedSong({ ...editedSong, style: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{song.style || "N/A"}</p>
                  )}
                </div>
                <div>
                  <Label>Emoção</Label>
                  {editMode ? (
                    <Input
                      value={editedSong.emotion || ""}
                      onChange={(e) => setEditedSong({ ...editedSong, emotion: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{song.emotion || "N/A"}</p>
                  )}
                </div>
                <div>
                  <Label>Idioma</Label>
                  <p className="font-medium">{song.language}</p>
                </div>
              </div>
              {song.duration_sec && (
                <div>
                  <Label>Duração</Label>
                  <p className="font-medium">
                    {Math.floor(song.duration_sec / 60)}:{String(song.duration_sec % 60).padStart(2, "0")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lyrics */}
          <Card>
            <CardHeader>
              <CardTitle>Letra Completa</CardTitle>
            </CardHeader>
            <CardContent>
              {editMode ? (
                <Textarea
                  value={editedSong.lyrics || ""}
                  onChange={(e) => setEditedSong({ ...editedSong, lyrics: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {song.lyrics || "Letra não disponível"}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* Related Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Jobs Relacionados ({jobs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum job encontrado</p>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <JobStatusBadge status={job.status} />
                        <span className="text-sm text-muted-foreground">
                          ID: {job.id.slice(0, 8)}...
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {job.suno_task_id && (
                      <p className="text-xs">Suno Task: {job.suno_task_id}</p>
                    )}
                    {job.error && (
                      <p className="text-xs text-destructive">Erro: {job.error}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Audio Player */}
          {song.audio_url && (
            <Card>
              <CardHeader>
                <CardTitle>Áudio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {song.cover_url && (
                  <img
                    src={song.cover_url}
                    alt={song.title}
                    className="w-full rounded-lg"
                  />
                )}
                <Button 
                  variant="default" 
                  className="w-full" 
                  size="lg"
                  onClick={togglePlayback}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-5 w-5 mr-2" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Tocar Preview
                    </>
                  )}
                </Button>
                <audio 
                  ref={audioRef} 
                  controls 
                  className="w-full"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                >
                  <source src={song.audio_url} type="audio/mpeg" />
                </audio>
                <Button variant="outline" className="w-full" asChild>
                  <a href={song.audio_url} download>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar MP3
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Release Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status de Liberação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Data Agendada</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">
                    {new Date(song.release_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                {isOverdue && (
                  <p className="text-sm text-destructive mt-1">
                    ⚠️ Atrasada em {Math.abs(daysUntilRelease)} dias
                  </p>
                )}
                {!isOverdue && song.status !== "released" && daysUntilRelease > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {daysUntilRelease} dias até liberação
                  </p>
                )}
              </div>
              {song.released_at && (
                <div>
                  <Label className="text-muted-foreground">Liberada em</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <p className="font-medium">
                      {new Date(song.released_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
