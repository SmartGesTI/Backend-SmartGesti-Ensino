import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { PreEnrollmentHousehold } from '../common/types';
import {
  CreatePreEnrollmentHouseholdDto,
  UpdatePreEnrollmentHouseholdDto,
} from './dto/create-pre-enrollment-household.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class PreEnrollmentHouseholdsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  private generateReferenceCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<PreEnrollmentHousehold[]> {
    let query = this.supabase
      .from('pre_enrollment_households')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment households: ${error.message}`,
        undefined,
        'PreEnrollmentHouseholdsService',
      );
      throw new Error(`Failed to list households: ${error.message}`);
    }

    return (data || []) as PreEnrollmentHousehold[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentHousehold | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_households')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get household: ${error.message}`);
    }

    return data as PreEnrollmentHousehold;
  }

  async findByReferenceCode(
    referenceCode: string,
    tenantId: string,
  ): Promise<PreEnrollmentHousehold | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_households')
      .select('*')
      .eq('reference_code', referenceCode)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get household: ${error.message}`);
    }

    return data as PreEnrollmentHousehold;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentHouseholdDto,
    userId?: string,
  ): Promise<PreEnrollmentHousehold> {
    const now = new Date().toISOString();
    const referenceCode = this.generateReferenceCode();

    const { data, error } = await this.supabase
      .from('pre_enrollment_households')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        site_id: dto.site_id ?? null,
        status: dto.status ?? 'draft',
        reference_code: referenceCode,
        primary_email: dto.primary_email ?? null,
        primary_phone: dto.primary_phone ?? null,
        household_payload: dto.household_payload ?? {},
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        last_activity_at: now,
        created_at: now,
        updated_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create household: ${error.message}`,
        undefined,
        'PreEnrollmentHouseholdsService',
      );
      throw new Error(`Failed to create household: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment household created',
      'PreEnrollmentHouseholdsService',
      {
        id: data.id,
        referenceCode,
      },
    );

    return data as PreEnrollmentHousehold;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdatePreEnrollmentHouseholdDto,
    userId?: string,
  ): Promise<PreEnrollmentHousehold> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Household com id '${id}' não encontrado`);
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_households')
      .update({
        ...dto,
        last_activity_at: now,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update household: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment household updated',
      'PreEnrollmentHouseholdsService',
      {
        id,
      },
    );

    return data as PreEnrollmentHousehold;
  }

  async submit(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<PreEnrollmentHousehold> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Household com id '${id}' não encontrado`);
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException(
        'Apenas households em rascunho podem ser submetidos',
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_households')
      .update({
        status: 'submitted',
        submitted_at: now,
        last_activity_at: now,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit household: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment household submitted',
      'PreEnrollmentHouseholdsService',
      {
        id,
      },
    );

    return data as PreEnrollmentHousehold;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Household com id '${id}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'pre_enrollment_households',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete household: ${result.error}`);
    }

    this.logger.log(
      'Pre-enrollment household deleted',
      'PreEnrollmentHouseholdsService',
      {
        id,
      },
    );
  }
}
