import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Configurar fetch customizado para resolver problemas de DNS/rede
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      global: {
        fetch: (url, options = {}) => {
          // Criar AbortController para timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

          return fetch(url, {
            ...options,
            signal: controller.signal,
          }).finally(() => {
            clearTimeout(timeoutId);
          });
        },
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
