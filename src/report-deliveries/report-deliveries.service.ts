import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { ReportDelivery } from '../common/types';
import {
  CreateReportDeliveryDto,
  UpdateReportDeliveryStatusDto,
} from './dto/create-report-delivery.dto';

@Injectable()
export class ReportDeliveriesService {
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
      reportRunId?: string;
      channel?: string;
      status?: string;
      limit?: number;
    },
  ): Promise<ReportDelivery[]> {
    let query = this.supabase
      .from('report_deliveries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (options?.reportRunId)
      query = query.eq('report_run_id', options.reportRunId);
    if (options?.channel) query = query.eq('channel', options.channel);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list report deliveries: ${error.message}`);
    return (data || []) as ReportDelivery[];
  }

  async findOne(id: string, tenantId: string): Promise<ReportDelivery | null> {
    const { data, error } = await this.supabase
      .from('report_deliveries')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get report delivery: ${error.message}`);
    }
    return data as ReportDelivery;
  }

  async create(
    tenantId: string,
    dto: CreateReportDeliveryDto,
    userId?: string,
  ): Promise<ReportDelivery> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('report_deliveries')
      .insert({
        tenant_id: tenantId,
        report_run_id: dto.report_run_id,
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
      throw new Error(`Failed to create report delivery: ${error.message}`);
    this.logger.log('Report delivery created', 'ReportDeliveriesService', {
      id: data.id,
      channel: dto.channel,
    });
    return data as ReportDelivery;
  }

  async send(id: string, tenantId: string): Promise<ReportDelivery> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Report delivery com id '${id}' não encontrada`,
      );
    if (existing.status !== 'pending')
      throw new BadRequestException(
        `Delivery não pode ser enviada no status '${existing.status}'`,
      );
    const now = new Date().toISOString();
    // TODO: Implementar integração com serviços de envio
    const { data, error } = await this.supabase
      .from('report_deliveries')
      .update({ status: 'sent', sent_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to send report delivery: ${error.message}`);
    this.logger.log('Report delivery sent', 'ReportDeliveriesService', { id });
    return data as ReportDelivery;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateReportDeliveryStatusDto,
  ): Promise<ReportDelivery> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Report delivery com id '${id}' não encontrada`,
      );
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'delivered' && !existing.delivered_at)
      updateData.delivered_at = now;
    if (dto.status === 'read' && !existing.read_at) updateData.read_at = now;
    if (dto.error_message) updateData.error_message = dto.error_message;
    const { data, error } = await this.supabase
      .from('report_deliveries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(
        `Failed to update report delivery status: ${error.message}`,
      );
    return data as ReportDelivery;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Report delivery com id '${id}' não encontrada`,
      );
    const { error } = await this.supabase
      .from('report_deliveries')
      .delete()
      .eq('id', id);
    if (error)
      throw new Error(`Failed to delete report delivery: ${error.message}`);
  }
}
