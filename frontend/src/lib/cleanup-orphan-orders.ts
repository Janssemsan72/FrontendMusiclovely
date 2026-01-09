import { supabase } from '@/integrations/supabase/client';

export async function cleanupOrphanOrders(email: string): Promise<void> {
  try {
    console.log('🧹 Limpando orders órfãs para:', email);
    
    const { data: orphanOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', email)
      .eq('status', 'pending')
      .is('stripe_checkout_session_id', null)
      .order('created_at', { ascending: false });
    
    if (orphanOrders && orphanOrders.length > 0) {
      const orphanIds = orphanOrders.map(o => o.id);
      await supabase
        .from('orders')
        .delete()
        .in('id', orphanIds);
      
      console.log(`✅ ${orphanOrders.length} orders órfãs deletadas`);
    }
  } catch (error) {
    console.error('Erro ao limpar orders órfãs:', error);
  }
}
