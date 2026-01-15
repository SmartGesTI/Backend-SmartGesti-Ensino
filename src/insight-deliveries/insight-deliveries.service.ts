import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { InsightDelivery } from '../common/types';
import {
  CreateInsightDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/create-insight-delivery.dto';

@Injectable()
export class InsightDeliveriesService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: {
      insightInstanceId?: string;
      channel?: string;
      status?: string;
      limit?: number;
    },
  ): Promise<InsightDelivery[]> {
    let query = this.supabase
      .from('insight_deliveries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (options?.insightInstanceId)
      query = query.eq('insight_instance_id', options.insightInstanceId);
    if (options?.channel) query = query.eq('channel', options.channel);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list insight deliveries: ${error.message}`);
    return (data || []) as InsightDelivery[];
  }

  async findOne(id: string, tenantId: string): Promise<InsightDelivery | null> {
    const { data, error } = await this.supabase
      .from('insight_deliveries')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get insight delivery: ${error.message}`);
    }
    return data as InsightDelivery;
  }

  async create(
    tenantId: string,
    dto: CreateInsightDeliveryDto,
    userId?: string,
  ): Promise<InsightDelivery> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_deliveries')
      .insert({
        tenant_id: tenantId,
        insight_instance_id: dto.insight_instance_id,
        channel: dto.channel,
        recipient_id: dto.recipient_id ?? null,
        recipient_email: dto.recipient_email ?? null,
        recipient_phone: dto.recipient_phone ?? null,
        status: 'pending',
        scheduled_for: dto.scheduled_for ?? null,
        metadata: dto.metadata ?? {},
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error)
      throw new Error(`Failed to create insight delivery: ${error.message}`);
    this.logger.log('Insight delivery created', 'InsightDeliveriesService', {
      id: data.id,
      channel: dto.channel,
    });
    return data as InsightDelivery;
  }

  async send(id: string, tenantId: string): Promise<InsightDelivery> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight delivery com id '${id}' não encontrada`,
      );
    if (existing.status !== 'pending')
      throw new BadRequestException(
        `Delivery não pode ser enviada no status '${existing.status}'`,
      );
    const now = new Date().toISOString();
    // TODO: Implementar integração com serviços de envio (email, push, SMS, WhatsApp)
    const { data, error } = await this.supabase
      .from('insight_deliveries')
      .update({ status: 'sent', sent_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to send insight delivery: ${error.message}`);
    this.logger.log('Insight delivery sent', 'InsightDeliveriesService', {
      id,
    });
    return data as InsightDelivery;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateDeliveryStatusDto,
  ): Promise<InsightDelivery> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight delivery com id '${id}' não encontrada`,
      );
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'delivered' && !existing.delivered_at)
      updateData.delivered_at = now;
    if (dto.status === 'read' && !existing.read_at) updateData.read_at = now;
    if (dto.error_message) updateData.error_message = dto.error_message;
    const { data, error } = await this.supabase
      .from('insight_deliveries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(
        `Failed to update insight delivery status: ${error.message}`,
      );
    return data as InsightDelivery;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight delivery com id '${id}' não encontrada`,
      );
    const { error } = await this.supabase
      .from('insight_deliveries')
      .delete()
      .eq('id', id);
    if (error)
      throw new Error(`Failed to delete insight delivery: ${error.message}`);
  }
}
