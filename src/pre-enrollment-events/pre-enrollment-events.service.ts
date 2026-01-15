import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { PreEnrollmentEvent } from '../common/types';
import { CreatePreEnrollmentEventDto } from './dto/create-pre-enrollment-event.dto';

@Injectable()
export class PreEnrollmentEventsService {
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
      householdId?: string;
      applicationId?: string;
      eventType?: string;
      actorType?: string;
      limit?: number;
    },
  ): Promise<PreEnrollmentEvent[]> {
    let query = this.supabase
      .from('pre_enrollment_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: false });

    if (options?.householdId) {
      query = query.eq('household_id', options.householdId);
    }

    if (options?.applicationId) {
      query = query.eq('application_id', options.applicationId);
    }

    if (options?.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    if (options?.actorType) {
      query = query.eq('actor_type', options.actorType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment events: ${error.message}`,
        undefined,
        'PreEnrollmentEventsService',
      );
      throw new Error(`Failed to list events: ${error.message}`);
    }

    return (data || []) as PreEnrollmentEvent[];
  }

  async getTimeline(
    tenantId: string,
    householdId: string,
    options?: {
      applicationId?: string;
      limit?: number;
    },
  ): Promise<PreEnrollmentEvent[]> {
    return this.findAll(tenantId, {
      householdId,
      applicationId: options?.applicationId,
      limit: options?.limit ?? 100,
    });
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentEvent | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_events')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get event: ${error.message}`);
    }

    return data as PreEnrollmentEvent;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentEventDto,
    userId?: string,
  ): Promise<PreEnrollmentEvent> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_events')
      .insert({
        tenant_id: tenantId,
        household_id: dto.household_id,
        application_id: dto.application_id ?? null,
        event_type: dto.event_type,
        occurred_at: dto.occurred_at ?? now,
        actor_type: dto.actor_type,
        actor_id: dto.actor_id ?? userId ?? null,
        metadata: dto.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create event: ${error.message}`,
        undefined,
        'PreEnrollmentEventsService',
      );
      throw new Error(`Failed to create event: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment event created',
      'PreEnrollmentEventsService',
      {
        id: data.id,
        type: dto.event_type,
      },
    );

    return data as PreEnrollmentEvent;
  }

  async logEvent(
    tenantId: string,
    householdId: string,
    eventType: string,
    actorType: 'public' | 'user' | 'ai' | 'system',
    options?: {
      applicationId?: string;
      actorId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PreEnrollmentEvent> {
    return this.create(tenantId, {
      household_id: householdId,
      application_id: options?.applicationId,
      event_type: eventType as any,
      actor_type: actorType,
      actor_id: options?.actorId,
      metadata: options?.metadata,
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Event com id '${id}' não encontrado`);
    }

    const { error } = await this.supabase
      .from('pre_enrollment_events')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete event: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment event deleted',
      'PreEnrollmentEventsService',
      {
        id,
      },
    );
  }
}
