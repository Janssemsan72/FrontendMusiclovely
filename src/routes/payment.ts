import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { getSecureHeaders } from '../utils/security.js';
import { isValidUUID } from '../utils/error-handler.js';

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
      
      if (order.status === 'paid') {
        console.log('✅ [Cakto Webhook] Pedido já está pago - idempotente');
        return reply
          .code(200)
          .headers(secureHeaders)
          .send({ received: true, message: 'Already processed' });
      }
      
      const paidAtTimestamp = paid_at || new Date().toISOString();
      
      const { error: updateError, data: updateData } = await supabaseClient
        .from('orders')
        .update({
          status: 'paid',
          cakto_payment_status: 'approved',
          cakto_transaction_id: transaction_id,
          provider: 'cakto',
          paid_at: paidAtTimestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select('id, status, paid_at');
      
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
        status: updatedOrder.status
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
      
      console.log('📧 [Cakto Webhook] Verificando idempotência de email de confirmação...', {
        order_id: order.id,
        timestamp: new Date().toISOString()
      });
      
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
      
      // Primeira verificação: email_logs (só se não estiver pulando devido a múltiplos webhooks)
      const { data: existingEmailLogs1, error: emailLogsError1 } = await supabaseClient
        .from('email_logs')
        .select('id, email_type, status, sent_at, recipient_email')
        .eq('order_id', order.id)
        .eq('email_type', 'order_paid')
        .in('status', ['sent', 'delivered', 'pending'])
        .order('sent_at', { ascending: false })
        .limit(5);
      
      if (emailLogsError1) {
        console.error('❌ [Cakto Webhook] Erro ao verificar email_logs (primeira verificação):', emailLogsError1);
      }
      
      // Verificar se já existe email enviado ou em processamento
      const hasEmailSent1 = existingEmailLogs1 && existingEmailLogs1.length > 0;
      
      // Se deve pular devido a múltiplos webhooks, pular imediatamente
      if (shouldSkipDueToMultipleWebhooks) {
        console.log('⏭️ [Cakto Webhook] Processamento de email pulado - múltiplos webhooks detectados', {
          order_id: order.id,
          timestamp: new Date().toISOString()
        });
        // Pular todo o processamento de email
      } else if (hasEmailSent1) {
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
      } else {
        // Aguardar 500ms para evitar race conditions (se dois webhooks chegarem simultaneamente)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Segunda verificação após delay (para pegar emails que podem ter sido enviados durante o delay)
        const { data: existingEmailLogs2, error: emailLogsError2 } = await supabaseClient
          .from('email_logs')
          .select('id, email_type, status, sent_at, recipient_email')
          .eq('order_id', order.id)
          .eq('email_type', 'order_paid')
          .in('status', ['sent', 'delivered', 'pending'])
          .order('sent_at', { ascending: false })
          .limit(5);
        
        if (emailLogsError2) {
          console.error('❌ [Cakto Webhook] Erro ao verificar email_logs (segunda verificação):', emailLogsError2);
        }
        
        const hasEmailSent2 = existingEmailLogs2 && existingEmailLogs2.length > 0;
        
        if (hasEmailSent2) {
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
        } else {
          console.log('📧 [Cakto Webhook] Nenhum email de confirmação encontrado - enviando email...', {
            order_id: order.id,
            verificacoes_realizadas: 2,
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
      
      // Gerar letra automaticamente
      let lyricsGenerated = false;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { data: lyricsData, error: lyricsError } = await supabaseClient.functions.invoke(
            'generate-lyrics-for-approval',
            {
              body: { order_id: order.id }
            }
          );
          
          if (!lyricsError && lyricsData && lyricsData.success !== false) {
            lyricsGenerated = true;
            break;
          }
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        } catch (invokeError: any) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      return reply
        .code(200)
        .headers(secureHeaders)
        .send({ 
          success: true,
          order_id: order.id,
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

      if (!provider || provider !== 'cakto') {
        return reply
          .code(400)
          .headers(secureHeaders)
          .send({ success: false, error: 'Invalid provider: must be cakto' });
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
}

