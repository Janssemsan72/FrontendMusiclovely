import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "@/hooks/useTranslation";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export default function FAQ() {
  const { t } = useTranslation();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);

  // Função para traduzir perguntas e respostas hardcoded
  const translateFAQ = useCallback((faq: FAQ): FAQ => {
    const faqMap: { [key: string]: { question: string; answer: string } } = {
      'Quais estilos musicais vocês produzem?': {
        question: t('faq.questions.musicStyles.question'),
        answer: t('faq.questions.musicStyles.answer')
      },
      'Como funcionam os prazos?': {
        question: t('faq.questions.deliveryTimes.question'),
        answer: t('faq.questions.deliveryTimes.answer')
      },
      'O que recebo ao final?': {
        question: t('faq.questions.whatYouGet.question'),
        answer: t('faq.questions.whatYouGet.answer')
      },
      'Posso usar a música comercialmente?': {
        question: t('faq.questions.commercialUse.question'),
        answer: t('faq.questions.commercialUse.answer')
      }
    };

    const translation = faqMap[faq.question];
    if (translation) {
      return {
        ...faq,
        question: translation.question,
        answer: translation.answer
      };
    }
    return faq;
  }, [t]);

  useEffect(() => {
    async function fetchFAQs() {
      try {
        const { data, error } = await supabase
          .from('faqs')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) {
          // Aplicar traduções para dados do banco
          const translatedFaqs = data.map(translateFAQ);
          setFaqs(translatedFaqs);
        } else {
          // Fallback to default FAQs
          const defaultFaqs = [
            {
              id: '1',
              question: t('faq.questions.musicStyles.question') || 'Quais estilos musicais vocês produzem?',
              answer: t('faq.questions.musicStyles.answer') || 'Produzimos diversos estilos musicais, incluindo pop, rock, sertanejo, MPB, forró, romântico, e muitos outros.'
            },
            {
              id: '2',
              question: t('faq.questions.deliveryTimes.question') || 'Como funcionam os prazos?',
              answer: t('faq.questions.deliveryTimes.answer') || 'Nossa entrega é de até 6 horas.'
            },
            {
              id: '3',
              question: t('faq.questions.whatYouGet.question') || 'O que recebo ao final?',
              answer: t('faq.questions.whatYouGet.answer') || 'Você recebe um arquivo MP3 de alta qualidade.'
            },
            {
              id: '4',
              question: t('faq.questions.commercialUse.question') || 'Posso usar a música comercialmente?',
              answer: t('faq.questions.commercialUse.answer') || 'Sim! Você tem total liberdade para usar sua música personalizada como desejar.'
            }
          ];
          // Aplicar traduções para fallback
          const translatedDefaultFaqs = defaultFaqs.map(translateFAQ);
          setFaqs(translatedDefaultFaqs);
        }
      } catch (err) {
        // Em caso de erro, usar fallback
        console.error('Erro ao carregar FAQs:', err);
        const defaultFaqs = [
          {
            id: '1',
            question: t('faq.questions.musicStyles.question') || 'Quais estilos musicais vocês produzem?',
            answer: t('faq.questions.musicStyles.answer') || 'Produzimos diversos estilos musicais.'
          },
          {
            id: '2',
            question: t('faq.questions.deliveryTimes.question') || 'Como funcionam os prazos?',
            answer: t('faq.questions.deliveryTimes.answer') || 'Nossa entrega é de até 6 horas.'
          },
          {
            id: '3',
            question: t('faq.questions.whatYouGet.question') || 'O que recebo ao final?',
            answer: t('faq.questions.whatYouGet.answer') || 'Você recebe um arquivo MP3 de alta qualidade.'
          },
          {
            id: '4',
            question: t('faq.questions.commercialUse.question') || 'Posso usar a música comercialmente?',
            answer: t('faq.questions.commercialUse.answer') || 'Sim! Você tem total liberdade para usar sua música.'
          }
        ];
        const translatedDefaultFaqs = defaultFaqs.map(translateFAQ);
        setFaqs(translatedDefaultFaqs);
      } finally {
        setLoading(false);
      }
    }

    fetchFAQs();
  }, [t, translateFAQ]);

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {t('faq.title')}
          </h2>
          <p className="text-muted-foreground text-center">{t('common.loading')}</p>
        </div>
      </section>
    );
  }

  return (
    <section id="faq" className="py-6 sm:py-16 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-6 sm:mb-10">
          <h2 id="faq-title" tabIndex={-1} className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 outline-none">
            {t('faq.title')}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
            {t('faq.subtitle')}
          </p>
        </div>

        <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-glass border border-border/50">
          {faqs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left text-sm sm:text-base md:text-lg font-semibold text-foreground hover:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs sm:text-sm md:text-base leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Carregando perguntas frequentes...
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
