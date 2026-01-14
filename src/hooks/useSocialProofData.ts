import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SocialProofMessage {
  id: string;
  name: string;
  message: string;
  timeAgo: string;
  action: 'created' | 'purchased';
  avatarUrl: string;
}

// Lista de 30 nomes brasileiros diferentes
const NAMES_LIST = [
  'João', 'Maria', 'Ana', 'Pedro', 'Carlos', 'Juliana', 'Fernanda', 'Ricardo',
  'Patricia', 'Lucas', 'Mariana', 'Rafael', 'Camila', 'Bruno', 'Isabela',
  'Gabriel', 'Larissa', 'Thiago', 'Beatriz', 'Felipe', 'Amanda', 'Rodrigo',
  'Vanessa', 'Gustavo', 'Carolina', 'André', 'Marcos', 'Renata', 'Sofia', 'Diego'
];

// Lista de 30 avatares de pessoas reais usando Random User API
// Cada índice corresponde a uma foto real de pessoa (homem ou mulher)
// Usando índices fixos para garantir 30 pessoas diferentes
const REAL_AVATAR_INDICES = [
  // Mulheres (15 avatares)
  { gender: 'women', index: 1 }, { gender: 'women', index: 5 }, { gender: 'women', index: 8 },
  { gender: 'women', index: 12 }, { gender: 'women', index: 15 }, { gender: 'women', index: 18 },
  { gender: 'women', index: 22 }, { gender: 'women', index: 25 }, { gender: 'women', index: 28 },
  { gender: 'women', index: 32 }, { gender: 'women', index: 35 }, { gender: 'women', index: 38 },
  { gender: 'women', index: 42 }, { gender: 'women', index: 45 }, { gender: 'women', index: 48 },
  // Homens (15 avatares)
  { gender: 'men', index: 2 }, { gender: 'men', index: 6 }, { gender: 'men', index: 9 },
  { gender: 'men', index: 13 }, { gender: 'men', index: 16 }, { gender: 'men', index: 19 },
  { gender: 'men', index: 23 }, { gender: 'men', index: 26 }, { gender: 'men', index: 29 },
  { gender: 'men', index: 33 }, { gender: 'men', index: 36 }, { gender: 'men', index: 39 },
  { gender: 'men', index: 43 }, { gender: 'men', index: 46 }, { gender: 'men', index: 49 }
];

// Função para gerar URL de avatar de pessoa real usando Random User API
function getAvatarUrl(index: number, name: string): string {
  // Usar índice para selecionar uma das 30 pessoas reais
  const avatarConfig = REAL_AVATAR_INDICES[index % REAL_AVATAR_INDICES.length];
  
  // Random User API retorna fotos reais de pessoas
  // Usando formato thumbnail (menor) para compressão, mas ainda são fotos reais
  return `https://randomuser.me/api/portraits/${avatarConfig.gender}/${avatarConfig.index}.jpg`;
}

// Tipos de mensagens variadas - mais de 30 variações
const MESSAGE_TEMPLATES = {
  created: [
    'acabou de criar uma música personalizada',
    'criou uma música personalizada',
    'acabou de finalizar sua música',
    'criou uma música especial',
    'finalizou a criação da sua música',
    'acabou de criar uma música única',
    'criou uma música personalizada para presente',
    'finalizou sua música personalizada',
    'acabou de criar uma música exclusiva',
    'criou uma música especial personalizada',
    'finalizou a produção da sua música',
    'acabou de criar sua música dos sonhos',
    'criou uma música única e especial',
    'finalizou sua música personalizada agora',
    'acabou de criar uma música inesquecível',
    'criou uma música especial há pouco',
    'finalizou a criação da música',
    'acabou de criar uma música incrível',
    'criou sua música personalizada agora',
    'finalizou sua música única',
    'acabou de criar uma música para presente',
    'criou uma música especial recentemente',
    'finalizou a produção da música',
    'acabou de criar uma música surpreendente',
    'criou uma música personalizada única',
    'finalizou sua criação musical',
    'acabou de criar uma música especial agora',
    'criou uma música dos sonhos',
    'finalizou sua música exclusiva',
    'acabou de criar uma música personalizada incrível'
  ],
  purchased: [
    'acabou de comprar',
    'comprou há pouco',
    'finalizou sua compra',
    'adquiriu um plano',
    'acabou de adquirir',
    'comprou agora mesmo',
    'finalizou a compra',
    'adquiriu há instantes',
    'acabou de fazer a compra',
    'comprou recentemente',
    'finalizou sua aquisição',
    'adquiriu um plano agora',
    'acabou de comprar um plano',
    'comprou um plano personalizado',
    'finalizou a compra do plano',
    'adquiriu há momentos',
    'acabou de adquirir o plano',
    'comprou o plano agora',
    'finalizou a compra recentemente',
    'adquiriu o plano há pouco',
    'acabou de fazer a compra do plano',
    'comprou o plano personalizado',
    'finalizou sua compra agora',
    'adquiriu há instantes',
    'acabou de comprar recentemente',
    'comprou o plano há pouco',
    'finalizou a aquisição agora',
    'adquiriu o plano recentemente',
    'acabou de adquirir há momentos',
    'comprou agora mesmo',
    'finalizou a compra há instantes',
    'adquiriu o plano agora',
    'acabou de fazer a compra agora',
    'comprou recentemente',
    'finalizou sua compra há pouco',
    'adquiriu um plano personalizado',
    'acabou de comprar o plano agora',
    'comprou há instantes',
    'finalizou a compra do plano agora',
    'adquiriu recentemente',
    'acabou de fazer a aquisição',
    'comprou o plano há instantes',
    'finalizou sua compra recentemente',
    'adquiriu o plano há momentos',
    'acabou de comprar há pouco',
    'comprou agora',
    'finalizou a compra há momentos',
    'adquiriu há pouco'
  ]
};

