import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface Testimonial {
  id: string;
  name: string;
  name_en: string | null;
  name_es: string | null;
  role: string | null;
  role_en: string | null;
  role_es: string | null;
  content: string;
  content_en: string | null;
  content_es: string | null;
  avatar_url: string | null;
  rating: number | null;
}

// Função para traduzir testimonial baseado no idioma atual
const getTranslatedTestimonial = (testimonial: Testimonial, language: string) => {
  if (language === 'en') {
    return {
      ...testimonial,
      name: testimonial.name_en || testimonial.name,
      role: testimonial.role_en || testimonial.role,
      content: testimonial.content_en || testimonial.content
    };
  } else if (language === 'es') {
    return {
      ...testimonial,
      name: testimonial.name_es || testimonial.name,
      role: testimonial.role_es || testimonial.role,
      content: testimonial.content_es || testimonial.content
    };
  }
  // Português (padrão)
  return testimonial;
};

export default function Testimonials() {
  const { t, currentLanguage } = useTranslation();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchTestimonials() {
      const { data, error } = await supabase
        .from('testimonials')
        .select('id, name, name_en, name_es, role, role_en, role_es, content, content_en, content_es, avatar_url, rating, is_active, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data) {
        setTestimonials(data);
      }
      setLoading(false);
    }

    fetchTestimonials();
  }, []);

  // Auto-play functionality
  useEffect(() => {
    if (testimonials.length > 1 && isAutoPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => 
          prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
        );
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [testimonials.length, isAutoPlaying]);

  const nextTestimonial = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
    );
    setIsAutoPlaying(false);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1
    );
    setIsAutoPlaying(false);
  };

  const goToTestimonial = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('testimonials.title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('common.loading')}...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (testimonials.length === 0) {
    return null;
  }

  const currentTestimonial = testimonials[currentIndex] 
    ? getTranslatedTestimonial(testimonials[currentIndex], currentLanguage)
    : null;

  if (!currentTestimonial) {
    return null;
  }

  return (
    <section className="py-6 sm:py-12 px-3 sm:px-4 overflow-hidden">
      <div className="container mx-auto">
        <div className="text-center mb-3 sm:mb-5">
          <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-primary/10 text-primary px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
            <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span>{t('testimonials.badge')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('testimonials.title')}
            </span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl sm:max-w-3xl mx-auto leading-relaxed">
            {t('testimonials.subtitle')}
          </p>
        </div>

        {/* Featured Testimonial */}
        <div className="max-w-2xl sm:max-w-3xl mx-auto mb-3 sm:mb-4">
          <Card className="shadow-2xl hover:shadow-3xl transition-all duration-300 ease-in-out border-primary/20 border-2 relative overflow-hidden min-h-[300px] sm:min-h-[280px] md:min-h-[260px]">
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 text-primary/20">
              <Quote className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <CardContent className="p-3 sm:p-4 md:p-5 text-center min-h-[280px] sm:min-h-[260px] md:min-h-[240px] flex flex-col justify-center">
              <div className="flex justify-center gap-0.5 mb-2 sm:mb-2.5">
                {Array.from({ length: currentTestimonial.rating || 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              
              <blockquote className="text-sm sm:text-base md:text-lg text-foreground mb-2.5 sm:mb-3 italic leading-relaxed max-h-[150px] overflow-y-auto">
                "{currentTestimonial.content}"
              </blockquote>
              
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 sm:border-3 border-primary/20 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  {currentTestimonial.avatar_url ? (
                    <img 
                      src={currentTestimonial.avatar_url} 
                      alt={currentTestimonial.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback para avatar padrão se a imagem não carregar
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm sm:text-base" style={{ display: currentTestimonial.avatar_url ? 'none' : 'flex' }}>
                    {currentTestimonial.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-foreground text-sm sm:text-base md:text-lg">{currentTestimonial.name}</p>
                  {currentTestimonial.role && (
                    <p className="text-muted-foreground text-xs sm:text-sm">{currentTestimonial.role}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={prevTestimonial}
            className="p-3 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all hover:scale-110"
            aria-label="Depoimento anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="flex gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToTestimonial(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-primary scale-125' 
                    : 'bg-primary/30 hover:bg-primary/50'
                }`}
                aria-label={`Ir para depoimento ${index + 1}`}
              />
            ))}
          </div>
          
          <button
            onClick={nextTestimonial}
            className="p-3 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all hover:scale-110"
            aria-label="Próximo depoimento"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* All Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
          {testimonials.slice(0, 3).map((testimonial, index) => {
            const translatedTestimonial = getTranslatedTestimonial(testimonial, currentLanguage);
            return (
              <Card 
                key={testimonial.id} 
                className={`shadow-soft hover:shadow-medium transition-all cursor-pointer ${
                  index === currentIndex ? 'ring-2 ring-primary/50' : ''
                }`}
                onClick={() => goToTestimonial(index)}
              >
                <CardContent className="p-3">
                  <div className="flex gap-1 mb-2">
                    {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-foreground mb-2 italic text-base leading-relaxed line-clamp-3">
                    "{translatedTestimonial.content}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      {translatedTestimonial.avatar_url ? (
                        <img 
                          src={translatedTestimonial.avatar_url} 
                          alt={translatedTestimonial.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                          }}
                        />
                      ) : null}
                      <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm" style={{ display: translatedTestimonial.avatar_url ? 'none' : 'flex' }}>
                        {translatedTestimonial.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-base">{translatedTestimonial.name}</p>
                      {translatedTestimonial.role && (
                        <p className="text-sm text-muted-foreground">{translatedTestimonial.role}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Stats */}
        <div className="mt-4 text-center">
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl p-4 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">500+</div>
                <div className="text-base text-muted-foreground">Músicas Criadas</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">5.0</div>
                <div className="text-base text-muted-foreground">Avaliação Média</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">48h</div>
                <div className="text-base text-muted-foreground">Tempo de Entrega</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
