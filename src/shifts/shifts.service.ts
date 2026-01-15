import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { Shift } from '../common/types';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@Injectable()
export class ShiftsService {
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
    activeOnly: boolean = false,
  ): Promise<Shift[]> {
    let query = this.supabase
      .from('shifts')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list shifts: ${error.message}`,
        undefined,
        'ShiftsService',
      );
      throw new Error(`Failed to list shifts: ${error.message}`);
    }

    return (data || []) as Shift[];
  }

  async findOne(id: string, tenantId: string): Promise<Shift | null> {
    const { data, error } = await this.supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get shift: ${error.message}`);
    }

    return data as Shift;
  }

  async create(
    tenantId: string,
    dto: CreateShiftDto,
    userId?: string,
  ): Promise<Shift> {
    const { data, error } = await this.supabase
      .from('shifts')
      .insert({
        tenant_id: tenantId,
        ...dto,
        is_active: dto.is_active ?? true,
        ai_context: dto.ai_context ?? {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Já existe um turno com o slug '${dto.slug}' nesta organização`,
        );
      }
      this.logger.error(
        `Failed to create shift: ${error.message}`,
        undefined,
        'ShiftsService',
      );
      throw new Error(`Failed to create shift: ${error.message}`);
    }

    this.logger.log('Shift created', 'ShiftsService', {
      id: data.id,
      name: dto.name,
    });

    return data as Shift;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateShiftDto,
    userId?: string,
  ): Promise<Shift> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Turno com id '${id}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .from('shifts')
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
          'Já existe um turno com este slug nesta organização',
        );
      }
      throw new Error(`Failed to update shift: ${error.message}`);
    }

    return data as Shift;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Turno com id '${id}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'shifts',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete shift: ${result.error}`);
    }

    this.logger.log('Shift deleted', 'ShiftsService', { id });
  }
}