// Função para formatar tempo relativo - apenas até 2 minutos
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 30) {
    return 'há alguns instantes';
  } else if (diffSecs < 60) {
    return 'há menos de 1 minuto';
  } else if (diffMins === 1) {
    return 'há 1 minuto';
  } else if (diffMins === 2) {
    return 'há 2 minutos';
  } else {
    // Se passar de 2 minutos, não deve aparecer (será filtrado)
    return 'há alguns minutos';
  }
}

// Função para extrair nome do email (mantida para compatibilidade, mas agora usa lista de 30 nomes)
function extractNameFromEmail(email: string): string {
  // Usar função que retorna um dos 30 nomes diferentes baseado no email
  return getNameFromEmail(email);
}

// Função para gerar avatar URL baseado no email usando uma das 30 imagens webp comprimidas
function getAvatarUrlFromEmail(email: string, name: string): string {
  // Usar hash do email para sempre retornar a mesma imagem para o mesmo email
  // Isso garante consistência: mesmo email = mesma imagem
  const emailHash = email.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  // Usar índice baseado no hash (0-29 para ter exatamente 30 variações)
  const avatarIndex = Math.abs(emailHash % 30);
  
  // Obter nome correspondente ao índice
  const avatarName = NAMES_LIST[avatarIndex];
  
  // Gerar URL de avatar webp comprimido
  return getAvatarUrl(avatarIndex, avatarName);
}

// Função para obter nome da lista de 30 nomes baseado no email
function getNameFromEmail(email: string): string {
  const emailHash = email.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  // Usar índice baseado no hash (0-29 para ter exatamente 30 nomes diferentes)
  const nameIndex = Math.abs(emailHash % 30);
  
  return NAMES_LIST[nameIndex];
}

// Função para gerar dados simulados
function generateSimulatedData(count: number = 10): SocialProofMessage[] {
  const messages: SocialProofMessage[] = [];
  const usedNames = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    // Selecionar nome aleatório que não foi usado recentemente
    let name: string;
    let attempts = 0;
    do {
      name = NAMES_LIST[Math.floor(Math.random() * NAMES_LIST.length)];
      attempts++;
    } while (usedNames.has(name) && attempts < 10);
    
    usedNames.add(name);
    if (usedNames.size > 5) {
      // Limitar nomes usados para permitir rotação
      const first = Array.from(usedNames)[0];
      usedNames.delete(first);
    }

    // Gerar tempo aleatório entre 1 minuto e 2 horas atrás
    const minutesAgo = Math.floor(Math.random() * 120) + 1;
    const timeAgo = new Date(Date.now() - minutesAgo * 60000);
    
    // Alternar entre created e purchased
    const action: 'created' | 'purchased' = Math.random() > 0.5 ? 'created' : 'purchased';
    const templates = MESSAGE_TEMPLATES[action];
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Gerar avatar URL baseado no nome
    const email = `${name.toLowerCase()}@example.com`;
    const avatarUrl = getAvatarUrlFromEmail(email, name);
    
    messages.push({
      id: `simulated-${i}-${Date.now()}`,
      name,
      message: `${name} ${template}`,
      timeAgo: formatTimeAgo(timeAgo),
      action,
      avatarUrl
    });
  }
  
  return messages;
}

