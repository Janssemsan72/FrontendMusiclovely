import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Sparkles, Music, Clock, CheckCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function HowItWorks() {
  const { t } = useTranslation();
  
  const steps = [
    {
      icon: MessageCircle,
      title: t('features.step1.title'),
      description: t('features.step1.description'),
      time: t('features.step1.time'),
      highlight: t('features.step1.highlight')
    },
    {
      icon: Sparkles,
      title: t('features.step2.title'),
      description: t('features.step2.description'),
      time: t('features.step2.time'),
      highlight: t('features.step2.highlight')
    },
    {
      icon: Music,
      title: t('features.step3.title'),
      description: t('features.step3.description'),
      time: t('features.step3.time'),
      highlight: t('features.step3.highlight')
    },
  ];

  return (
    <section id="como-funciona" className="py-4 sm:py-8 relative overflow-hidden scroll-mt-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent -z-10" />
      
      <div className="text-center mb-3 sm:mb-5">
        <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-primary/10 text-primary px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          <span>{t('features.badge')}</span>
        </div>
        <h2 id="como-funciona-title" tabIndex={-1} className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-3 outline-none">
          {t('features.title')}
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl sm:max-w-3xl mx-auto px-2 sm:px-4 leading-relaxed">
          {t('features.subtitle')}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3 sm:gap-4 md:gap-5 mb-3 sm:mb-4">
        {steps.map((step, index) => (
          <div
            key={index}
            className="relative glass rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-glass border border-border/50 text-center hover:shadow-medium transition-all hover:scale-105 group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-soft group-hover:scale-110 transition-transform">
              <step.icon className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
            </div>
            
            <div className="mb-2 sm:mb-3">
              <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-accent/20 text-accent px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold mb-1.5 sm:mb-2">
                <Clock className="h-2.5 w-2.5" />
                <span>{step.time}</span>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground mb-1.5 sm:mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm md:text-base leading-relaxed">
                {step.description}
              </p>
            </div>

            <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-primary">
              <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>{step.highlight}</span>
            </div>

            {index < steps.length - 1 && (
              <div className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 text-4xl text-primary/30 group-hover:text-primary/50 transition-colors">
                <ArrowRight className="h-6 w-6" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center px-2 sm:px-4">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg sm:rounded-xl p-3 sm:p-4 max-w-xl sm:max-w-2xl mx-auto">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground mb-1.5 sm:mb-2">
            {t('features.cta.title')}
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
            {t('features.cta.subtitle')}
          </p>
          <Link
            to="/quiz"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-5 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold text-sm sm:text-base shadow-soft transition-all hover:scale-105 group"
          >
            {/* ✅ CORREÇÃO: Fallback para garantir texto sempre visível */}
            <span>🎵 {t('features.cta.button', 'Criar Minha Música')}</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
