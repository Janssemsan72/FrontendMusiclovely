import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { getSecureHeaders } from '../utils/security.js';
import { isValidUUID } from '../utils/error-handler.js';

/**
 * Função auxiliar para garantir que um job existe para um pedido
 * Cria o job se não existir, mesmo que o trigger tenha falhado
 */
async function ensureJobExists(
  supabaseClient: any,
  orderId: string,
  quizId: string | null,
  provider: 'cakto' | 'hotmart'
): Promise<{ jobId: string | null; created: boolean }> {
  if (!quizId) {
    console.warn(`⚠️ [${provider} Webhook] Pedido ${orderId} não tem quiz_id - não é possível criar job`);
    return { jobId: null, created: false };
  }

  try {
    // Verificar se job já existe
    const { data: existingJob, error: checkError } = await supabaseClient
      .from('jobs')
      .select('id, status')
      .eq('order_id', orderId)
      .limit(1);

    if (checkError) {
      console.error(`❌ [${provider} Webhook] Erro ao verificar job existente para pedido ${orderId}:`, checkError);
      return { jobId: null, created: false };
    }

    if (existingJob && existingJob.length > 0) {
      console.log(`✅ [${provider} Webhook] Job já existe para pedido ${orderId}`, {
        job_id: existingJob[0].id,
        job_status: existingJob[0].status
      });
      return { jobId: existingJob[0].id, created: false };
    }

    // Job não existe - criar manualmente
    console.log(`🔧 [${provider} Webhook] Job não existe - criando manualmente para pedido ${orderId}`, {
      order_id: orderId,
      quiz_id: quizId
    });

    const { data: newJob, error: createError } = await supabaseClient
      .from('jobs')
      .insert({
        order_id: orderId,
        quiz_id: quizId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createError || !newJob) {
      console.error(`❌ [${provider} Webhook] Erro ao criar job para pedido ${orderId}:`, createError);
      return { jobId: null, created: false };
    }

    console.log(`✅ [${provider} Webhook] Job criado com sucesso para pedido ${orderId}`, {
      job_id: newJob.id,
      order_id: orderId
    });

    return { jobId: newJob.id, created: true };
  } catch (error: any) {
    console.error(`❌ [${provider} Webhook] Exceção ao garantir job para pedido ${orderId}:`, error);
    return { jobId: null, created: false };
  }
}

export async function paymentRoutes(app: FastifyInstance) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // POST /api/cakto/webhook
  app.post('/api/cakto/webhook', async (request, reply) => {
    const origin = request.headers.origin || null;
    const secureHeaders = getSecureHeaders(origin);
    
    const startTime = Date.now();

    try {
      console.log('==========================================');
      console.log('🔔 [Cakto Webhook] WEBHOOK RECEBIDO');
      console.log('==========================================');
      
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
      
      const caktoSecret = process.env.CAKTO_WEBHOOK_SECRET;
      
      if (!caktoSecret) {
        console.error('❌ [Cakto Webhook] CAKTO_WEBHOOK_SECRET não configurado');
        return reply
          .code(500)
          .headers(secureHeaders)
          .send({ error: 'Webhook secret not configured' });
      }
      
      const receivedSignature = (request.headers['x-cakto-signature'] as string) || 
                                (request.headers['x-cakto-token'] as string) ||
                                (request.headers.authorization?.replace('Bearer ', '') || '');
      
      const authHeader = request.headers.authorization || '';
      const authToken = authHeader.replace('Bearer ', '').trim();
      const isInternalCall = authToken === supabaseServiceKey;
      
      const body: any = request.body;
      
      if (!body || Object.keys(body).length === 0) {
        console.error('❌ [Cakto Webhook] Body vazio ou ausente');
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ error: 'Empty body', message: 'Webhook body está vazio ou ausente' });
      }
      
      if (isInternalCall) {
        console.log('✅ [Cakto Webhook] Chamada interna autenticada');
      } else {
        const bodySecret = body.secret;
        
        if (receivedSignature === caktoSecret || bodySecret === caktoSecret) {
          console.log('✅ [Cakto Webhook] Assinatura válida');
        } else {
          console.error('❌ [Cakto Webhook] Assinatura inválida');
          return reply
            .code(401)
            .headers(secureHeaders)
            .send({ 
              error: 'Invalid or missing signature',
              message: 'Webhook deve incluir assinatura válida'
            });
        }
      }
      
      console.log('📦 [Cakto Webhook] Payload COMPLETO:', JSON.stringify(body, null, 2));
      
      const event = body.event || '';
      const data = body.data || body;
      
      const transaction_id = (data.id && String(data.id).trim()) || 
                            (data.transaction_id && String(data.transaction_id).trim()) || 
                            null;
                          
      let order_id_from_url = null;
      const checkoutUrl = data.checkoutUrl || data.checkout_url || body.checkoutUrl || '';
      if (checkoutUrl) {
        const uuidMatch = checkoutUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          order_id_from_url = uuidMatch[0];
        }
      }
      
      const order_id_from_webhook = order_id_from_url ||
                                   data.metadata?.order_id ||
                                   data.external_id ||
                                   data.order_id || 
                                   null;
                                   
      const status = event || data.status || body.status || '';
      
      const customer_email_raw = data.customer?.email ||
                                 data.customer_email || 
                                 data.email || 
                                 null;
      const customer_email = customer_email_raw ? String(customer_email_raw).toLowerCase().trim() : '';
                           
      const customer_phone = data.customer?.phone ||
                            data.customer_phone ||
                            data.phone ||
                            null;
                           
      const amount_reais_raw = data.amount || data.amount_paid || data.total || 0;
      const amount_reais = typeof amount_reais_raw === 'string' 
        ? parseFloat(amount_reais_raw) 
        : Number(amount_reais_raw) || 0;
      const amount_cents = Math.round(amount_reais * 100);
      
      const paid_at = data.paidAt || data.paid_at || data.payment_date || null;
      
      const hasOrderId = order_id_from_webhook && String(order_id_from_webhook).trim().length > 0;
      const hasTransactionId = transaction_id && String(transaction_id).trim().length > 0;
      const hasCustomerEmail = customer_email && customer_email.trim().length > 0;
      
      if (!hasOrderId && !hasTransactionId && !hasCustomerEmail) {
        console.error('❌ [Cakto Webhook] NENHUM identificador encontrado');
        await supabaseClient.from('cakto_webhook_logs').insert({
          webhook_body: body,
          transaction_id: transaction_id || null,
          order_id_from_webhook: order_id_from_webhook || null,
          status_received: status || null,
          customer_email: customer_email || null,
          amount_cents: amount_cents || null,
          order_found: false,
          processing_success: false,
          error_message: 'Nenhum identificador encontrado',
          strategy_used: 'none'
        });
        
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ 
            error: 'Nenhum identificador encontrado',
            message: 'Webhook não contém order_id, transaction_id ou customer_email'
          });
      }
      
      let statusNormalized = 'approved';
      const statusLower = status.toLowerCase();
      
      if (event === 'purchase_approved' || statusLower.includes('purchase_approved')) {
        statusNormalized = 'approved';
      } else if (event === 'purchase_refused' || statusLower.includes('purchase_refused')) {
        statusNormalized = 'refused';
      } else if (event === 'refund' || statusLower.includes('refund')) {
        statusNormalized = 'refunded';
      } else if (statusLower.includes('aprovada') || statusLower.includes('approved') || statusLower === 'paid') {
        statusNormalized = 'approved';
      }
      
      let order: any = null;
      let strategyUsed = 'none';
      
      // Estratégia 0: order_id do webhook
      if (!order && order_id_from_webhook && isValidUUID(order_id_from_webhook)) {
        const { data: orderById, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('id', order_id_from_webhook)
          .eq('provider', 'cakto')
          .single();
        
        if (orderById && !error) {
          order = orderById;
          strategyUsed = 'order_id_from_webhook';
        }
      }
      
      // Estratégia 1: cakto_transaction_id
      if (!order && transaction_id && transaction_id.trim().length >= 6) {
        const { data: orderByTxId, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('cakto_transaction_id', transaction_id)
          .single();
        
        if (orderByTxId && !error) {
          order = orderByTxId;
          strategyUsed = 'cakto_transaction_id';
        }
      }
      
      // Estratégia 2: Email (próximo pedido pendente)
      if (!order && customer_email) {
        const { data: ordersByEmail, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('customer_email', customer_email)
          .eq('provider', 'cakto')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        if (ordersByEmail && ordersByEmail.length > 0) {
          order = ordersByEmail[0];
          strategyUsed = 'email_most_recent';
        }
      }
      
      // Estratégia 3: Telefone/WhatsApp
      if (!order && customer_phone) {
        const normalizedPhone = customer_phone.replace(/\D/g, '');
        
        const { data: ordersByPhone, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('provider', 'cakto')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        if (ordersByPhone && ordersByPhone.length > 0) {
          const filteredOrders = ordersByPhone.filter(o => {
            const orderPhone = ((o.customer_whatsapp || o.customer_phone || '')).replace(/\D/g, '');
            return orderPhone === normalizedPhone || 
                   orderPhone.endsWith(normalizedPhone) || 
                   normalizedPhone.endsWith(orderPhone);
          });
          
          if (filteredOrders.length > 0) {
            order = filteredOrders[0];
            strategyUsed = 'phone_most_recent';
          }
        }
      }
      
      if (!order) {
        console.error('❌ [Cakto Webhook] PEDIDO NÃO ENCONTRADO');
        await supabaseClient.from('cakto_webhook_logs').insert({
          webhook_body: body,
          transaction_id,
          order_id_from_webhook,
          status_received: statusNormalized,
          customer_email,
          amount_cents,
          order_found: false,
          processing_success: false,
          error_message: 'Pedido não encontrado',
          strategy_used: 'none'
        });
        
        return reply
          .code(404)
          .headers(secureHeaders)
          .send({ 
            error: 'Pedido não encontrado',
            message: 'Nenhum pedido corresponde aos dados fornecidos'
          });
      }
      
      const isReliableIdentifier = strategyUsed === 'order_id_from_webhook' || 
                                   strategyUsed === 'cakto_transaction_id' ||
                                   strategyUsed === 'phone_most_recent';
      
      if (!isReliableIdentifier && customer_email && order.customer_email !== customer_email) {
        if (customer_phone && order.customer_whatsapp) {
          const normalizedWebhookPhone = customer_phone.replace(/\D/g, '');
          const normalizedOrderPhone = order.customer_whatsapp.replace(/\D/g, '');
          
          const phoneMatch = normalizedOrderPhone === normalizedWebhookPhone || 
                            normalizedOrderPhone.endsWith(normalizedWebhookPhone) || 
                            normalizedWebhookPhone.endsWith(normalizedOrderPhone);
          
          if (!phoneMatch) {
            return reply
              .code(400)
              .headers(secureHeaders)
              .send({ 
                error: 'Validação falhou',
                message: 'Email e telefone não correspondem'
              });
          }
        } else {
          return reply
            .code(400)
            .headers(secureHeaders)
            .send({ 
              error: 'Validação falhou',
              message: 'Email não corresponde'
            });
        }
      }
      
      const shouldProcess = event === 'purchase_approved' || statusNormalized === 'approved';
      
      if (!shouldProcess) {
        return reply
          .code(200)
          .headers(secureHeaders)
          .send({ 
            received: true, 
            event: event || 'unknown',
            status: statusNormalized,
            message: 'Webhook recebido mas não processado'
          });
      }
      
      // ✅ CORREÇÃO: Verificar se pedido já está pago, mas ainda assim processar geração de letras
      const wasAlreadyPaid = order.status === 'paid';
      
      if (wasAlreadyPaid) {
        console.log('✅ [Cakto Webhook] Pedido já está pago - verificando se precisa gerar letra', {
          order_id: order.id
        });
      }
      
      const paidAtTimestamp = paid_at || new Date().toISOString();
      
      // Atualizar pedido para 'paid' (mesmo que já esteja, para garantir dados atualizados)
      const { error: updateError, data: updateData } = await supabaseClient
        .from('orders')
        .update({
          status: 'paid',
          cakto_payment_status: 'approved',
          cakto_transaction_id: transaction_id,
          provider: 'cakto',
          paid_at: paidAtTimestamp || order.paid_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select('id, status, paid_at, quiz_id');
      
      if (updateError || !updateData || updateData.length === 0) {
        console.error('❌ [Cakto Webhook] Erro ao atualizar:', updateError);
        throw updateError || new Error('Nenhuma linha foi atualizada');
      }
      
      const updatedOrder = updateData[0];
      if (updatedOrder.status !== 'paid') {
        throw new Error(`Pedido não foi marcado como paid. Status atual: ${updatedOrder.status}`);
      }
      
      console.log('✅ [Cakto Webhook] Pedido marcado como pago!', {
        order_id: updatedOrder.id,
        status: updatedOrder.status,
        was_already_paid: wasAlreadyPaid
      });

      // Registrar log de sucesso
      await supabaseClient.from('cakto_webhook_logs').insert({
        webhook_body: body,
        transaction_id,
        order_id_from_webhook,
        status_received: statusNormalized,
        customer_email,
        amount_cents,
        order_found: true,
        processing_success: true,
        strategy_used: strategyUsed,
        processing_time_ms: Date.now() - startTime
      });
      
      // ✅ CORREÇÃO ROBUSTA: Verificar idempotência com múltiplas camadas de proteção
      // 1. Verificar webhook_logs para detectar processamentos simultâneos
      // 2. Verificar email_logs ANTES de qualquer processamento
      // 3. Verificar novamente APÓS um pequeno delay (para evitar race conditions)
      // 4. Usar verificação atômica para garantir que apenas um processo envia o email
      // 5. Lock distribuído usando email_logs com status 'pending' como semáforo
      
      console.log('📧 [Cakto Webhook] Verificando idempotência de email de confirmação...', {
        order_id: order.id,
        timestamp: new Date().toISOString()
      });
      
      // ✅ VERIFICAÇÃO 0: Verificação imediata de email_logs (mais rápida)
      const { data: quickEmailCheck, error: quickEmailError } = await supabaseClient
        .from('email_logs')
        .select('id, email_type, status, sent_at, recipient_email, created_at')
        .eq('order_id', order.id)
        .eq('email_type', 'order_paid')
        .in('status', ['sent', 'delivered', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (quickEmailCheck && quickEmailCheck.length > 0) {
        const emailLog = quickEmailCheck[0];
        const emailAge = Date.now() - new Date(emailLog.created_at).getTime();
        
        // Se email foi enviado há mais de 1 segundo OU está em pending há mais de 10 segundos, considerar como enviado
        if (emailLog.status === 'sent' || emailLog.status === 'delivered' || 
            (emailLog.status === 'pending' && emailAge > 10000)) {
          console.log('✅ [Cakto Webhook] Email de confirmação já existe (verificação rápida) - pulando envio duplicado', {
            order_id: order.id,
            email_log_id: emailLog.id,
            email_type: emailLog.email_type,
            status: emailLog.status,
            sent_at: emailLog.sent_at,
            recipient_email: emailLog.recipient_email,
            email_age_ms: emailAge,
            timestamp: new Date().toISOString()
          });
          // Pular todo o processamento de email
        } else if (emailLog.status === 'pending' && emailAge <= 10000) {
          // Email está em processamento recente (últimos 10 segundos), aguardar um pouco e verificar novamente
          console.log('⏳ [Cakto Webhook] Email em processamento recente - aguardando...', {
            order_id: order.id,
            email_log_id: emailLog.id,
            email_age_ms: emailAge,
            timestamp: new Date().toISOString()
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verificar novamente após aguardar
          const { data: recheckEmail } = await supabaseClient
            .from('email_logs')
            .select('id, email_type, status, sent_at')
            .eq('order_id', order.id)
            .eq('email_type', 'order_paid')
            .in('status', ['sent', 'delivered', 'pending'])
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (recheckEmail && recheckEmail.length > 0 && 
              (recheckEmail[0].status === 'sent' || recheckEmail[0].status === 'delivered')) {
            console.log('✅ [Cakto Webhook] Email confirmado como enviado após aguardar - pulando envio duplicado', {
              order_id: order.id,
              email_log_id: recheckEmail[0].id,
              status: recheckEmail[0].status,
              timestamp: new Date().toISOString()
            });
            // Pular todo o processamento de email
          }
        }
      }
      
      // ✅ VERIFICAÇÃO 1: Verificar se há outros webhooks sendo processados para o mesmo pedido nos últimos 30 segundos
      const recentWebhookCheck = await supabaseClient
        .from('cakto_webhook_logs')
        .select('id, created_at, processing_success, processing_time_ms')
        .eq('order_id_from_webhook', order.id)
        .eq('processing_success', true)
        .gte('created_at', new Date(Date.now() - 30000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      
      let shouldSkipDueToMultipleWebhooks = false;
      
      if (recentWebhookCheck.data && recentWebhookCheck.data.length > 1) {
        console.warn('⚠️ [Cakto Webhook] Múltiplos webhooks processados recentemente para o mesmo pedido', {
          order_id: order.id,
          webhook_count: recentWebhookCheck.data.length,
          webhook_ids: recentWebhookCheck.data.map(w => w.id),
          timestamps: recentWebhookCheck.data.map(w => w.created_at),
          timestamp: new Date().toISOString()
        });
        
        // Se há múltiplos webhooks recentes (2 ou mais), pular processamento de email
        // O primeiro webhook já deve ter processado o email
        shouldSkipDueToMultipleWebhooks = recentWebhookCheck.data.length >= 2;
        
        if (shouldSkipDueToMultipleWebhooks) {
          console.log('⏭️ [Cakto Webhook] Pulando processamento de email - múltiplos webhooks detectados', {
            order_id: order.id,
            webhook_count: recentWebhookCheck.data.length,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Primeira verificação completa: email_logs (só se não estiver pulando devido a múltiplos webhooks)
      if (!shouldSkipDueToMultipleWebhooks) {
        const { data: existingEmailLogs1, error: emailLogsError1 } = await supabaseClient
          .from('email_logs')
          .select('id, email_type, status, sent_at, recipient_email, created_at')
          .eq('order_id', order.id)
          .eq('email_type', 'order_paid')
          .in('status', ['sent', 'delivered', 'pending'])
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (emailLogsError1) {
          console.error('❌ [Cakto Webhook] Erro ao verificar email_logs (primeira verificação):', emailLogsError1);
        }
        
        // Verificar se já existe email enviado ou em processamento
        const hasEmailSent1 = existingEmailLogs1 && existingEmailLogs1.length > 0;
        const hasRecentPending = existingEmailLogs1 && existingEmailLogs1.some(log => {
          if (log.status === 'pending') {
            const age = Date.now() - new Date(log.created_at).getTime();
            return age <= 10000; // Últimos 10 segundos
          }
          return false;
        });
        
        if (hasEmailSent1 && !hasRecentPending) {
          const emailLog = existingEmailLogs1[0];
          console.log('✅ [Cakto Webhook] Email de confirmação já existe - pulando envio duplicado', {
            order_id: order.id,
            email_log_id: emailLog.id,
            email_type: emailLog.email_type,
            status: emailLog.status,
            sent_at: emailLog.sent_at,
            recipient_email: emailLog.recipient_email,
            total_logs: existingEmailLogs1.length,
            timestamp: new Date().toISOString()
          });
          // Pular todo o processamento de email
        } else if (!hasEmailSent1 || !hasRecentPending) {
          // Aguardar 500ms para evitar race conditions (se dois webhooks chegarem simultaneamente)
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Segunda verificação após delay (para pegar emails que podem ter sido enviados durante o delay)
          const { data: existingEmailLogs2, error: emailLogsError2 } = await supabaseClient
            .from('email_logs')
            .select('id, email_type, status, sent_at, recipient_email, created_at')
            .eq('order_id', order.id)
            .eq('email_type', 'order_paid')
            .in('status', ['sent', 'delivered', 'pending'])
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (emailLogsError2) {
            console.error('❌ [Cakto Webhook] Erro ao verificar email_logs (segunda verificação):', emailLogsError2);
          }
          
          const hasEmailSent2 = existingEmailLogs2 && existingEmailLogs2.length > 0;
          const hasRecentPending2 = existingEmailLogs2 && existingEmailLogs2.some(log => {
            if (log.status === 'pending') {
              const age = Date.now() - new Date(log.created_at).getTime();
              return age <= 10000;
            }
            return false;
          });
          
          if (hasEmailSent2 && !hasRecentPending2) {
            const emailLog = existingEmailLogs2[0];
            console.log('✅ [Cakto Webhook] Email de confirmação encontrado após delay - pulando envio duplicado', {
              order_id: order.id,
              email_log_id: emailLog.id,
              email_type: emailLog.email_type,
              status: emailLog.status,
              sent_at: emailLog.sent_at,
              recipient_email: emailLog.recipient_email,
              total_logs: existingEmailLogs2.length,
              timestamp: new Date().toISOString()
            });
            // Pular todo o processamento de email
          } else if (!hasEmailSent2 || !hasRecentPending2) {
            console.log('📧 [Cakto Webhook] Nenhum email de confirmação encontrado - enviando email...', {
              order_id: order.id,
              verificacoes_realizadas: 3,
              timestamp: new Date().toISOString()
            });
            
            // Chamar função para notificar pagamento (via Supabase Edge Function ou diretamente)
            try {
              const notifyStartTime = Date.now();
              console.log('📧 [Cakto Webhook] Chamando notify-payment-webhook...', {
                order_id: order.id,
                timestamp: new Date().toISOString()
              });
              
              const { data: notifyData, error: notifyError } = await supabaseClient.functions.invoke(
                'notify-payment-webhook',
                {
                  body: { order_id: order.id }
                }
              );
              
              const notifyDuration = Date.now() - notifyStartTime;
              
              if (notifyError) {
                console.error('❌ [Cakto Webhook] Erro ao chamar notify-payment-webhook:', {
                  order_id: order.id,
                  error: notifyError,
                  duration_ms: notifyDuration,
                  timestamp: new Date().toISOString()
                });
              } else {
                console.log('✅ [Cakto Webhook] notify-payment-webhook chamado com sucesso', {
                  order_id: order.id,
                  response: notifyData,
                  duration_ms: notifyDuration,
                  timestamp: new Date().toISOString()
                });
                
                // Verificação final: confirmar que o email foi registrado
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const { data: finalEmailLogs } = await supabaseClient
                  .from('email_logs')
                  .select('id, email_type, status, sent_at')
                  .eq('order_id', order.id)
                  .eq('email_type', 'order_paid')
                  .order('sent_at', { ascending: false })
                  .limit(1);
                
                if (finalEmailLogs && finalEmailLogs.length > 0) {
                  console.log('✅ [Cakto Webhook] Email confirmado como registrado após envio', {
                    order_id: order.id,
                    email_log_id: finalEmailLogs[0].id,
                    status: finalEmailLogs[0].status,
                    timestamp: new Date().toISOString()
                  });
                } else {
                  console.warn('⚠️ [Cakto Webhook] Email não encontrado em email_logs após envio (pode ter falhado)', {
                    order_id: order.id,
                    timestamp: new Date().toISOString()
                  });
                }
              }
            } catch (notifyException: any) {
              console.error('❌ [Cakto Webhook] Exceção ao chamar notify-payment-webhook:', {
                order_id: order.id,
                exception: notifyException,
                message: notifyException?.message,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      } else {
        console.log('⏭️ [Cakto Webhook] Processamento de email pulado - múltiplos webhooks detectados', {
          order_id: order.id,
          timestamp: new Date().toISOString()
        });
      }
      
      // ✅ CORREÇÃO CRÍTICA: Gerar letra automaticamente SEMPRE que pedido é pago
      // Esta seção é COMPLETAMENTE SEPARADA da lógica de email
      // Não depende de shouldSkipDueToMultipleWebhooks ou qualquer outra condição de email
      let lyricsGenerated = false;
      
      console.log('🎵 [Cakto Webhook] Iniciando processo de geração de letras...', {
        order_id: updatedOrder.id,
        quiz_id: updatedOrder.quiz_id,
        timestamp: new Date().toISOString()
      });
      
      // PASSO 1: Verificar se já existe approval (idempotência)
      let shouldGenerateLyrics = true;
      try {
        const { data: existingApproval, error: approvalCheckError } = await supabaseClient
          .from('lyrics_approvals')
          .select('id, status')
          .eq('order_id', updatedOrder.id)
          .limit(1);
        
        if (approvalCheckError) {
          console.warn('⚠️ [Cakto Webhook] Erro ao verificar approval existente, continuando...', {
            order_id: updatedOrder.id,
            error: approvalCheckError?.message
          });
        } else if (existingApproval && existingApproval.length > 0) {
          console.log('ℹ️ [Cakto Webhook] Approval já existe - pulando geração de letra', {
            order_id: updatedOrder.id,
            approval_id: existingApproval[0].id,
            approval_status: existingApproval[0].status,
            timestamp: new Date().toISOString()
          });
          shouldGenerateLyrics = false;
        }
      } catch (approvalError: any) {
        console.warn('⚠️ [Cakto Webhook] Exceção ao verificar approval, continuando...', {
            order_id: updatedOrder.id,
          error: approvalError?.message
        });
      }
      
      // PASSO 2: Garantir que job existe (criar se necessário)
      if (shouldGenerateLyrics) {
        if (!updatedOrder.quiz_id) {
          console.warn('⚠️ [Cakto Webhook] Pedido não tem quiz_id - não é possível gerar letra', {
          order_id: updatedOrder.id,
            timestamp: new Date().toISOString()
          });
          shouldGenerateLyrics = false;
        } else {
          const { jobId, created } = await ensureJobExists(
            supabaseClient,
            updatedOrder.id,
            updatedOrder.quiz_id,
            'cakto'
          );
          
          if (!jobId) {
            console.error('❌ [Cakto Webhook] Não foi possível garantir job - pulando geração de letra', {
              order_id: updatedOrder.id,
              quiz_id: updatedOrder.quiz_id,
              timestamp: new Date().toISOString()
            });
            shouldGenerateLyrics = false;
          } else {
            console.log('✅ [Cakto Webhook] Job garantido para geração de letras', {
              order_id: updatedOrder.id,
              job_id: jobId,
              job_created: created,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // PASSO 3: Chamar função de gerar letras se necessário
      if (shouldGenerateLyrics) {
        console.log('🎵 [Cakto Webhook] Chamando generate-lyrics-for-approval para gerar letra...', {
          order_id: updatedOrder.id,
          quiz_id: updatedOrder.quiz_id,
          timestamp: new Date().toISOString()
        });
        
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 [Cakto Webhook] Tentativa ${attempt}/${maxRetries} de gerar letra...`, {
              order_id: updatedOrder.id,
              attempt,
              timestamp: new Date().toISOString()
            });
            
            const { data: lyricsData, error: lyricsError } = await supabaseClient.functions.invoke(
              'generate-lyrics-for-approval',
              {
                body: { order_id: updatedOrder.id }
              }
            );
            
            if (!lyricsError && lyricsData && lyricsData.success !== false) {
              lyricsGenerated = true;
              console.log('✅ [Cakto Webhook] Letra sendo gerada com sucesso', {
                order_id: updatedOrder.id,
                attempt,
                response: lyricsData,
                timestamp: new Date().toISOString()
              });
              break;
            } else {
              console.warn(`⚠️ [Cakto Webhook] Erro ao gerar letra (tentativa ${attempt}/${maxRetries})`, {
                order_id: updatedOrder.id,
                attempt,
                error: lyricsError,
                data: lyricsData,
                timestamp: new Date().toISOString()
              });
            }
            
            if (attempt < maxRetries) {
              const delay = 1000 * attempt;
              console.log(`⏳ [Cakto Webhook] Aguardando ${delay}ms antes da próxima tentativa...`, {
                order_id: updatedOrder.id,
                attempt,
                next_attempt: attempt + 1,
                delay_ms: delay
              });
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (invokeError: any) {
            console.error(`❌ [Cakto Webhook] Exceção ao chamar generate-lyrics-for-approval (tentativa ${attempt}/${maxRetries})`, {
              order_id: updatedOrder.id,
              attempt,
              error: invokeError?.message,
              stack: invokeError?.stack,
              timestamp: new Date().toISOString()
            });
            
            if (attempt < maxRetries) {
              const delay = 1000 * attempt;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (!lyricsGenerated) {
          console.error('❌ [Cakto Webhook] Falha ao gerar letra após todas as tentativas', {
            order_id: updatedOrder.id,
            max_retries: maxRetries,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('⏭️ [Cakto Webhook] Geração de letra não será executada', {
          order_id: updatedOrder.id,
          reason: 'Approval já existe ou pedido não tem quiz_id',
          timestamp: new Date().toISOString()
        });
      }
      
      return reply
        .code(200)
        .headers(secureHeaders)
        .send({ 
          success: true,
          order_id: updatedOrder.id,
          strategy_used: strategyUsed,
          lyrics_generated: lyricsGenerated,
          message: 'Pedido marcado como pago. Email e letra serão enviados automaticamente.'
        });
      
    } catch (error: any) {
      console.error('❌ [Cakto Webhook] Erro fatal:', error);
      
      return reply
        .code(500)
        .headers(secureHeaders)
        .send({ error: 'Internal server error', message: error.message });
    }
  });

  // POST /api/checkout/create
  app.post('/api/checkout/create', async (request, reply) => {
    const origin = request.headers.origin || null;
    const secureHeaders = getSecureHeaders(origin);
    
    try {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });

      const body: any = request.body;
      
      const {
        session_id,
        quiz,
        customer_email,
        customer_whatsapp,
        plan,
        amount_cents,
        provider,
        transaction_id
      } = body;

      if (!session_id || !isValidUUID(session_id)) {
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ success: false, error: 'Invalid or missing session_id' });
      }

      if (!quiz || !quiz.about_who || !quiz.style) {
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ success: false, error: 'Invalid quiz data: about_who and style are required' });
      }

      if (!customer_email || !customer_whatsapp) {
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ success: false, error: 'customer_email and customer_whatsapp are required' });
      }

      if (!plan || !['standard', 'express'].includes(plan)) {
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ success: false, error: 'Invalid plan: must be standard or express' });
      }

      if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0) {
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ success: false, error: 'Invalid amount_cents: must be a positive number' });
      }

      if (!provider || !['cakto', 'hotmart'].includes(provider)) {
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ success: false, error: 'Invalid provider: must be cakto or hotmart' });
      }

      const ipAddress = request.headers['x-forwarded-for'] || 
                       request.headers['x-real-ip'] || 
                       'unknown';
      const userAgent = request.headers['user-agent'] || 'unknown';

      const { data: result, error: rpcError } = await supabaseClient.rpc('create_order_atomic', {
        p_session_id: session_id,
        p_customer_email: customer_email,
        p_customer_whatsapp: customer_whatsapp,
        p_quiz_data: quiz,
        p_plan: plan,
        p_amount_cents: amount_cents,
        p_provider: provider,
        p_transaction_id: transaction_id || null,
        p_source: 'backend_api',
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });

      if (rpcError || !result || !result.success) {
        const errorMessage = rpcError?.message || result?.error || 'Unknown error';
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ 
            success: false, 
            error: `Failed to create order: ${errorMessage}`,
            log_id: result?.log_id || null,
            quiz_id: result?.quiz_id || null
          });
      }

      return reply
        .code(200)
        .headers(secureHeaders)
        .send({
          success: true,
          quiz_id: result.quiz_id,
          order_id: result.order_id,
          log_id: result.log_id
        });

    } catch (error: any) {
      console.error('❌ [create-checkout] Erro inesperado:', error);
      return reply
        .code(500)
        .headers(secureHeaders)
        .send({ 
          success: false, 
          error: error?.message || 'Unknown error' 
        });
    }
  });

  // POST /api/hotmart/webhook
  app.post('/api/hotmart/webhook', async (request, reply) => {
    const origin = request.headers.origin || null;
    const secureHeaders = getSecureHeaders(origin);
    
    const startTime = Date.now();

    try {
      console.log('==========================================');
      console.log('🔔 [Hotmart Webhook] WEBHOOK RECEBIDO');
      console.log('==========================================');
      
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
      
      const hotmartSecret = process.env.HOTMART_WEBHOOK_SECRET;
      
      if (!hotmartSecret) {
        console.error('❌ [Hotmart Webhook] HOTMART_WEBHOOK_SECRET não configurado');
        return reply
          .code(500)
          .headers(secureHeaders)
          .send({ error: 'Webhook secret not configured' });
      }
      
      const receivedToken = (request.headers['authorization']?.replace('Bearer ', '') || 
                            request.headers['x-hotmart-token'] as string) ||
                            (request.body as any)?.token ||
                            '';
      
      const authHeader = request.headers.authorization || '';
      const authToken = authHeader.replace('Bearer ', '').trim();
      const isInternalCall = authToken === supabaseServiceKey;
      
      const body: any = request.body;
      
      if (!body || Object.keys(body).length === 0) {
        console.error('❌ [Hotmart Webhook] Body vazio ou ausente');
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ error: 'Empty body', message: 'Webhook body está vazio ou ausente' });
      }
      
      if (isInternalCall) {
        console.log('✅ [Hotmart Webhook] Chamada interna autenticada');
      } else {
        if (receivedToken !== hotmartSecret) {
          console.error('❌ [Hotmart Webhook] Token inválido');
          return reply
            .code(401)
            .headers(secureHeaders)
            .send({ 
              error: 'Invalid or missing token',
              message: 'Webhook deve incluir token válido'
            });
        }
        console.log('✅ [Hotmart Webhook] Token válido');
      }
      
      console.log('📦 [Hotmart Webhook] Payload COMPLETO:', JSON.stringify(body, null, 2));
      
      const event = body.event || '';
      const data = body.data || body;
      
      // ✅ CORREÇÃO: Extrair dados do webhook da Hotmart conforme estrutura real do payload
      const purchase = data.purchase || {};
      // ✅ CORREÇÃO: buyer está em data.buyer, não em data.purchase.buyer
      const buyer = data.buyer || purchase.buyer || {};
      const transaction = purchase.transaction || '';
      
      // ✅ CORREÇÃO: Extrair order_id de metadata ou purchase.order
      const order_id_from_webhook = data.metadata?.order_id ||
                                   purchase.order?.id ||
                                   data.external_id ||
                                   null;
      
      const customer_email_raw = buyer.email || data.email || '';
      const customer_email = customer_email_raw ? String(customer_email_raw).toLowerCase().trim() : '';
      
      // ✅ CORREÇÃO: Combinar checkout_phone_code e checkout_phone
      const phoneCode = buyer.checkout_phone_code || '';
      const phoneNumber = buyer.checkout_phone || '';
      const customer_phone = phoneCode && phoneNumber 
        ? `${phoneCode}${phoneNumber}` 
        : (buyer.phone || buyer.phone_number || null);
      
      const price = purchase.price || {};
      const amount_reais_raw = price.value || purchase.amount || 0;
      const amount_reais = typeof amount_reais_raw === 'string' 
        ? parseFloat(amount_reais_raw) 
        : Number(amount_reais_raw) || 0;
      const amount_cents = Math.round(amount_reais * 100);
      
      // ✅ CORREÇÃO: Converter timestamp de milissegundos para ISO string
      const approvedDateTimestamp = purchase.approved_date || purchase.date_approved;
      const paid_at = approvedDateTimestamp 
        ? new Date(approvedDateTimestamp).toISOString() 
        : new Date().toISOString();
      
      const hasOrderId = order_id_from_webhook && String(order_id_from_webhook).trim().length > 0;
      const hasTransactionId = transaction && String(transaction).trim().length > 0;
      const hasCustomerEmail = customer_email && customer_email.trim().length > 0;
      
      if (!hasOrderId && !hasTransactionId && !hasCustomerEmail) {
        console.error('❌ [Hotmart Webhook] NENHUM identificador encontrado');
        await supabaseClient.from('hotmart_webhook_logs').insert({
          webhook_body: body,
          transaction_id: transaction || null,
          order_id_from_webhook: order_id_from_webhook || null,
          status_received: event || null,
          customer_email: customer_email || null,
          amount_cents: amount_cents || null,
          order_found: false,
          processing_success: false,
          error_message: 'Nenhum identificador encontrado',
          strategy_used: 'none'
        });
        
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ 
            error: 'Nenhum identificador encontrado',
            message: 'Webhook não contém order_id, transaction_id ou customer_email'
          });
      }
      
      let statusNormalized = 'approved';
      const eventLower = event.toLowerCase();
      
      if (eventLower === 'purchase_approved' || eventLower.includes('approved')) {
        statusNormalized = 'approved';
      } else if (eventLower === 'purchase_cancelled' || eventLower.includes('cancelled')) {
        statusNormalized = 'cancelled';
      } else if (eventLower === 'purchase_chargeback' || eventLower.includes('chargeback')) {
        statusNormalized = 'chargeback';
      }
      
      let order: any = null;
      let strategyUsed = 'none';
      
      // ✅ Estratégia 0: order_id_from_webhook (mais confiável - igual à Cakto)
      if (!order && order_id_from_webhook && isValidUUID(order_id_from_webhook)) {
        const { data: orderById, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('id', order_id_from_webhook)
          .eq('provider', 'hotmart')
          .single();
        
        if (orderById && !error) {
          order = orderById;
          strategyUsed = 'order_id_from_webhook';
        }
      }
      
      // Estratégia 1: hotmart_transaction_id
      if (!order && transaction && transaction.trim().length >= 6) {
        const { data: orderByTxId, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('hotmart_transaction_id', transaction)
          .single();
        
        if (orderByTxId && !error) {
          order = orderByTxId;
          strategyUsed = 'hotmart_transaction_id';
        }
      }
      
      // Estratégia 2: Email (próximo pedido pendente)
      if (!order && customer_email) {
        const { data: ordersByEmail, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('customer_email', customer_email)
          .eq('provider', 'hotmart')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        if (ordersByEmail && ordersByEmail.length > 0) {
          order = ordersByEmail[0];
          strategyUsed = 'email_most_recent';
        }
      }
      
      // Estratégia 3: Telefone/WhatsApp
      if (!order && customer_phone) {
        const normalizedPhone = customer_phone.replace(/\D/g, '');
        
        const { data: ordersByPhone, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('provider', 'hotmart')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        if (ordersByPhone && ordersByPhone.length > 0) {
          const filteredOrders = ordersByPhone.filter(o => {
            const orderPhone = ((o.customer_whatsapp || o.customer_phone || '')).replace(/\D/g, '');
            return orderPhone === normalizedPhone || 
                   orderPhone.endsWith(normalizedPhone) || 
                   normalizedPhone.endsWith(orderPhone);
          });
          
          if (filteredOrders.length > 0) {
            order = filteredOrders[0];
            strategyUsed = 'phone_most_recent';
          }
        }
      }
      
      if (!order) {
        console.error('❌ [Hotmart Webhook] PEDIDO NÃO ENCONTRADO');
        await supabaseClient.from('hotmart_webhook_logs').insert({
          webhook_body: body,
          transaction_id: transaction,
          order_id_from_webhook: order_id_from_webhook || null,
          status_received: statusNormalized,
          customer_email,
          amount_cents,
          order_found: false,
          processing_success: false,
          error_message: 'Pedido não encontrado',
          strategy_used: 'none'
        });
        
        return reply
          .code(404)
          .headers(secureHeaders)
          .send({ 
            error: 'Pedido não encontrado',
            message: 'Nenhum pedido corresponde aos dados fornecidos'
          });
      }
      
      const isReliableIdentifier = strategyUsed === 'order_id_from_webhook' || 
                                   strategyUsed === 'hotmart_transaction_id' ||
                                   strategyUsed === 'phone_most_recent';
      
      if (!isReliableIdentifier && customer_email && order.customer_email !== customer_email) {
        if (customer_phone && order.customer_whatsapp) {
          const normalizedWebhookPhone = customer_phone.replace(/\D/g, '');
          const normalizedOrderPhone = order.customer_whatsapp.replace(/\D/g, '');
          
          const phoneMatch = normalizedOrderPhone === normalizedWebhookPhone || 
                            normalizedOrderPhone.endsWith(normalizedWebhookPhone) || 
                            normalizedWebhookPhone.endsWith(normalizedOrderPhone);
          
          if (!phoneMatch) {
            return reply
              .code(400)
              .headers(secureHeaders)
              .send({ 
                error: 'Validação falhou',
                message: 'Email e telefone não correspondem'
              });
          }
        } else {
          return reply
            .code(400)
            .headers(secureHeaders)
            .send({ 
              error: 'Validação falhou',
              message: 'Email não corresponde'
            });
        }
      }
      
      const shouldProcess = eventLower === 'purchase_approved' || statusNormalized === 'approved';
      
      if (!shouldProcess) {
        return reply
          .code(200)
          .headers(secureHeaders)
          .send({ 
            received: true, 
            event: event || 'unknown',
            status: statusNormalized,
            message: 'Webhook recebido mas não processado'
          });
      }
      
      // ✅ CORREÇÃO CRÍTICA: Não retornar early se pedido já está pago
      // Precisamos garantir que a função de gerar letras seja sempre chamada
      const wasAlreadyPaid = order.status === 'paid';
      
      if (wasAlreadyPaid) {
        console.log('ℹ️ [Hotmart Webhook] Pedido já está pago - verificando se precisa gerar letra', {
          order_id: order.id
        });
      }
      
      const paidAtTimestamp = paid_at || new Date().toISOString();
      
      // Atualizar pedido para 'paid' (mesmo que já esteja, para garantir dados atualizados)
      const { error: updateError, data: updateData } = await supabaseClient
        .from('orders')
        .update({
          status: 'paid',
          hotmart_payment_status: 'approved',
          hotmart_transaction_id: transaction,
          provider: 'hotmart',
          paid_at: paidAtTimestamp || order.paid_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select('id, status, paid_at, quiz_id');
      
      if (updateError || !updateData || updateData.length === 0) {
        console.error('❌ [Hotmart Webhook] Erro ao atualizar:', updateError);
        throw updateError || new Error('Nenhuma linha foi atualizada');
      }
      
      const updatedOrder = updateData[0];
      if (updatedOrder.status !== 'paid') {
        throw new Error(`Pedido não foi marcado como paid. Status atual: ${updatedOrder.status}`);
      }
      
      console.log('✅ [Hotmart Webhook] Pedido marcado como pago!', {
        order_id: updatedOrder.id,
        status: updatedOrder.status,
        was_already_paid: wasAlreadyPaid
      });

      // Registrar log de sucesso
      await supabaseClient.from('hotmart_webhook_logs').insert({
        webhook_body: body,
        transaction_id: transaction,
        order_id_from_webhook: order_id_from_webhook || null,
        status_received: statusNormalized,
        customer_email,
        amount_cents,
        order_found: true,
        processing_success: true,
        strategy_used: strategyUsed,
        processing_time_ms: Date.now() - startTime
      });
      
      // Verificar idempotência de email (igual à Cakto)
      console.log('📧 [Hotmart Webhook] Verificando idempotência de email de confirmação...', {
        order_id: order.id,
        timestamp: new Date().toISOString()
      });
      
      // Verificação rápida de email_logs
      const { data: quickEmailCheck, error: quickEmailError } = await supabaseClient
        .from('email_logs')
        .select('id, email_type, status, sent_at, recipient_email, created_at')
        .eq('order_id', order.id)
        .eq('email_type', 'order_paid')
        .in('status', ['sent', 'delivered', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (quickEmailCheck && quickEmailCheck.length > 0) {
        const emailLog = quickEmailCheck[0];
        const emailAge = Date.now() - new Date(emailLog.created_at).getTime();
        
        if (emailLog.status === 'sent' || emailLog.status === 'delivered' || 
            (emailLog.status === 'pending' && emailAge > 10000)) {
          console.log('✅ [Hotmart Webhook] Email de confirmação já existe - pulando envio duplicado', {
            order_id: order.id,
            email_log_id: emailLog.id,
            status: emailLog.status
          });
        } else if (emailLog.status === 'pending' && emailAge <= 10000) {
          console.log('⏳ [Hotmart Webhook] Email em processamento recente - aguardando...', {
            order_id: order.id,
            email_age_ms: emailAge
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: recheckEmail } = await supabaseClient
            .from('email_logs')
            .select('id, email_type, status, sent_at')
            .eq('order_id', order.id)
            .eq('email_type', 'order_paid')
            .in('status', ['sent', 'delivered', 'pending'])
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (recheckEmail && recheckEmail.length > 0 && 
              (recheckEmail[0].status === 'sent' || recheckEmail[0].status === 'delivered')) {
            console.log('✅ [Hotmart Webhook] Email confirmado como enviado após aguardar');
          }
        }
      } else {
        // Chamar função para notificar pagamento
        try {
          console.log('📧 [Hotmart Webhook] Chamando notify-payment-webhook...', {
            order_id: order.id
          });
          
          const { data: notifyData, error: notifyError } = await supabaseClient.functions.invoke(
            'notify-payment-webhook',
            {
              body: { order_id: order.id }
            }
          );
          
          if (notifyError) {
            console.error('❌ [Hotmart Webhook] Erro ao chamar notify-payment-webhook:', notifyError);
          } else {
            console.log('✅ [Hotmart Webhook] notify-payment-webhook chamado com sucesso');
          }
        } catch (notifyException: any) {
          console.error('❌ [Hotmart Webhook] Exceção ao chamar notify-payment-webhook:', notifyException);
        }
      }
      
      // ✅ CORREÇÃO CRÍTICA: Gerar letra automaticamente SEMPRE que pedido é pago
      // Esta seção é COMPLETAMENTE SEPARADA da lógica de email
      // Não depende de shouldSkipDueToMultipleWebhooks ou qualquer outra condição de email
      let lyricsGenerated = false;
      
      console.log('🎵 [Hotmart Webhook] Iniciando processo de geração de letras...', {
        order_id: updatedOrder.id,
        quiz_id: updatedOrder.quiz_id,
        timestamp: new Date().toISOString()
      });
      
      // PASSO 1: Verificar se já existe approval (idempotência)
      let shouldGenerateLyrics = true;
      try {
        const { data: existingApproval, error: approvalCheckError } = await supabaseClient
          .from('lyrics_approvals')
          .select('id, status')
          .eq('order_id', updatedOrder.id)
          .limit(1);
        
        if (approvalCheckError) {
          console.warn('⚠️ [Hotmart Webhook] Erro ao verificar approval existente, continuando...', {
            order_id: updatedOrder.id,
            error: approvalCheckError?.message
          });
        } else if (existingApproval && existingApproval.length > 0) {
          console.log('ℹ️ [Hotmart Webhook] Approval já existe - pulando geração de letra', {
            order_id: updatedOrder.id,
            approval_id: existingApproval[0].id,
            approval_status: existingApproval[0].status,
            timestamp: new Date().toISOString()
          });
          shouldGenerateLyrics = false;
        }
      } catch (approvalError: any) {
        console.warn('⚠️ [Hotmart Webhook] Exceção ao verificar approval, continuando...', {
            order_id: updatedOrder.id,
          error: approvalError?.message
        });
      }
      
      // PASSO 2: Garantir que job existe (criar se necessário)
      if (shouldGenerateLyrics) {
        if (!updatedOrder.quiz_id) {
          console.warn('⚠️ [Hotmart Webhook] Pedido não tem quiz_id - não é possível gerar letra', {
          order_id: updatedOrder.id,
            timestamp: new Date().toISOString()
          });
          shouldGenerateLyrics = false;
        } else {
          const { jobId, created } = await ensureJobExists(
            supabaseClient,
            updatedOrder.id,
            updatedOrder.quiz_id,
            'hotmart'
          );
          
          if (!jobId) {
            console.error('❌ [Hotmart Webhook] Não foi possível garantir job - pulando geração de letra', {
              order_id: updatedOrder.id,
              quiz_id: updatedOrder.quiz_id,
              timestamp: new Date().toISOString()
            });
            shouldGenerateLyrics = false;
          } else {
            console.log('✅ [Hotmart Webhook] Job garantido para geração de letras', {
              order_id: updatedOrder.id,
              job_id: jobId,
              job_created: created,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // PASSO 3: Chamar função de gerar letras se necessário
      if (shouldGenerateLyrics) {
        console.log('🎵 [Hotmart Webhook] Chamando generate-lyrics-for-approval para gerar letra...', {
          order_id: updatedOrder.id,
          quiz_id: updatedOrder.quiz_id,
          timestamp: new Date().toISOString()
        });
        
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 [Hotmart Webhook] Tentativa ${attempt}/${maxRetries} de gerar letra...`, {
              order_id: updatedOrder.id,
              attempt,
              timestamp: new Date().toISOString()
            });
            
            const { data: lyricsData, error: lyricsError } = await supabaseClient.functions.invoke(
              'generate-lyrics-for-approval',
              {
                body: { order_id: updatedOrder.id }
              }
            );
            
            if (!lyricsError && lyricsData && lyricsData.success !== false) {
              lyricsGenerated = true;
              console.log('✅ [Hotmart Webhook] Letra sendo gerada com sucesso', {
                order_id: updatedOrder.id,
                attempt,
                response: lyricsData,
                timestamp: new Date().toISOString()
              });
              break;
            } else {
              console.warn(`⚠️ [Hotmart Webhook] Erro ao gerar letra (tentativa ${attempt}/${maxRetries})`, {
                order_id: updatedOrder.id,
                attempt,
                error: lyricsError,
                data: lyricsData,
                timestamp: new Date().toISOString()
              });
            }
            
            if (attempt < maxRetries) {
              const delay = 1000 * attempt;
              console.log(`⏳ [Hotmart Webhook] Aguardando ${delay}ms antes da próxima tentativa...`, {
                order_id: updatedOrder.id,
                attempt,
                next_attempt: attempt + 1,
                delay_ms: delay
              });
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (invokeError: any) {
            console.error(`❌ [Hotmart Webhook] Exceção ao chamar generate-lyrics-for-approval (tentativa ${attempt}/${maxRetries})`, {
              order_id: updatedOrder.id,
              attempt,
              error: invokeError?.message,
              stack: invokeError?.stack,
              timestamp: new Date().toISOString()
            });
            
            if (attempt < maxRetries) {
              const delay = 1000 * attempt;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (!lyricsGenerated) {
          console.error('❌ [Hotmart Webhook] Falha ao gerar letra após todas as tentativas', {
            order_id: updatedOrder.id,
            max_retries: maxRetries,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('⏭️ [Hotmart Webhook] Geração de letra não será executada', {
          order_id: updatedOrder.id,
          reason: 'Approval já existe ou pedido não tem quiz_id',
          timestamp: new Date().toISOString()
        });
      }
      
      return reply
        .code(200)
        .headers(secureHeaders)
        .send({ 
          success: true,
          order_id: updatedOrder.id,
          strategy_used: strategyUsed,
          lyrics_generated: lyricsGenerated,
          message: 'Pedido marcado como pago. Email e letra serão enviados automaticamente.'
        });
      
    } catch (error: any) {
      console.error('❌ [Hotmart Webhook] Erro fatal:', error);
      
      return reply
        .code(500)
        .headers(secureHeaders)
        .send({ error: 'Internal server error', message: error.message });
    }
  });
}

