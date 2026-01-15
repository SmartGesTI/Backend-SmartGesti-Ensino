import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { InsightEvent } from '../common/types';
import { CreateInsightEventDto } from './dto/create-insight-event.dto';

@Injectable()
export class InsightEventsService {
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
      eventType?: string;
      limit?: number;
    },
  ): Promise<InsightEvent[]> {
    let query = this.supabase
      .from('insight_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: false });
    if (options?.insightInstanceId)
      query = query.eq('insight_instance_id', options.insightInstanceId);
    if (options?.eventType) query = query.eq('event_type', options.eventType);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list insight events: ${error.message}`);
    return (data || []) as InsightEvent[];
  }

  async getTimeline(
    tenantId: string,
    insightInstanceId: string,
    limit?: number,
  ): Promise<InsightEvent[]> {
    return this.findAll(tenantId, { insightInstanceId, limit: limit ?? 100 });
  }

  async findOne(id: string, tenantId: string): Promise<InsightEvent | null> {
    const { data, error } = await this.supabase
      .from('insight_events')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get insight event: ${error.message}`);
    }
    return data as InsightEvent;
  }

  async create(
    tenantId: string,
    dto: CreateInsightEventDto,
    userId?: string,
  ): Promise<InsightEvent> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_events')
      .insert({
        tenant_id: tenantId,
        insight_instance_id: dto.insight_instance_id,
        event_type: dto.event_type,
        occurred_at: dto.occurred_at ?? now,
        actor_type: dto.actor_type,
        actor_id: dto.actor_id ?? userId ?? null,
        old_status: dto.old_status ?? null,
        new_status: dto.new_status ?? null,
        comment: dto.comment ?? null,
        metadata: dto.metadata ?? {},
        created_at: now,
      })
      .select()
      .single();
    if (error)
      throw new Error(`Failed to create insight event: ${error.message}`);
    this.logger.log('Insight event created', 'InsightEventsService', {
      id: data.id,
      eventType: dto.event_type,
    });
    return data as InsightEvent;
  }
}
