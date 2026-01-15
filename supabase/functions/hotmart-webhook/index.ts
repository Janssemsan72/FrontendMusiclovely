// ✅ Edge Function: hotmart-webhook
// Esta função processa webhooks da Hotmart e gera letras automaticamente
// IMPORTANTE: Deve garantir que jobs sejam criados e letras sejam geradas
// Estrutura baseada na função da Cakto para consistência

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

/**
 * Função auxiliar para validar UUID
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Função auxiliar para garantir que um job existe para um pedido
 */
async function ensureJobExists(
  supabase: any,
  orderId: string,
  quizId: string | null
): Promise<{ jobId: string | null; created: boolean }> {
  if (!quizId) {
    console.warn(`⚠️ [Hotmart Webhook] Pedido ${orderId} não tem quiz_id - não é possível criar job`);
    return { jobId: null, created: false };
  }

  try {
    // Verificar se job já existe
    const { data: existingJob, error: checkError } = await supabase
      .from("jobs")
      .select("id, status")
      .eq("order_id", orderId)
      .limit(1);

    if (checkError) {
      console.error(`❌ [Hotmart Webhook] Erro ao verificar job existente para pedido ${orderId}:`, checkError);
      return { jobId: null, created: false };
    }

    if (existingJob && existingJob.length > 0) {
      console.log(`✅ [Hotmart Webhook] Job já existe para pedido ${orderId}`, {
        job_id: existingJob[0].id,
        job_status: existingJob[0].status
      });
      return { jobId: existingJob[0].id, created: false };
    }

    // Job não existe - criar manualmente
    console.log(`🔧 [Hotmart Webhook] Job não existe - criando manualmente para pedido ${orderId}`, {
      order_id: orderId,
      quiz_id: quizId
    });

    const { data: newJob, error: createError } = await supabase
      .from("jobs")
      .insert({
        order_id: orderId,
        quiz_id: quizId,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (createError || !newJob) {
      console.error(`❌ [Hotmart Webhook] Erro ao criar job para pedido ${orderId}:`, createError);
      return { jobId: null, created: false };
    }

    console.log(`✅ [Hotmart Webhook] Job criado com sucesso para pedido ${orderId}`, {
      job_id: newJob.id,
      order_id: orderId
    });

    return { jobId: newJob.id, created: true };
  } catch (error: any) {
    console.error(`❌ [Hotmart Webhook] Exceção ao garantir job para pedido ${orderId}:`, error);
    return { jobId: null, created: false };
  }
}

serve(async (req) => {
  // ✅ SEMPRE aceitar OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ✅ SEMPRE aceitar POST (webhook da Hotmart)
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const startTime = Date.now();
  let body: any = null;

  try {
    console.log("==========================================");
    console.log("🔔 [Hotmart Webhook] WEBHOOK RECEBIDO");
    console.log("==========================================");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ✅ LOGS DETALHADOS: Logar TODOS os headers ANTES de qualquer processamento
    const allHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log("📋 [Hotmart Webhook] Headers recebidos (COMPLETO):", JSON.stringify(allHeaders, null, 2));

    const hotmartSecret = Deno.env.get("HOTMART_WEBHOOK_SECRET");

    console.log("🔐 [Hotmart Webhook] Configuração de autenticação:", {
      has_secret: !!hotmartSecret,
      secret_length: hotmartSecret?.length || 0,
      secret_preview: hotmartSecret ? `${hotmartSecret.substring(0, 20)}...${hotmartSecret.substring(hotmartSecret.length - 10)}` : "não configurado"
    });

    // ✅ Ler body como texto primeiro para log completo (ANTES do parse)
    let rawBodyText = "";
    try {
      // Clonar request para poder ler como texto E como JSON
      const clonedReq = req.clone();
      rawBodyText = await clonedReq.text();
      console.log("🧨 [Hotmart Webhook] RAW BODY (completo, sem parse):", rawBodyText);
      console.log("🧨 [Hotmart Webhook] RAW BODY length:", rawBodyText.length);
    } catch (textError) {
      console.warn("⚠️ [Hotmart Webhook] Não foi possível ler body como texto:", textError);
    }

    // ✅ Parse do body ANTES de validar autenticação (para poder ler hottok do body)
    try {
      body = await req.json();
      console.log("✅ [Hotmart Webhook] Body parseado com sucesso");
    } catch (parseError: any) {
      console.error("❌ [Hotmart Webhook] Erro ao fazer parse do body:", parseError);
      
      // ✅ SEMPRE retornar 200 OK para evitar retry da Hotmart
      return new Response(
        JSON.stringify({
          received: true,
          error: "Invalid JSON body",
          message: "Webhook body não é um JSON válido"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body || Object.keys(body).length === 0) {
      console.error("❌ [Hotmart Webhook] Body vazio ou ausente");
      // ✅ SEMPRE retornar 200 OK para evitar retry da Hotmart
      return new Response(
        JSON.stringify({ 
          received: true,
          error: "Empty body", 
          message: "Webhook body está vazio ou ausente" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ✅ LOG COMPLETO DO PAYLOAD (essencial para debug) - ANTES de qualquer processamento
    const bodyString = JSON.stringify(body, null, 2);
    console.log("📦 [Hotmart Webhook] Payload COMPLETO:", 
      bodyString.length > 10000 ? bodyString.substring(0, 10000) + "... [truncado após 10000 chars]" : bodyString
    );

    // ✅ Autenticação: Header oficial da Hotmart é X-HOTMART-HOTTOK
    // Também suporta campo hottok no body (formato antigo)
    const xHotmartHottok = req.headers.get("x-hotmart-hottok") || req.headers.get("X-HOTMART-HOTTOK") || "";
    const xHotmartToken = req.headers.get("x-hotmart-token") || req.headers.get("X-HOTMART-TOKEN") || "";
    const xHotmartSignature = req.headers.get("x-hotmart-signature") || req.headers.get("X-HOTMART-SIGNATURE") || "";

    // Priorizar header oficial X-HOTMART-HOTTOK, depois token no body
    const receivedSignature = xHotmartHottok || xHotmartToken || xHotmartSignature || "";

    console.log("🔍 [Hotmart Webhook] Tokens extraídos:", {
      x_hotmart_hottok: xHotmartHottok ? `${xHotmartHottok.substring(0, 20)}...` : "não encontrado",
      x_hotmart_token: xHotmartToken ? `${xHotmartToken.substring(0, 20)}...` : "não encontrado",
      x_hotmart_signature: xHotmartSignature ? `${xHotmartSignature.substring(0, 20)}...` : "não encontrado",
      received_signature: receivedSignature ? `${receivedSignature.substring(0, 20)}...` : "não encontrado"
    });

    // ✅ Validação de autenticação: Apenas token da Hotmart (sem dependência de Supabase auth)
    // Suportar token no header (X-HOTMART-HOTTOK) ou no body (hottok)
    const bodyToken = body.hottok || body.token || body.secret || "";
    
    if (!hotmartSecret) {
      console.error("❌ [Hotmart Webhook] HOTMART_WEBHOOK_SECRET não configurado");
      // ✅ SEMPRE retornar 200 OK para evitar retry da Hotmart
      return new Response(
        JSON.stringify({ 
          received: true,
          error: "Webhook secret not configured" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedSecret = String(hotmartSecret).trim();
    const normalizedReceived = receivedSignature ? String(receivedSignature).trim() : "";
    const normalizedBodyToken = bodyToken ? String(bodyToken).trim() : "";

    console.log("🔐 [Hotmart Webhook] Comparação de autenticação:", {
      secret_length: normalizedSecret.length,
      received_signature_length: normalizedReceived.length,
      body_token_length: normalizedBodyToken.length,
      received_signature_preview: normalizedReceived ? `${normalizedReceived.substring(0, 30)}...${normalizedReceived.substring(normalizedReceived.length - 10)}` : "vazio",
      body_token_preview: normalizedBodyToken ? `${normalizedBodyToken.substring(0, 30)}...${normalizedBodyToken.substring(normalizedBodyToken.length - 10)}` : "vazio",
      secret_preview: `${normalizedSecret.substring(0, 30)}...${normalizedSecret.substring(normalizedSecret.length - 10)}`
    });

    const isValid = normalizedReceived === normalizedSecret ||
                    normalizedBodyToken === normalizedSecret ||
                    normalizedReceived.toLowerCase() === normalizedSecret.toLowerCase() ||
                    normalizedBodyToken.toLowerCase() === normalizedSecret.toLowerCase();

    if (!isValid) {
      console.error("❌ [Hotmart Webhook] Assinatura inválida - DETALHES COMPLETOS:", {
        received_signature_length: normalizedReceived.length,
        body_token_length: normalizedBodyToken.length,
        expected_secret_length: normalizedSecret.length,
        received_signature_first_50: normalizedReceived.substring(0, 50),
        body_token_first_50: normalizedBodyToken.substring(0, 50),
        expected_secret_first_50: normalizedSecret.substring(0, 50),
        received_signature_last_50: normalizedReceived.length > 50 ? normalizedReceived.substring(normalizedReceived.length - 50) : normalizedReceived,
        body_token_last_50: normalizedBodyToken.length > 50 ? normalizedBodyToken.substring(normalizedBodyToken.length - 50) : normalizedBodyToken,
        expected_secret_last_50: normalizedSecret.length > 50 ? normalizedSecret.substring(normalizedSecret.length - 50) : normalizedSecret,
        exact_match_received: normalizedReceived === normalizedSecret,
        exact_match_body: normalizedBodyToken === normalizedSecret,
        case_insensitive_match_received: normalizedReceived.toLowerCase() === normalizedSecret.toLowerCase(),
        case_insensitive_match_body: normalizedBodyToken.toLowerCase() === normalizedSecret.toLowerCase()
      });
      
      // ✅ SEMPRE retornar 200 OK mesmo quando validação falha (para evitar retry da Hotmart)
      // Mas registrar o erro nos logs para debug
      try {
        await supabase.from("hotmart_webhook_logs").insert({
          webhook_body: body,
          transaction_id: null,
          order_id_from_webhook: null,
          status_received: null,
          customer_email: null,
          amount_cents: null,
          order_found: false,
          processing_success: false,
          error_message: "Assinatura inválida ou ausente",
          strategy_used: "none"
        });
      } catch (logError) {
        console.error("❌ [Hotmart Webhook] Erro ao registrar log de autenticação:", logError);
      }
      
      return new Response(
        JSON.stringify({
          received: true,
          error: "Invalid or missing signature",
          message: "Webhook deve incluir assinatura válida (X-HOTMART-HOTTOK header ou hottok no body)",
          debug: {
            has_header_token: !!receivedSignature,
            has_body_token: !!bodyToken,
            received_signature_length: normalizedReceived.length,
            body_token_length: normalizedBodyToken.length,
            expected_secret_length: normalizedSecret.length
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("✅ [Hotmart Webhook] Assinatura válida!");

    // ✅ Extração de dados: Formato oficial v2.0.0 da Hotmart
    // Formato: payload.data.purchase, payload.data.buyer
    const event = body.event || ""; // "PURCHASE_COMPLETE" ou "PURCHASE_APPROVED"
    const data = body.data || {};
    
    // Purchase está em data.purchase
    const purchase = data.purchase || {};
    
    // Buyer está em data.buyer (NÃO em purchase.buyer)
    const buyer = data.buyer || {};
    
    // ✅ Logs detalhados da estrutura do body
    console.log("📦 [Hotmart Webhook] Estrutura do body:", {
      has_event: !!body.event,
      has_data: !!body.data,
      has_purchase: !!(body.data?.purchase),
      has_buyer: !!(body.data?.buyer),
      body_keys: Object.keys(body),
      data_keys: body.data ? Object.keys(body.data) : [],
      purchase_keys: body.data?.purchase ? Object.keys(body.data.purchase) : [],
      buyer_keys: body.data?.buyer ? Object.keys(body.data.buyer) : []
    });

    // ✅ Logs dos valores brutos extraídos
    console.log("🔍 [Hotmart Webhook] Valores brutos extraídos:", {
      event: body.event,
      transaction_from_purchase: body.data?.purchase?.transaction,
      email_from_buyer: body.data?.buyer?.email,
      phone_code_from_buyer: body.data?.buyer?.checkout_phone_code,
      phone_from_buyer: body.data?.buyer?.checkout_phone,
      price_value_from_purchase: body.data?.purchase?.price?.value,
      approved_date_from_purchase: body.data?.purchase?.approved_date,
      purchase_status: body.data?.purchase?.status,
      metadata_order_id: body.data?.metadata?.order_id
    });
    
    // Transaction ID está em purchase.transaction (ex: "HP16015479281022")
    const transaction_id = purchase.transaction || null;
    
    // Order ID pode estar em data.metadata.order_id ou precisamos extrair da URL do checkout
    // No formato oficial, não há order_id direto, então vamos usar transaction_id ou buscar por email/telefone
    const order_id_from_webhook = data.metadata?.order_id || null;
    
    // Email está em buyer.email
    const customer_email_raw = buyer.email || "";
    const customer_email = customer_email_raw ? String(customer_email_raw).toLowerCase().trim() : "";
    
    // Telefone: checkout_phone pode vir completo OU separado em code + phone
    const phoneCode = buyer.checkout_phone_code || "";
    const phoneNumber = buyer.checkout_phone || "";
    const customer_phone = phoneNumber 
      ? (phoneCode && !phoneNumber.startsWith(phoneCode) ? `${phoneCode}${phoneNumber}` : phoneNumber)
      : null;
    
    // Valor está em purchase.price.value (não purchase.amount)
    const price = purchase.price || {};
    const amount_reais_raw = price.value || purchase.full_price?.value || 0;
    const amount_reais = typeof amount_reais_raw === "string"
      ? parseFloat(amount_reais_raw)
      : Number(amount_reais_raw) || 0;
    const amount_cents = Math.round(amount_reais * 100);
    
    // Data de aprovação está em purchase.approved_date (timestamp em ms)
    const approvedDateTimestamp = purchase.approved_date || null;
    const paid_at = approvedDateTimestamp
      ? new Date(approvedDateTimestamp).toISOString()
      : new Date().toISOString();

    // Status da compra está em purchase.status (ex: "COMPLETED")
    const purchaseStatus = purchase.status || "";

    // ✅ Log dos valores brutos SEM mascaramento (para debug)
    console.log("🔍 [Hotmart Webhook] Valores brutos extraídos (SEM mascaramento):", {
      event: body.event,
      transaction_from_purchase: body.data?.purchase?.transaction,
      email_from_buyer: body.data?.buyer?.email, // SEM mascaramento
      phone_code_from_buyer: body.data?.buyer?.checkout_phone_code,
      phone_from_buyer: body.data?.buyer?.checkout_phone, // SEM mascaramento
      price_value_from_purchase: body.data?.purchase?.price?.value,
      approved_date_from_purchase: body.data?.purchase?.approved_date,
      purchase_status: body.data?.purchase?.status,
      metadata_order_id: body.data?.metadata?.order_id
    });

    console.log("🔍 [Hotmart Webhook] Dados extraídos (processados):", {
      event,
      transaction_id,
      order_id_from_webhook,
      customer_email: customer_email ? "***" : "não encontrado",
      customer_phone: customer_phone ? "***" : "não encontrado",
      amount_cents,
      paid_at,
      purchase_status: purchaseStatus
    });

    // Validação de identificadores
    const hasOrderId = order_id_from_webhook && String(order_id_from_webhook).trim().length > 0;
    const hasTransactionId = transaction_id && String(transaction_id).trim().length > 0;
    const hasCustomerEmail = customer_email && customer_email.trim().length > 0;

    if (!hasOrderId && !hasTransactionId && !hasCustomerEmail) {
      console.error("❌ [Hotmart Webhook] NENHUM identificador encontrado");
      
      try {
        await supabase.from("hotmart_webhook_logs").insert({
          webhook_body: body,
          transaction_id: transaction_id || null,
          order_id_from_webhook: order_id_from_webhook || null,
          status_received: event || null,
          customer_email: customer_email || null,
          amount_cents: amount_cents || null,
          order_found: false,
          processing_success: false,
          error_message: "Nenhum identificador encontrado",
          strategy_used: "none"
        });
      } catch (logError) {
        console.error("❌ [Hotmart Webhook] Erro ao registrar log:", logError);
      }

      // ✅ SEMPRE retornar 200 OK para evitar retry da Hotmart
      return new Response(
        JSON.stringify({
          received: true,
          error: "Nenhum identificador encontrado",
          message: "Webhook não contém order_id, transaction_id ou customer_email"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalizar status (suportar PURCHASE_COMPLETE e PURCHASE_APPROVED)
    let statusNormalized = "approved";
    const eventLower = event.toLowerCase();
    
    if (eventLower === "purchase_approved" || 
        eventLower === "purchase_complete" ||
        eventLower.includes("approved") || 
        eventLower.includes("complete") ||
        purchaseStatus === "COMPLETED" ||
        body.status === "approved") {
      statusNormalized = "approved";
    } else if (eventLower === "purchase_cancelled" || eventLower.includes("cancelled") || body.status === "cancelled") {
      statusNormalized = "cancelled";
    } else if (eventLower === "purchase_chargeback" || eventLower.includes("chargeback") || body.status === "chargeback") {
      statusNormalized = "chargeback";
    }

    // ✅ Buscar pedido usando as mesmas estratégias da Cakto
    let order: any = null;
    let strategyUsed = "none";

    // Estratégia 0: order_id_from_webhook (mais confiável) - EXATAMENTE como Cakto
    if (!order && order_id_from_webhook && isValidUUID(order_id_from_webhook)) {
      // Tentativa 1: Com filtro provider (igual à Cakto)
      const { data: orderById, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id_from_webhook)
        .eq("provider", "hotmart")
        .single();

      if (orderById && !error) {
        order = orderById;
        strategyUsed = "order_id_from_webhook";
        console.log("✅ [Hotmart Webhook] Pedido encontrado pela Estratégia 0 (com provider)", {
          order_id: order.id,
          provider: order.provider
        });
      } else {
        // Tentativa 2: Sem filtro provider (fallback para pedidos recém-criados)
        console.log("🔍 [Hotmart Webhook] Estratégia 0 (com provider) não encontrou - tentando sem filtro...", {
          order_id_from_webhook,
          error: error?.message
        });
        
        const { data: orderByIdNoProvider, error: errorNoProvider } = await supabase
          .from("orders")
          .select("*")
          .eq("id", order_id_from_webhook)
          .single();

        if (orderByIdNoProvider && !errorNoProvider) {
          order = orderByIdNoProvider;
          strategyUsed = "order_id_from_webhook";
          console.log("✅ [Hotmart Webhook] Pedido encontrado pela Estratégia 0 (sem filtro provider)", {
            order_id: order.id,
            provider: order.provider || "não definido"
          });
        } else {
          console.log("❌ [Hotmart Webhook] Estratégia 0 não encontrou pedido (com e sem provider)", {
            order_id_from_webhook,
            error: errorNoProvider?.message
          });
        }
      }
    }

    // Estratégia 1: transaction_id (usar campo genérico, não hotmart_transaction_id)
    if (!order && transaction_id && transaction_id.trim().length >= 6) {
      console.log("🔍 [Hotmart Webhook] Tentando Estratégia 1 (transaction_id)...", {
        transaction_id: transaction_id.substring(0, 20) + "..."
      });
      
      const { data: orderByTxId, error } = await supabase
        .from("orders")
        .select("*")
        .eq("transaction_id", transaction_id)  // Usar transaction_id genérico
        .single();

      if (orderByTxId && !error) {
        order = orderByTxId;
        strategyUsed = "hotmart_transaction_id";
        console.log("✅ [Hotmart Webhook] Pedido encontrado pela Estratégia 1 (transaction_id)", {
          order_id: order.id,
          transaction_id: transaction_id.substring(0, 20) + "..."
        });
      } else {
        console.log("❌ [Hotmart Webhook] Estratégia 1 não encontrou pedido", {
          transaction_id: transaction_id.substring(0, 20) + "...",
          error: error?.message
        });
      }
    }

    // Estratégia 2: Email (próximo pedido pendente) - igual à Cakto
    if (!order && customer_email) {
      console.log("🔍 [Hotmart Webhook] Tentando Estratégia 2 (email)...", {
        customer_email: customer_email.substring(0, 10) + "***"
      });
      
      const { data: ordersByEmail, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_email", customer_email)
        .eq("provider", "hotmart")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (ordersByEmail && ordersByEmail.length > 0) {
        order = ordersByEmail[0];
        strategyUsed = "email_most_recent";
        console.log("✅ [Hotmart Webhook] Pedido encontrado pela Estratégia 2 (email)", {
          order_id: order.id,
          total_orders_found: ordersByEmail.length,
          customer_email: customer_email.substring(0, 10) + "***"
        });
      } else {
        console.log("❌ [Hotmart Webhook] Estratégia 2 não encontrou pedido", {
          customer_email: customer_email.substring(0, 10) + "***",
          error: error?.message
        });
      }
    }

    // Estratégia 3: Telefone/WhatsApp - igual à Cakto
    if (!order && customer_phone) {
      const normalizedPhone = customer_phone.replace(/\D/g, "");
      console.log("🔍 [Hotmart Webhook] Tentando Estratégia 3 (telefone)...", {
        customer_phone_normalized: normalizedPhone.substring(0, 5) + "***"
      });

      const { data: ordersByPhone, error } = await supabase
        .from("orders")
        .select("*")
        .eq("provider", "hotmart")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (ordersByPhone && ordersByPhone.length > 0) {
        const filteredOrders = ordersByPhone.filter((o: any) => {
          const orderPhone = ((o.customer_whatsapp || o.customer_phone || "")).replace(/\D/g, "");
          return orderPhone === normalizedPhone ||
                 orderPhone.endsWith(normalizedPhone) ||
                 normalizedPhone.endsWith(orderPhone);
        });

        if (filteredOrders.length > 0) {
          order = filteredOrders[0];
          strategyUsed = "phone_most_recent";
          console.log("✅ [Hotmart Webhook] Pedido encontrado pela Estratégia 3 (telefone)", {
            order_id: order.id,
            total_orders_found: ordersByPhone.length,
            filtered_orders: filteredOrders.length,
            customer_phone_normalized: normalizedPhone.substring(0, 5) + "***"
          });
        } else {
          console.log("❌ [Hotmart Webhook] Estratégia 3 não encontrou pedido (telefone não correspondeu)", {
            total_orders_checked: ordersByPhone.length,
            customer_phone_normalized: normalizedPhone.substring(0, 5) + "***"
          });
        }
      } else {
        console.log("❌ [Hotmart Webhook] Estratégia 3 não encontrou pedidos pendentes", {
          error: error?.message,
          customer_phone_normalized: normalizedPhone.substring(0, 5) + "***"
        });
      }
    }

    if (!order) {
      console.error("❌ [Hotmart Webhook] PEDIDO NÃO ENCONTRADO");

      try {
        await supabase.from("hotmart_webhook_logs").insert({
          webhook_body: body,
          transaction_id: transaction_id || null,
          order_id_from_webhook: order_id_from_webhook || null,
          status_received: statusNormalized,
          customer_email: customer_email || null,
          amount_cents: amount_cents || null,
          order_found: false,
          processing_success: false,
          error_message: "Pedido não encontrado",
          strategy_used: "none"
        });
      } catch (logError) {
        console.error("❌ [Hotmart Webhook] Erro ao registrar log:", logError);
      }

      // ✅ SEMPRE retornar 200 OK para evitar retry da Hotmart
      return new Response(
        JSON.stringify({
          received: true,
          error: "Pedido não encontrado",
          message: "Nenhum pedido corresponde aos dados fornecidos"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ✅ Validação de identificadores confiáveis (igual à Cakto)
    const isReliableIdentifier = strategyUsed === "order_id_from_webhook" ||
                                 strategyUsed === "hotmart_transaction_id" ||
                                 strategyUsed === "phone_most_recent";

    if (!isReliableIdentifier && customer_email && order.customer_email !== customer_email) {
      if (customer_phone && order.customer_whatsapp) {
        const normalizedWebhookPhone = customer_phone.replace(/\D/g, "");
        const normalizedOrderPhone = order.customer_whatsapp.replace(/\D/g, "");

        const phoneMatch = normalizedOrderPhone === normalizedWebhookPhone ||
                          normalizedOrderPhone.endsWith(normalizedWebhookPhone) ||
                          normalizedWebhookPhone.endsWith(normalizedOrderPhone);

        if (!phoneMatch) {
          // ✅ SEMPRE retornar 200 OK para evitar retry da Hotmart
          return new Response(
            JSON.stringify({
              received: true,
              error: "Validação falhou",
              message: "Email e telefone não correspondem"
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // ✅ SEMPRE retornar 200 OK para evitar retry da Hotmart
        return new Response(
          JSON.stringify({
            received: true,
            error: "Validação falhou",
            message: "Email não corresponde"
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ✅ Verificar se deve processar (PURCHASE_COMPLETE e PURCHASE_APPROVED)
    const shouldProcess = eventLower === "purchase_approved" || 
                         eventLower === "purchase_complete" ||
                         purchaseStatus === "COMPLETED" ||
                         statusNormalized === "approved";

    console.log("🔍 [Hotmart Webhook] Verificação de processamento:", {
      event,
      event_lower: eventLower,
      purchase_status: purchaseStatus,
      status_normalized: statusNormalized,
      should_process: shouldProcess
    });

    if (!shouldProcess) {
      return new Response(
        JSON.stringify({
          received: true,
          event: event || "unknown",
          status: statusNormalized,
          purchase_status: purchaseStatus,
          message: "Webhook recebido mas não processado - apenas eventos PURCHASE_APPROVED ou PURCHASE_COMPLETE são processados"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ✅ Verificar se pedido já está pago (mas ainda assim processar geração de letras)
    const wasAlreadyPaid = order.status === "paid";

    if (wasAlreadyPaid) {
      console.log("✅ [Hotmart Webhook] Pedido já está pago - verificando se precisa gerar letra", {
        order_id: order.id
      });
    }

    const paidAtTimestamp = paid_at || new Date().toISOString();

    // ✅ Atualizar pedido para 'paid' (usando apenas campos que existem)
    const { error: updateError, data: updateData } = await supabase
      .from("orders")
      .update({
        status: "paid",
        provider: "hotmart",
        transaction_id: transaction_id,  // Usar transaction_id genérico
        provider_ref: transaction_id,  // Armazenar também em provider_ref para referência
        paid_at: paidAtTimestamp || order.paid_at,
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id)
      .select("id, status, paid_at, quiz_id");

    if (updateError || !updateData || updateData.length === 0) {
      console.error("❌ [Hotmart Webhook] Erro ao atualizar:", updateError);

      try {
        await supabase.from("hotmart_webhook_logs").insert({
          webhook_body: body,
          transaction_id: transaction_id || null,
          order_id_from_webhook: order_id_from_webhook || null,
          status_received: statusNormalized,
          customer_email: customer_email || null,
          amount_cents: amount_cents || null,
          order_found: true,
          processing_success: false,
          error_message: updateError?.message || "Erro ao atualizar pedido",
          strategy_used: strategyUsed
        });
      } catch (logError) {
        console.error("❌ [Hotmart Webhook] Erro ao registrar log:", logError);
      }

      throw updateError || new Error("Nenhuma linha foi atualizada");
    }

    const updatedOrder = updateData[0];

    if (updatedOrder.status !== "paid") {
      throw new Error(`Pedido não foi marcado como paid. Status atual: ${updatedOrder.status}`);
    }

    console.log("✅ [Hotmart Webhook] Pedido marcado como pago!", {
      order_id: updatedOrder.id,
      status: updatedOrder.status,
      was_already_paid: wasAlreadyPaid
    });

    // ✅ Registrar log de sucesso (igual à Cakto)
    try {
      await supabase.from("hotmart_webhook_logs").insert({
        webhook_body: body,
        transaction_id: transaction_id || null,
        order_id_from_webhook: order_id_from_webhook || null,
        status_received: statusNormalized,
        customer_email: customer_email || null,
        amount_cents: amount_cents || null,
        order_found: true,
        processing_success: true,
        strategy_used: strategyUsed,
        processing_time_ms: Date.now() - startTime
      });
    } catch (logError) {
      console.error("❌ [Hotmart Webhook] Erro ao registrar log de sucesso:", logError);
    }

    // ✅ Chamar notify-payment-webhook para enviar email (igual à Cakto - ANTES de gerar letra)
    try {
      console.log("📧 [Hotmart Webhook] Chamando notify-payment-webhook para enviar email...", {
        order_id: updatedOrder.id,
        timestamp: new Date().toISOString()
      });

      // ✅ CORREÇÃO: Passar Authorization header com service role key para autenticação
      const { data: notifyData, error: notifyError } = await supabase.functions.invoke(
        "notify-payment-webhook",
        {
          body: { order_id: updatedOrder.id },
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`
          }
        }
      );

      if (notifyError) {
        console.error("❌ [Hotmart Webhook] Erro ao chamar notify-payment-webhook:", {
          order_id: updatedOrder.id,
          error: notifyError,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log("✅ [Hotmart Webhook] notify-payment-webhook chamado com sucesso", {
          order_id: updatedOrder.id,
          response: notifyData,
          timestamp: new Date().toISOString()
        });
      }
    } catch (notifyException: any) {
      console.error("❌ [Hotmart Webhook] Exceção ao chamar notify-payment-webhook:", {
        order_id: updatedOrder.id,
        exception: notifyException,
        message: notifyException?.message,
        timestamp: new Date().toISOString()
      });
    }

    // ✅ CORREÇÃO CRÍTICA: Gerar letra automaticamente SEMPRE que pedido é pago (igual à Cakto)
    let lyricsGenerated = false;

    console.log("🎵 [Hotmart Webhook] Iniciando processo de geração de letras...", {
      order_id: updatedOrder.id,
      quiz_id: updatedOrder.quiz_id,
      timestamp: new Date().toISOString()
    });

    // PASSO 1: Verificar se já existe approval (idempotência)
    let shouldGenerateLyrics = true;
    try {
      const { data: existingApproval, error: approvalCheckError } = await supabase
        .from("lyrics_approvals")
        .select("id, status")
        .eq("order_id", updatedOrder.id)
        .limit(1);

      if (approvalCheckError) {
        console.warn("⚠️ [Hotmart Webhook] Erro ao verificar approval existente, continuando...", {
          order_id: updatedOrder.id,
          error: approvalCheckError?.message
        });
      } else if (existingApproval && existingApproval.length > 0) {
        console.log("ℹ️ [Hotmart Webhook] Approval já existe - pulando geração de letra", {
          order_id: updatedOrder.id,
          approval_id: existingApproval[0].id,
          approval_status: existingApproval[0].status,
          timestamp: new Date().toISOString()
        });
        shouldGenerateLyrics = false;
      }
    } catch (approvalError: any) {
      console.warn("⚠️ [Hotmart Webhook] Exceção ao verificar approval, continuando...", {
        order_id: updatedOrder.id,
        error: approvalError?.message
      });
    }

    // PASSO 2: Garantir que job existe (criar se necessário)
    if (shouldGenerateLyrics) {
      if (!updatedOrder.quiz_id) {
        console.warn("⚠️ [Hotmart Webhook] Pedido não tem quiz_id - não é possível gerar letra", {
          order_id: updatedOrder.id,
          timestamp: new Date().toISOString()
        });
        shouldGenerateLyrics = false;
      } else {
        const { jobId, created } = await ensureJobExists(
          supabase,
          updatedOrder.id,
          updatedOrder.quiz_id
        );

        if (!jobId) {
          console.error("❌ [Hotmart Webhook] Não foi possível garantir job - pulando geração de letra", {
            order_id: updatedOrder.id,
            quiz_id: updatedOrder.quiz_id,
            timestamp: new Date().toISOString()
          });
          shouldGenerateLyrics = false;
        } else {
          console.log("✅ [Hotmart Webhook] Job garantido para geração de letras", {
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
      console.log("🎵 [Hotmart Webhook] Chamando generate-lyrics-for-approval para gerar letra...", {
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

          const { data: lyricsData, error: lyricsError } = await supabase.functions.invoke(
            "generate-lyrics-for-approval",
            {
              body: { order_id: updatedOrder.id }
            }
          );

          if (!lyricsError && lyricsData && lyricsData.success !== false) {
            lyricsGenerated = true;
            console.log("✅ [Hotmart Webhook] Letra sendo gerada com sucesso", {
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
            await new Promise((resolve) => setTimeout(resolve, delay));
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
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!lyricsGenerated) {
        console.error("❌ [Hotmart Webhook] Falha ao gerar letra após todas as tentativas", {
          order_id: updatedOrder.id,
          max_retries: maxRetries,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log("⏭️ [Hotmart Webhook] Geração de letra não será executada", {
        order_id: updatedOrder.id,
        reason: "Approval já existe ou pedido não tem quiz_id",
        timestamp: new Date().toISOString()
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        received: true,
        event: event,
        order_id: updatedOrder.id,
        strategy_used: strategyUsed,
        lyrics_generated: lyricsGenerated,
        message: "Pedido marcado como pago. Email e letra serão enviados automaticamente."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("❌ [Hotmart Webhook] Erro fatal:", error);

    // Registrar log de erro fatal
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from("hotmart_webhook_logs").insert({
        webhook_body: body || {},
        transaction_id: null,
        order_id_from_webhook: null,
        status_received: null,
        customer_email: null,
        amount_cents: null,
        order_found: false,
        processing_success: false,
        error_message: `Erro fatal: ${error.message}`,
        strategy_used: "none"
      });
    } catch (logError) {
      console.error("❌ [Hotmart Webhook] Erro ao registrar log de erro fatal:", logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        received: true,
        error: "Internal server error",
        message: error.message
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
