import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { TimeSlot } from '../common/types';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { UpdateTimeSlotDto } from './dto/update-time-slot.dto';

@Injectable()
export class TimeSlotsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      shiftId?: string;
      activeOnly?: boolean;
    },
  ): Promise<TimeSlot[]> {
    let query = this.supabase
      .from('time_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('slot_index', { ascending: true });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.shiftId) {
      query = query.eq('shift_id', options.shiftId);
    }

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list time slots: ${error.message}`,
        undefined,
        'TimeSlotsService',
      );
      throw new Error(`Failed to list time slots: ${error.message}`);
    }

    return (data || []) as TimeSlot[];
  }

  async findOne(id: string, tenantId: string): Promise<TimeSlot | null> {
    const { data, error } = await this.supabase
      .from('time_slots')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get time slot: ${error.message}`);
    }

    return data as TimeSlot;
  }

  async create(
    tenantId: string,
    dto: CreateTimeSlotDto,
    userId?: string,
  ): Promise<TimeSlot> {
    const { data, error } = await this.supabase
      .from('time_slots')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        shift_id: dto.shift_id,
        label: dto.label ?? null,
        slot_index: dto.slot_index,
        start_time: dto.start_time,
        end_time: dto.end_time,
        is_active: dto.is_active ?? true,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Já existe um slot com índice ${dto.slot_index} para este turno`,
        );
      }
      this.logger.error(
        `Failed to create time slot: ${error.message}`,
        undefined,
        'TimeSlotsService',
      );
      throw new Error(`Failed to create time slot: ${error.message}`);
    }

    this.logger.log('Time slot created', 'TimeSlotsService', {
      id: data.id,
      slotIndex: dto.slot_index,
    });

    return data as TimeSlot;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateTimeSlotDto,
    userId?: string,
  ): Promise<TimeSlot> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Time slot com id '${id}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .from('time_slots')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Já existe um slot com este índice para este turno',
        );
      }
      throw new Error(`Failed to update time slot: ${error.message}`);
    }

    this.logger.log('Time slot updated', 'TimeSlotsService', { id });

    return data as TimeSlot;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Time slot com id '${id}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'time_slots',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete time slot: ${result.error}`);
    }

    this.logger.log('Time slot deleted', 'TimeSlotsService', { id });
  }
}
