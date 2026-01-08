// Hook simplificado para tradução
export const useTranslation = () => {
  return {
    t: (key: string) => {
      // Traduções hardcoded para evitar problemas
      const translations: { [key: string]: string } = {
        'hero.platform': 'A plataforma #1 de músicas personalizadas',
        'hero.title': 'Músicas Que Tocam o Coração',
        'hero.subtitle': 'Crie a música perfeita para seus momentos especiais. Propostas, casamentos, tributos — cada nota criada com amor e entregue em 48h.',
        'hero.cta': 'Criar Sua Música Aqui',
        'hero.deliveredWithLove': 'Entregue com amor',
        'hero.over500Songs': 'Mais de 1000 músicas criadas',
        'features.title': 'Como Funciona',
        'features.subtitle': 'Criar sua música personalizada é simples e mágico. Em apenas 3 passos, você terá uma obra-prima única.',
        'features.step1.title': 'Conte Sua História',
        'features.step1.description': 'Responda algumas perguntas sobre seu momento especial, a pessoa e as emoções que deseja transmitir.',
        'features.step2.title': 'Nossa Equipe Cria Sua Música',
        'features.step2.description': 'Entregamos uma música única, criada com dedicação para transformar sua história em melodia e palavras.',
        'features.step3.title': 'Receba Sua Obra-Prima',
        'features.step3.description': 'Receba sua música personalizada em alta qualidade, pronta para compartilhar com o mundo.',
        'pricing.title': 'Investimento Transparente',
        'pricing.subtitle': 'Sem taxas escondidas. Sem surpresas. Apenas música de qualidade profissional.',
        'pricing.mostPopular': 'Mais Popular',
        'pricing.deliveryIn': 'Entrega em',
        'pricing.createMyMusic': 'Criar Minha Música',
        'pricing.features.highQualityMP3': 'MP3 alta qualidade',
        'pricing.features.customCover': 'Capa personalizada',
        'pricing.features.fullLyrics': 'Letra completa',
        'pricing.features.unlimitedDownload': 'Download ilimitado',
        'pricing.features.delivery24h': 'Entrega em 48h',
        'testimonials.title': 'O Que Nossos Clientes Dizem',
        'testimonials.subtitle': 'Histórias reais de pessoas reais que criaram momentos mágicos.',
        'vinyl.title': 'Ouça um Exemplo',
        'vinyl.subtitle': 'Cada faixa é produzida com instrumentos reais e vocais profissionais',
        'vinylPlayer.changingMusic': 'Mudando música...',
        'common.loading': 'Carregando...',
        'faq.title': 'Perguntas Frequentes',
        'faq.subtitle': 'Respostas rápidas para suas dúvidas',
        'faq.questions.musicStyles.question': 'Quais estilos musicais vocês produzem?',
        'faq.questions.musicStyles.answer': 'Produzimos diversos estilos musicais, incluindo pop, rock, sertanejo, MPB, forró, romântico, e muitos outros. Nossa equipe de músicos profissionais pode criar a música perfeita para o seu momento especial.',
        'faq.questions.deliveryTimes.question': 'Como funcionam os prazos?',
        'faq.questions.deliveryTimes.answer': 'Nossa entrega padrão é de 48 horas. Para pedidos expressos, podemos entregar em até 12 horas. Você receberá sua música personalizada no prazo combinado, pronta para compartilhar.',
        'faq.questions.whatYouGet.question': 'O que recebo ao final?',
        'faq.questions.whatYouGet.answer': 'Você recebe um arquivo MP3 de alta qualidade. Tudo isso pronto para download ilimitado.',
        'faq.questions.commercialUse.question': 'Posso usar a música comercialmente?',
        'faq.questions.commercialUse.answer': 'Sim! Você tem total liberdade para usar sua música personalizada como desejar, incluindo uso comercial, redes sociais, eventos e muito mais.'
      };
      
      return translations[key] || key;
    },
    currentLanguage: 'pt'
  };
};
