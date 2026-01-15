import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { PreEnrollmentPerson } from '../common/types';
import {
  CreatePreEnrollmentPersonDto,
  UpdatePreEnrollmentPersonDto,
} from './dto/create-pre-enrollment-person.dto';

@Injectable()
export class PreEnrollmentPeopleService {
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
      householdId?: string;
      applicationId?: string;
      role?: string;
    },
  ): Promise<PreEnrollmentPerson[]> {
    let query = this.supabase
      .from('pre_enrollment_people')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('sort_index', { ascending: true });

    if (options?.householdId) {
      query = query.eq('household_id', options.householdId);
    }

    if (options?.applicationId) {
      query = query.eq('application_id', options.applicationId);
    }

    if (options?.role) {
      query = query.eq('role', options.role);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment people: ${error.message}`,
        undefined,
        'PreEnrollmentPeopleService',
      );
      throw new Error(`Failed to list people: ${error.message}`);
    }

    return (data || []) as PreEnrollmentPerson[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentPerson | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_people')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get person: ${error.message}`);
    }

    return data as PreEnrollmentPerson;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentPersonDto,
    userId?: string,
  ): Promise<PreEnrollmentPerson> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_people')
      .insert({
        tenant_id: tenantId,
        household_id: dto.household_id,
        application_id: dto.application_id ?? null,
        role: dto.role,
        sort_index: dto.sort_index ?? 0,
        is_primary: dto.is_primary ?? false,
        full_name: dto.full_name,
        preferred_name: dto.preferred_name ?? null,
        birth_date: dto.birth_date ?? null,
        sex: dto.sex ?? null,
        documents: dto.documents ?? {},
        contacts: dto.contacts ?? {},
        addresses: dto.addresses ?? [],
        notes: dto.notes ?? null,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        created_at: now,
        updated_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create person: ${error.message}`,
        undefined,
        'PreEnrollmentPeopleService',
      );
      throw new Error(`Failed to create person: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment person created',
      'PreEnrollmentPeopleService',
      {
        id: data.id,
        role: dto.role,
      },
    );

    return data as PreEnrollmentPerson;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdatePreEnrollmentPersonDto,
    userId?: string,
  ): Promise<PreEnrollmentPerson> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Person com id '${id}' não encontrada`);
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_people')
      .update({
        ...dto,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update person: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment person updated',
      'PreEnrollmentPeopleService',
      {
        id,
      },
    );

    return data as PreEnrollmentPerson;
  }

  async setPrimary(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<PreEnrollmentPerson> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Person com id '${id}' não encontrada`);
    }

    // Remover primary de outras pessoas do mesmo household e role
    await this.supabase
      .from('pre_enrollment_people')
      .update({ is_primary: false })
      .eq('household_id', existing.household_id)
      .eq('role', existing.role)
      .neq('id', id);

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_people')
      .update({
        is_primary: true,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set primary: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment person set as primary',
      'PreEnrollmentPeopleService',
      {
        id,
      },
    );

    return data as PreEnrollmentPerson;
  }

  async match(
    id: string,
    tenantId: string,
    matchedPersonId: string,
    userId?: string,
  ): Promise<PreEnrollmentPerson> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Person com id '${id}' não encontrada`);
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_people')
      .update({
        matched_person_id: matchedPersonId,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to match person: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment person matched',
      'PreEnrollmentPeopleService',
      {
        id,
        matchedPersonId,
      },
    );

    return data as PreEnrollmentPerson;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Person com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'pre_enrollment_people',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete person: ${result.error}`);
    }

    this.logger.log(
      'Pre-enrollment person deleted',
      'PreEnrollmentPeopleService',
      {
        id,
      },
    );
  }
}
