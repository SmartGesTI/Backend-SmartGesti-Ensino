import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { PushDeviceToken } from '../common/types';
import { RegisterTokenDto } from './dto/push-token.dto';

@Injectable()
export class PushTokensService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}
  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(userId: string, tenantId: string): Promise<PushDeviceToken[]> {
    const { data, error } = await this.supabase
      .from('push_device_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException('Falha ao buscar tokens');
    return data || [];
  }

  async register(
    userId: string,
    tenantId: string,
    dto: RegisterTokenDto,
  ): Promise<PushDeviceToken> {
    const { data: existing } = await this.supabase
      .from('push_device_tokens')
      .select('id')
      .eq('token', dto.token)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (existing) {
      const { data, error } = await this.supabase
        .from('push_device_tokens')
        .update({
          device_type: dto.device_type || 'other',
          device_name: dto.device_name || null,
          os_version: dto.os_version || null,
          app_version: dto.app_version || null,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new BadRequestException('Falha ao atualizar token');
      return data;
    }

    const { data, error } = await this.supabase
      .from('push_device_tokens')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        token: dto.token,
        device_type: dto.device_type || 'other',
        device_name: dto.device_name || null,
        os_version: dto.os_version || null,
        app_version: dto.app_version || null,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Failed to register token',
        error.message,
        'PushTokensService',
      );
      throw new BadRequestException('Falha ao registrar token');
    }

    this.logger.log('Push token registered', 'PushTokensService', {
      tokenId: data.id,
      userId,
    });
    return data;
  }

  async remove(id: string, userId: string, tenantId: string): Promise<void> {
    const { data } = await this.supabase
      .from('push_device_tokens')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (!data) throw new NotFoundException('Token nao encontrado');
    await this.supabase
      .from('push_device_tokens')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    this.logger.log('Push token removed', 'PushTokensService', { tokenId: id });
  }

  async removeByToken(
    token: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    await this.supabase
      .from('push_device_tokens')
      .update({ deleted_at: new Date().toISOString() })
      .eq('token', token)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);
  }

  async findByUserId(userId: string): Promise<PushDeviceToken[]> {
    const { data } = await this.supabase
      .from('push_device_tokens')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);
    return data || [];
  }
}
