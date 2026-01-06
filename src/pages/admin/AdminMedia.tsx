import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedTabs, EnhancedTabsContent, EnhancedTabsList, EnhancedTabsTrigger } from "@/components/ui/enhanced-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Image, Music, MessageSquare, HelpCircle, Plus, Trash2, Edit, Upload, Star, RefreshCw, Sparkles, Video, Loader2 } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  role?: string;
  content: string;
  avatar_url?: string;
  rating?: number;
  display_order: number;
  is_active: boolean;
  // Campos de tradução
  name_en?: string;
  name_es?: string;
  role_en?: string;
  role_es?: string;
  content_en?: string;
  content_es?: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  display_order: number;
  is_active: boolean;
}

interface HeroVideo {
  id: string;
  video_path?: string;
  poster_path?: string;
  is_active: boolean;
}

interface ExampleTrack {
  id: string;
  title: string;
  artist?: string;
  audio_path?: string;
  cover_path?: string;
  is_active: boolean;
}

export default function AdminMedia() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  
  // Hero Video states
  const [heroVideo, setHeroVideo] = useState<HeroVideo | null>(null);
  const [heroVideoFile, setHeroVideoFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  
  // Example Track states
  const [exampleTrack, setExampleTrack] = useState<ExampleTrack | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackArtist, setTrackArtist] = useState("");
  
  // Avatar upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  useEffect(() => {
    loadTestimonials();
    loadFaqs();
    loadHeroVideo();
    loadExampleTrack();
  }, []);

  const loadTestimonials = async () => {
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, name, text, avatar_url, display_order, created_at, updated_at")
      .order("display_order", { ascending: true });

    if (error) {
      toast.error('Erro ao carregar depoimentos');
      return;
    }
    setTestimonials(data || []);
  };

  const loadFaqs = async () => {
    const { data, error } = await supabase
      .from("faqs")
      .select("id, question, answer, display_order, created_at, updated_at")
      .order("display_order", { ascending: true });

    if (error) {
      toast.error('Erro ao carregar FAQs');
      return;
    }
    setFaqs(data || []);
  };

  const loadHeroVideo = async () => {
    const { data, error } = await supabase
      .from("home_media")
      .select("id, video_url, is_active, created_at, updated_at")
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Erro ao carregar vídeo hero:", error);
      return;
    }
    setHeroVideo(data || null);
  };

  const loadExampleTrack = async () => {
    const { data, error } = await supabase
      .from("home_example_track")
      .select("id, title, artist, audio_url, is_active, created_at, updated_at")
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Erro ao carregar faixa exemplo:", error);
      return;
    }
    setExampleTrack(data || null);
    if (data) {
      setTrackTitle(data.title);
      setTrackArtist(data.artist || "");
    }
  };

  const generateRandomAvatar = (name: string) => {
    const colors = ["FF6B6B", "4ECDC4", "45B7D1", "FFA07A", "98D8C8", "F7DC6F", "BB8FCE", "85C1E2"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=${randomColor}&color=fff&bold=true`;
  };

  const generateAvatarsForAll = async () => {
    if (!confirm("Gerar avatares aleatórios para todos os depoimentos sem foto?")) return;
    
    setLoading(true);
    try {
      const testimonialsWithoutAvatar = testimonials.filter(t => !t.avatar_url);
      
      for (const testimonial of testimonialsWithoutAvatar) {
        const avatarUrl = generateRandomAvatar(testimonial.name);
        await supabase
          .from("testimonials")
          .update({ avatar_url: avatarUrl })
          .eq("id", testimonial.id);
      }
      
      toast.success(`${testimonialsWithoutAvatar.length} avatares gerados!`);
      loadTestimonials();
    } catch (error: any) {
      toast.error("Erro ao gerar avatares");
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return null;
    
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `testimonials/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('home-media')
      .upload(filePath, avatarFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('home-media')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const uploadHeroVideo = async () => {
    if (!heroVideoFile) {
      toast.error("Selecione um vídeo");
      return;
    }

    setUploadingVideo(true);
    try {
      const fileExt = heroVideoFile.name.split('.').pop();
      const fileName = `hero-${Date.now()}.${fileExt}`;
      const filePath = `hero/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('home-media')
        .upload(filePath, heroVideoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('home-media')
        .getPublicUrl(filePath);

      // Desativar vídeos anteriores
      await supabase
        .from("home_media")
        .update({ is_active: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Criar ou atualizar vídeo ativo
      const { error: dbError } = await supabase
        .from("home_media")
        .upsert({
          video_path: publicUrl,
          is_active: true
        });

      if (dbError) throw dbError;

      toast.success("Vídeo hero enviado com sucesso!");
      setHeroVideoFile(null);
      loadHeroVideo();
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload");
    } finally {
      setUploadingVideo(false);
    }
  };

  const uploadExampleTrack = async () => {
    if (!audioFile || !trackTitle) {
      toast.error("Selecione um áudio e preencha o título");
      return;
    }

    setUploadingTrack(true);
    try {
      let audioUrl = "";
      let coverUrl = "";

      // Upload do áudio
      const audioExt = audioFile.name.split('.').pop();
      const audioFileName = `track-${Date.now()}.${audioExt}`;
      const audioPath = `tracks/${audioFileName}`;

      const { error: audioError } = await supabase.storage
        .from('home-media')
        .upload(audioPath, audioFile);

      if (audioError) throw audioError;

      const { data: { publicUrl: audioPublicUrl } } = supabase.storage
        .from('home-media')
        .getPublicUrl(audioPath);
      
      audioUrl = audioPublicUrl;

      // Upload da capa (se houver)
      if (coverFile) {
        const coverExt = coverFile.name.split('.').pop();
        const coverFileName = `cover-${Date.now()}.${coverExt}`;
        const coverPath = `covers/${coverFileName}`;

        const { error: coverError } = await supabase.storage
          .from('home-media')
          .upload(coverPath, coverFile);

        if (coverError) throw coverError;

        const { data: { publicUrl: coverPublicUrl } } = supabase.storage
          .from('home-media')
          .getPublicUrl(coverPath);
        
        coverUrl = coverPublicUrl;
      }

      // Desativar tracks anteriores
      await supabase
        .from("home_example_track")
        .update({ is_active: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Criar nova track
      const { error: dbError } = await supabase
        .from("home_example_track")
        .insert({
          title: trackTitle,
          artist: trackArtist || null,
          audio_path: audioUrl,
          cover_path: coverUrl || null,
          is_active: true
        });

      if (dbError) throw dbError;

      toast.success("Faixa exemplo enviada com sucesso!");
      setAudioFile(null);
      setCoverFile(null);
      setTrackTitle("");
      setTrackArtist("");
      loadExampleTrack();
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload");
    } finally {
      setUploadingTrack(false);
    }
  };

  const saveTestimonial = async (testimonial: Partial<Testimonial>) => {
    if (!testimonial.name || !testimonial.content) {
      toast.error("Preencha nome e depoimento");
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = testimonial.avatar_url;
      
      // Upload do avatar se houver arquivo selecionado
      if (avatarFile) {
        avatarUrl = await uploadAvatar();
      }

      if (testimonial.id) {
        const { error } = await supabase
          .from("testimonials")
          .update({
            name: testimonial.name,
            role: testimonial.role,
            content: testimonial.content,
            avatar_url: avatarUrl,
            rating: testimonial.rating,
            display_order: testimonial.display_order,
            is_active: testimonial.is_active,
            // Campos de tradução
            name_en: testimonial.name_en,
            name_es: testimonial.name_es,
            role_en: testimonial.role_en,
            role_es: testimonial.role_es,
            content_en: testimonial.content_en,
            content_es: testimonial.content_es,
          })
          .eq("id", testimonial.id);

        if (error) throw error;
        toast.success("Depoimento atualizado!");
      } else {
        const { error } = await supabase
          .from("testimonials")
          .insert([{
            name: testimonial.name,
            role: testimonial.role,
            content: testimonial.content,
            avatar_url: avatarUrl,
            rating: testimonial.rating || 5,
            display_order: testimonial.display_order || 0,
            is_active: testimonial.is_active !== false,
            // Campos de tradução
            name_en: testimonial.name_en,
            name_es: testimonial.name_es,
            role_en: testimonial.role_en,
            role_es: testimonial.role_es,
            content_en: testimonial.content_en,
            content_es: testimonial.content_es,
          }]);

        if (error) throw error;
        toast.success("Depoimento criado!");
      }
      loadTestimonials();
      setEditingTestimonial(null);
      setAvatarFile(null);
      setAvatarPreview("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteTestimonial = async (id: string) => {
    if (!confirm("Deseja deletar este depoimento?")) return;

    const { error } = await supabase
      .from("testimonials")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao deletar");
      return;
    }
    toast.success("Depoimento deletado!");
    loadTestimonials();
  };

  const saveFaq = async (faq: Partial<FAQ>) => {
    if (!faq.question || !faq.answer) {
      toast.error("Preencha pergunta e resposta");
      return;
    }

    setLoading(true);
    try {
      if (faq.id) {
        const { error } = await supabase
          .from("faqs")
          .update({
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            display_order: faq.display_order,
            is_active: faq.is_active,
          })
          .eq("id", faq.id);

        if (error) throw error;
        toast.success("FAQ atualizado!");
      } else {
        const { error } = await supabase
          .from("faqs")
          .insert([{
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            display_order: faq.display_order || 0,
            is_active: faq.is_active !== false,
          }]);

        if (error) throw error;
        toast.success("FAQ criado!");
      }
      loadFaqs();
      setEditingFaq(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteFaq = async (id: string) => {
    if (!confirm("Deseja deletar este FAQ?")) return;

    const { error } = await supabase
      .from("faqs")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao deletar");
      return;
    }
    toast.success("FAQ deletado!");
    loadFaqs();
  };

  // Estatísticas
  const stats = {
    activeTestimonials: testimonials.filter(t => t.is_active).length,
    activeFaqs: faqs.filter(f => f.is_active).length,
    testimonialsWithAvatar: testimonials.filter(t => t.avatar_url).length,
    avgRating: testimonials.length > 0
      ? (testimonials.reduce((acc, t) => acc + (t.rating || 0), 0) / testimonials.length).toFixed(1)
      : "0"
  };

  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Mídia</h1>
      </div>
      
      {/* Estatísticas */}
      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4">
        <div className="grid grid-cols-2 gap-3 md:contents">
          <Card className="mobile-compact-card">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Depoimentos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-2xl font-bold">{stats.activeTestimonials}</p>
            </CardContent>
          </Card>
          
          <Card className="mobile-compact-card">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                FAQs Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-2xl font-bold">{stats.activeFaqs}</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-2 gap-3 md:contents">
          <Card className="mobile-compact-card">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Com Avatar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-2xl font-bold">{stats.testimonialsWithAvatar}/{testimonials.length}</p>
            </CardContent>
          </Card>
          
          <Card className="mobile-compact-card">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Avaliação Média
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="flex items-center gap-2">
                <p className="text-xl md:text-2xl font-bold">{stats.avgRating}</p>
                <Star className="h-4 w-4 md:h-5 md:w-5 fill-yellow-400 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EnhancedTabs defaultValue="testimonials" variant="modern" className="space-y-3 md:space-y-4">
        <EnhancedTabsList className="admin-tabs-marrom grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <EnhancedTabsTrigger 
            value="hero" 
            icon={<Video className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
            className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3"
          >
            <span>Hero</span>
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger 
            value="example" 
            icon={<Music className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
            className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3"
          >
            <span>Faixa</span>
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger 
            value="testimonials" 
            icon={<MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
            className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3"
          >
            <span>Dep.</span>
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger 
            value="faqs" 
            icon={<HelpCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
            className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3"
          >
            <span>FAQs</span>
          </EnhancedTabsTrigger>
        </EnhancedTabsList>

        <EnhancedTabsContent value="hero">
          <Card className="mobile-compact-card">
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">Vídeo Hero da Home</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 space-y-3 md:space-y-4">
              {heroVideo?.video_path && (
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Vídeo Atual</Label>
                  <video
                    src={heroVideo.video_path}
                    controls
                    className="w-full max-w-sm md:max-w-2xl rounded-lg border"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Novo Vídeo</Label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setHeroVideoFile(e.target.files?.[0] || null)}
                  className="text-xs md:text-sm"
                />
              </div>
              
              <Button
                onClick={uploadHeroVideo}
                disabled={!heroVideoFile || uploadingVideo}
                className="w-full sm:w-auto text-xs md:text-sm"
              >
                {uploadingVideo ? (
                  <>
                    <Loader2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Enviar Vídeo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </EnhancedTabsContent>

        <EnhancedTabsContent value="example">
          <Card className="mobile-compact-card">
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">Faixa Exemplo (Vinyl Player)</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 space-y-3 md:space-y-4">
              {exampleTrack && (
                <div className="space-y-3 p-3 md:p-4 border rounded-lg">
                  <Label className="text-xs md:text-sm">Faixa Atual</Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {exampleTrack.cover_path && (
                      <img
                        src={exampleTrack.cover_path}
                        alt={exampleTrack.title}
                        className="w-16 h-16 sm:w-24 sm:h-24 rounded-lg object-cover mx-auto sm:mx-0"
                      />
                    )}
                    <div className="flex-1 text-center sm:text-left">
                      <p className="font-medium text-sm md:text-base">{exampleTrack.title}</p>
                      {exampleTrack.artist && (
                        <p className="text-xs md:text-sm text-muted-foreground">{exampleTrack.artist}</p>
                      )}
                      {exampleTrack.audio_path && (
                        <audio
                          src={exampleTrack.audio_path}
                          controls
                          className="mt-2 w-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Título *</Label>
                  <Input
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="Nome da música"
                    className="text-xs md:text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Artista</Label>
                  <Input
                    value={trackArtist}
                    onChange={(e) => setTrackArtist(e.target.value)}
                    placeholder="Nome do artista"
                    className="text-xs md:text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Áudio *</Label>
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="text-xs md:text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Capa (opcional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="text-xs md:text-sm"
                />
              </div>
              
              <Button
                onClick={uploadExampleTrack}
                disabled={!audioFile || !trackTitle || uploadingTrack}
                className="w-full sm:w-auto text-xs md:text-sm"
              >
                {uploadingTrack ? (
                  <>
                    <Loader2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Enviar Faixa
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </EnhancedTabsContent>

        <EnhancedTabsContent value="testimonials">
          <Card className="mobile-compact-card">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">Gerenciar Depoimentos</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={generateAvatarsForAll}
                  disabled={loading}
                  className="text-xs md:text-sm"
                >
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  Gerar Avatares
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setEditingTestimonial({ 
                          id: "", 
                          name: "", 
                          content: "", 
                          display_order: testimonials.length, 
                          is_active: true 
                        } as any);
                        setAvatarFile(null);
                        setAvatarPreview("");
                      }}
                      className="text-xs md:text-sm"
                    >
                      <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      Novo
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingTestimonial?.id ? "Editar" : "Novo"} Depoimento
                    </DialogTitle>
                    <DialogDescription>Cadastre ou atualize um depoimento exibido no site.</DialogDescription>
                  </DialogHeader>
                  {editingTestimonial && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Avatar</Label>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={avatarPreview || editingTestimonial.avatar_url} />
                            <AvatarFallback>{editingTestimonial.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setAvatarFile(file);
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setAvatarPreview(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const url = generateRandomAvatar(editingTestimonial.name || "User");
                                setEditingTestimonial({ ...editingTestimonial, avatar_url: url });
                                setAvatarPreview(url);
                              }}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Gerar Aleatório
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Label>Nome *</Label>
                        <Input
                          value={editingTestimonial.name}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Cargo/Função</Label>
                        <Input
                          value={editingTestimonial.role || ""}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, role: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Depoimento *</Label>
                        <Textarea
                          value={editingTestimonial.content}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, content: e.target.value })}
                          rows={4}
                        />
                      </div>
                      
                      {/* Campos de Tradução */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium mb-3">Traduções</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Nome (Inglês)</Label>
                            <Input
                              value={editingTestimonial.name_en || ""}
                              onChange={(e) => setEditingTestimonial({ ...editingTestimonial, name_en: e.target.value })}
                              placeholder="Nome em inglês"
                            />
                          </div>
                          <div>
                            <Label>Nome (Espanhol)</Label>
                            <Input
                              value={editingTestimonial.name_es || ""}
                              onChange={(e) => setEditingTestimonial({ ...editingTestimonial, name_es: e.target.value })}
                              placeholder="Nome em espanhol"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label>Cargo/Função (Inglês)</Label>
                            <Input
                              value={editingTestimonial.role_en || ""}
                              onChange={(e) => setEditingTestimonial({ ...editingTestimonial, role_en: e.target.value })}
                              placeholder="Cargo em inglês"
                            />
                          </div>
                          <div>
                            <Label>Cargo/Função (Espanhol)</Label>
                            <Input
                              value={editingTestimonial.role_es || ""}
                              onChange={(e) => setEditingTestimonial({ ...editingTestimonial, role_es: e.target.value })}
                              placeholder="Cargo em espanhol"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <Label>Depoimento (Inglês)</Label>
                          <Textarea
                            value={editingTestimonial.content_en || ""}
                            onChange={(e) => setEditingTestimonial({ ...editingTestimonial, content_en: e.target.value })}
                            rows={3}
                            placeholder="Depoimento em inglês"
                          />
                        </div>
                        
                        <div className="mt-4">
                          <Label>Depoimento (Espanhol)</Label>
                          <Textarea
                            value={editingTestimonial.content_es || ""}
                            onChange={(e) => setEditingTestimonial({ ...editingTestimonial, content_es: e.target.value })}
                            rows={3}
                            placeholder="Depoimento em espanhol"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Avaliação (1-5)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          value={editingTestimonial.rating || 5}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, rating: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Ordem de Exibição</Label>
                        <Input
                          type="number"
                          value={editingTestimonial.display_order}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, display_order: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingTestimonial.is_active}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, is_active: e.target.checked })}
                        />
                        <Label>Ativo</Label>
                      </div>
                      <Button onClick={() => saveTestimonial(editingTestimonial)} disabled={loading}>
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              {/* Preview dos Depoimentos */}
              <div className="mb-4 md:mb-6 p-3 md:p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-3 text-sm md:text-base">Preview (como aparece na home)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {testimonials.filter(t => t.is_active).slice(0, 3).map((testimonial) => (
                    <Card key={testimonial.id} className="mobile-compact-card">
                      <CardContent className="p-3 md:pt-6">
                        <div className="flex items-center gap-1 mb-2 md:mb-3">
                          {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 md:h-4 md:w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <p className="text-xs md:text-sm mb-3 md:mb-4">{testimonial.content}</p>
                        <div className="flex items-center gap-2 md:gap-3">
                          <Avatar className="h-8 w-8 md:h-10 md:w-10">
                            <AvatarImage src={testimonial.avatar_url} />
                            <AvatarFallback className="text-xs">{testimonial.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-xs md:text-sm">{testimonial.name}</p>
                            {testimonial.role && (
                              <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Listagem de Depoimentos */}
              <div className="space-y-3 md:space-y-4">
                {testimonials.map((testimonial) => (
                  <div key={testimonial.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 border rounded-lg gap-3">
                    <div className="flex gap-3 flex-1 w-full sm:w-auto">
                      <Avatar className="h-10 w-10 md:h-12 md:w-12">
                        <AvatarImage src={testimonial.avatar_url} />
                        <AvatarFallback className="text-xs">{testimonial.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-2">
                          <p className="font-medium text-sm md:text-base truncate">{testimonial.name}</p>
                          {testimonial.role && (
                            <Badge variant="outline" className="text-xs">{testimonial.role}</Badge>
                          )}
                          {!testimonial.is_active && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                          {!testimonial.avatar_url && (
                            <Badge variant="destructive" className="text-xs">Sem foto</Badge>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-2">{testimonial.content}</p>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setEditingTestimonial(testimonial);
                          setAvatarPreview(testimonial.avatar_url || "");
                        }}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        <Edit className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-0" />
                        <span className="sm:hidden">Editar</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => deleteTestimonial(testimonial.id)}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-0" />
                        <span className="sm:hidden">Excluir</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </EnhancedTabsContent>

        <EnhancedTabsContent value="faqs">
          <Card className="mobile-compact-card">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">Gerenciar FAQs</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => setEditingFaq({ 
                      id: "", 
                      question: "", 
                      answer: "", 
                      display_order: faqs.length, 
                      is_active: true 
                    } as any)}
                    className="text-xs md:text-sm"
                  >
                    <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Novo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingFaq?.id ? "Editar" : "Novo"} FAQ
                    </DialogTitle>
                    <DialogDescription>Cadastre ou atualize uma pergunta frequente exibida no site.</DialogDescription>
                  </DialogHeader>
                  {editingFaq && (
                    <div className="space-y-4">
                      <div>
                        <Label>Pergunta *</Label>
                        <Input
                          value={editingFaq.question}
                          onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Resposta *</Label>
                        <Textarea
                          value={editingFaq.answer}
                          onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                          rows={4}
                        />
                      </div>
                      <div>
                        <Label>Categoria</Label>
                        <Input
                          value={editingFaq.category || ""}
                          onChange={(e) => setEditingFaq({ ...editingFaq, category: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Ordem de Exibição</Label>
                        <Input
                          type="number"
                          value={editingFaq.display_order}
                          onChange={(e) => setEditingFaq({ ...editingFaq, display_order: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingFaq.is_active}
                          onChange={(e) => setEditingFaq({ ...editingFaq, is_active: e.target.checked })}
                        />
                        <Label>Ativo</Label>
                      </div>
                      <Button onClick={() => saveFaq(editingFaq)} disabled={loading}>
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="space-y-3 md:space-y-4">
                {faqs.map((faq) => (
                  <div key={faq.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 border rounded-lg gap-3">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-2">
                        <p className="font-medium text-sm md:text-base">{faq.question}</p>
                        {faq.category && (
                          <Badge variant="outline" className="text-xs">{faq.category}</Badge>
                        )}
                        {!faq.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">{faq.answer}</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditingFaq(faq)}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        <Edit className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-0" />
                        <span className="sm:hidden">Editar</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => deleteFaq(faq.id)}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-0" />
                        <span className="sm:hidden">Excluir</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </EnhancedTabsContent>
      </EnhancedTabs>
    </div>
  );
}