// Hook para buscar dados reais do Supabase
async function fetchRealData(): Promise<SocialProofMessage[]> {
  try {
    // Buscar últimas 10 minutos para ter mais dados, mas mostrar apenas as mais recentes
    const last10Minutes = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('orders')
      .select('customer_email, paid_at, created_at, plan, status')
      .eq('status', 'paid')
      .gte('paid_at', last10Minutes)
      .order('paid_at', { ascending: false })
      .limit(200);

    if (error) {
      if (import.meta.env.DEV) {
        console.warn('Erro ao buscar dados de prova social:', error);
      }
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const now = new Date();
    const messages: SocialProofMessage[] = data
      .map((order, index) => {
        const email = order.customer_email || 'cliente@example.com';
        const name = extractNameFromEmail(email);
        const paidAt = order.paid_at ? new Date(order.paid_at) : new Date(order.created_at);
        
        // Verificar se está dentro de 2 minutos para mostrar
        const diffMins = Math.floor((now.getTime() - paidAt.getTime()) / 60000);
        
        // Filtrar apenas compras de até 2 minutos para exibição
        if (diffMins > 2) {
          return null;
        }
        
        // Alternar entre created e purchased baseado no índice
        const action: 'created' | 'purchased' = index % 2 === 0 ? 'purchased' : 'created';
        const templates = MESSAGE_TEMPLATES[action];
        const template = templates[index % templates.length];
        
        // Gerar avatar URL baseado no email
        const avatarUrl = getAvatarUrlFromEmail(email, name);
        
        return {
          id: `order-${email}-${index}`,
          name,
          message: `${name} ${template}`,
          timeAgo: formatTimeAgo(paidAt),
          action,
          avatarUrl
        };
      })
      .filter((msg): msg is SocialProofMessage => msg !== null);

    // Se não houver mensagens recentes (últimos 2 min), usar as mais recentes disponíveis
    // mas ajustar o tempo para mostrar como "há 1 minuto" ou "há 2 minutos"
    if (messages.length === 0 && data.length > 0) {
      const mostRecent = data.slice(0, Math.min(10, data.length));
      return mostRecent.map((order, index) => {
        const email = order.customer_email || 'cliente@example.com';
        const name = extractNameFromEmail(email);
        const paidAt = order.paid_at ? new Date(order.paid_at) : new Date(order.created_at);
        const diffMins = Math.floor((now.getTime() - paidAt.getTime()) / 60000);
        
        // Limitar a mostrar no máximo como "há 2 minutos"
        const displayMins = Math.min(diffMins, 2);
        const action: 'created' | 'purchased' = index % 2 === 0 ? 'purchased' : 'created';
        const templates = MESSAGE_TEMPLATES[action];
        const template = templates[index % templates.length];
        
        // Gerar avatar URL baseado no email
        const avatarUrl = getAvatarUrlFromEmail(email, name);
        
        return {
          id: `order-${email}-${index}`,
          name,
          message: `${name} ${template}`,
          timeAgo: displayMins === 1 ? 'há 1 minuto' : 'há 2 minutos',
          action,
          avatarUrl
        };
      });
    }

    return messages;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Erro ao buscar dados de prova social:', error);
    }
    return [];
  }
}

export function useSocialProofData() {
  const [messages, setMessages] = useState<SocialProofMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      
      try {
        // Sempre buscar dados reais, sem fallback de simulados
        const data = await fetchRealData();

        if (!cancelled) {
          setMessages(data);
          // Debug: log apenas em desenvolvimento
          if (import.meta.env.DEV) {
            console.log('[SocialProof] Mensagens carregadas:', data.length);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Erro ao carregar dados de prova social:', error);
        }
        if (!cancelled) {
          // Em caso de erro, retornar array vazio (não mostrar notificações)
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Deferir carregamento para não bloquear renderização inicial
    const timer = setTimeout(() => {
      loadData();
    }, 1000);

    // Recarregar dados a cada 60 segundos para pegar novas compras (otimizado)
    // Usar requestIdleCallback quando disponível para não bloquear thread principal
    const scheduleRefresh = () => {
      if (cancelled) return;
      
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const w = window as any;
        const id = w.requestIdleCallback(() => {
          if (!cancelled) {
            loadData();
            // Agendar próximo refresh
            setTimeout(scheduleRefresh, 60000);
          }
        }, { timeout: 5000 });
        
        return () => {
          if (typeof w.cancelIdleCallback === 'function') {
            w.cancelIdleCallback(id);
          }
        };
      } else {
        // Fallback para navegadores sem requestIdleCallback
        const timeoutId = setTimeout(() => {
          if (!cancelled) {
            loadData();
            scheduleRefresh();
          }
        }, 60000);
        
        return () => clearTimeout(timeoutId);
      }
    };
    
    const cleanupRefresh = scheduleRefresh();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (cleanupRefresh) {
        cleanupRefresh();
      }
    };
  }, []);

  return { messages, loading };
}
