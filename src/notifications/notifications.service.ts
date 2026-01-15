import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  NotificationRule,
  UserNotification,
  UserNotificationPreference,
} from '../common/types';
import {
  CreateNotificationRuleDto,
  MarkReadDto,
  UpdatePreferencesDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}
  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findRules(
    tenantId: string,
    schoolId?: string,
  ): Promise<NotificationRule[]> {
    let q = this.supabase
      .from('notification_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data, error } = await q;
    if (error) throw new BadRequestException('Falha ao buscar regras');
    return data || [];
  }

  async findRule(id: string, tenantId: string): Promise<NotificationRule> {
    const { data, error } = await this.supabase
      .from('notification_rules')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error || !data) throw new NotFoundException('Regra nao encontrada');
    return data;
  }

  async createRule(
    tenantId: string,
    dto: CreateNotificationRuleDto,
    userId?: string,
  ): Promise<NotificationRule> {
    const { data, error } = await this.supabase
      .from('notification_rules')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id || null,
        event_type: dto.event_type,
        status: dto.status || 'active',
        target_kind: dto.target_kind,
        audience_config: dto.audience_config || {},
        template_config: dto.template_config || {},
        channels: dto.channels || ['in_app'],
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Falha ao criar regra');
    this.logger.log('Rule created', 'NotificationsService', {
      ruleId: data.id,
    });
    return data;
  }

  async updateRule(
    id: string,
    tenantId: string,
    dto: Partial<CreateNotificationRuleDto>,
    userId?: string,
  ): Promise<NotificationRule> {
    const upd: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };
    if (dto.event_type !== undefined) upd.event_type = dto.event_type;
    if (dto.status !== undefined) upd.status = dto.status;
    if (dto.target_kind !== undefined) upd.target_kind = dto.target_kind;
    if (dto.audience_config !== undefined)
      upd.audience_config = dto.audience_config;
    if (dto.channels !== undefined) upd.channels = dto.channels;
    const { data, error } = await this.supabase
      .from('notification_rules')
      .update(upd)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha ao atualizar');
    return data;
  }

  async removeRule(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    await this.findRule(id, tenantId);
    await this.softDeleteService.softDelete(
      this.supabase,
      'notification_rules',
      id,
      userId ?? '',
    );
  }

  async findUserNotifications(
    userId: string,
    tenantId: string,
    unreadOnly?: boolean,
  ): Promise<UserNotification[]> {
    let q = this.supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (unreadOnly) q = q.is('read_at', null);
    const { data, error } = await q;
    if (error) throw new BadRequestException('Falha');
    return data || [];
  }

  async getUnreadCount(
    userId: string,
    tenantId: string,
  ): Promise<{ count: number }> {
    const { count, error } = await this.supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('read_at', null)
      .is('deleted_at', null);
    if (error) throw new BadRequestException('Falha');
    return { count: count || 0 };
  }

  async markAsRead(
    userId: string,
    tenantId: string,
    dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    const { error } = await this.supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', dto.notification_ids)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException('Falha');
    return { updated: dto.notification_ids.length };
  }

  async markAllAsRead(
    userId: string,
    tenantId: string,
  ): Promise<{ updated: number }> {
    const { data, error } = await this.supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('read_at', null)
      .select();
    if (error) throw new BadRequestException('Falha');
    return { updated: data?.length || 0 };
  }

  async getPreferences(
    userId: string,
    tenantId: string,
  ): Promise<UserNotificationPreference | null> {
    const { data } = await this.supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    return data || null;
  }

  async updatePreferences(
    userId: string,
    tenantId: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserNotificationPreference> {
    const ex = await this.getPreferences(userId, tenantId);
    if (ex) {
      const { data, error } = await this.supabase
        .from('user_notification_preferences')
        .update({
          preferences: dto.preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ex.id)
        .select()
        .single();
      if (error) throw new BadRequestException('Falha');
      return data;
    }
    const { data, error } = await this.supabase
      .from('user_notification_preferences')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        preferences: dto.preferences,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async createNotification(
    tenantId: string,
    userId: string,
    type: string,
    title: string,
    body?: string,
    metadata?: Record<string, unknown>,
  ): Promise<UserNotification> {
    const { data, error } = await this.supabase
      .from('user_notifications')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        notification_type: type,
        title,
        body: body || null,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }
}
