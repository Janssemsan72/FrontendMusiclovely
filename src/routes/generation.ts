import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { getSecureHeaders } from '../utils/security.js';

export async function generationRoutes(app: FastifyInstance) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // POST /api/lyrics/generate
  app.post('/api/lyrics/generate', async (request, reply) => {
    const origin = request.headers.origin || null;
    const secureHeaders = getSecureHeaders(origin);
    
    try {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });

      const body: any = request.body;
      
      // Proxy para Edge Function do Supabase
      const { data, error } = await supabaseClient.functions.invoke('generate-lyrics-internal', {
        body: body
      });

      if (error) {
        console.error('❌ [generate-lyrics] Erro na Edge Function:', error);
        return reply
          .code(500)
          .headers(secureHeaders)
          .send({ success: false, error: error.message });
      }

      return reply
        .code(200)
        .headers(secureHeaders)
        .send(data || { success: true });

    } catch (error: any) {
      console.error('❌ [generate-lyrics] Erro inesperado:', error);
      return reply
        .code(500)
        .headers(secureHeaders)
        .send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // POST /api/audio/generate
  app.post('/api/audio/generate', async (request, reply) => {
    const origin = request.headers.origin || null;
    const secureHeaders = getSecureHeaders(origin);
    
    try {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });

      const body: any = request.body;
      
      // Proxy para Edge Function do Supabase
      const { data, error } = await supabaseClient.functions.invoke('generate-audio-internal', {
        body: body
      });

      if (error) {
        console.error('❌ [generate-audio] Erro na Edge Function:', error);
        return reply
          .code(500)
          .headers(secureHeaders)
          .send({ success: false, error: error.message });
      }

      return reply
        .code(200)
        .headers(secureHeaders)
        .send(data || { success: true });

    } catch (error: any) {
      console.error('❌ [generate-audio] Erro inesperado:', error);
      return reply
        .code(500)
        .headers(secureHeaders)
        .send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // POST /api/suno/callback
  app.post('/api/suno/callback', async (request, reply) => {
    const origin = request.headers.origin || null;
    const secureHeaders = getSecureHeaders(origin);
    
    try {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });

      const body: any = request.body;
      
      // Proxy para Edge Function do Supabase
      const { data, error } = await supabaseClient.functions.invoke('suno-callback', {
        body: body
      });

      if (error) {
        console.error('❌ [suno-callback] Erro na Edge Function:', error);
        return reply
          .code(500)
          .headers(secureHeaders)
          .send({ success: false, error: error.message });
      }

      return reply
        .code(200)
        .headers(secureHeaders)
        .send(data || { success: true });

    } catch (error: any) {
      console.error('❌ [suno-callback] Erro inesperado:', error);
      return reply
        .code(500)
        .headers(secureHeaders)
        .send({ success: false, error: error?.message || 'Unknown error' });
    }
  });
}

