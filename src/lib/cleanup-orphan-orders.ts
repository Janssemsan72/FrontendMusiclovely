import { supabase } from '@/integrations/supabase/client';

export async function cleanupOrphanOrders(email: string): Promise<void> {
  try {
    console.log('🧹 Limpando orders órfãs para:', email);
    
    // ✅ CORREÇÃO: Usar sintaxe correta do Supabase para verificar null
    // O método .is() está disponível e deve ser usado corretamente
    const { data: orphanOrders, error: selectError } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', email)
      .eq('status', 'pending')
      .is('stripe_checkout_session_id', null)
      .order('created_at', { ascending: false });
    
    if (selectError) {
      console.error('Erro ao buscar orders órfãs:', selectError);
      return;
    }
    
    if (orphanOrders && orphanOrders.length > 0) {
      const orphanIds = orphanOrders.map(o => o.id);
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .in('id', orphanIds);
      
      if (deleteError) {
        console.error('Erro ao deletar orders órfãs:', deleteError);
        return;
      }
      
      console.log(`✅ ${orphanOrders.length} orders órfãs deletadas`);
    }
  } catch (error) {
    console.error('Erro ao limpar orders órfãs:', error);
  }
}
