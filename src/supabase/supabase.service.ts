import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseKey) missing.push('SUPABASE_SERVICE_KEY');
    if (missing.length > 0) {
      throw new Error(
        `Missing Supabase environment variables: ${missing.join(', ')}. ` +
          'Configure them in Vercel: Project Settings → Environment Variables.',
      );
    }

    const url = supabaseUrl as string;
    const key = supabaseKey as string;
    // Configurar fetch customizado para resolver problemas de DNS/rede
    this.client = createClient(url, key, {
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
