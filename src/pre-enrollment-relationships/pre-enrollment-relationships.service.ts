import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { PreEnrollmentRelationship } from '../common/types';
import {
  CreatePreEnrollmentRelationshipDto,
  UpdatePreEnrollmentRelationshipDto,
} from './dto/create-pre-enrollment-relationship.dto';

@Injectable()
export class PreEnrollmentRelationshipsService {
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
      applicationId?: string;
      studentPersonId?: string;
      guardianPersonId?: string;
    },
  ): Promise<PreEnrollmentRelationship[]> {
    let query = this.supabase
      .from('pre_enrollment_relationships')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (options?.applicationId) {
      query = query.eq('application_id', options.applicationId);
    }

    if (options?.studentPersonId) {
      query = query.eq('student_person_id', options.studentPersonId);
    }

    if (options?.guardianPersonId) {
      query = query.eq('guardian_person_id', options.guardianPersonId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment relationships: ${error.message}`,
        undefined,
        'PreEnrollmentRelationshipsService',
      );
      throw new Error(`Failed to list relationships: ${error.message}`);
    }

    return (data || []) as PreEnrollmentRelationship[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentRelationship | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_relationships')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get relationship: ${error.message}`);
    }

    return data as PreEnrollmentRelationship;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentRelationshipDto,
    userId?: string,
  ): Promise<PreEnrollmentRelationship> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_relationships')
      .insert({
        tenant_id: tenantId,
        application_id: dto.application_id,
        student_person_id: dto.student_person_id,
        guardian_person_id: dto.guardian_person_id,
        relationship_type: dto.relationship_type,
        is_financial_responsible: dto.is_financial_responsible ?? false,
        is_emergency_contact: dto.is_emergency_contact ?? false,
        lives_with: dto.lives_with ?? null,
        notes: dto.notes ?? null,
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Já existe um relacionamento entre estas pessoas nesta aplicação',
        );
      }
      this.logger.error(
        `Failed to create relationship: ${error.message}`,
        undefined,
        'PreEnrollmentRelationshipsService',
      );
      throw new Error(`Failed to create relationship: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment relationship created',
      'PreEnrollmentRelationshipsService',
      {
        id: data.id,
        type: dto.relationship_type,
      },
    );

    return data as PreEnrollmentRelationship;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdatePreEnrollmentRelationshipDto,
  ): Promise<PreEnrollmentRelationship> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Relationship com id '${id}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .from('pre_enrollment_relationships')
      .update({
        ...dto,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update relationship: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment relationship updated',
      'PreEnrollmentRelationshipsService',
      {
        id,
      },
    );

    return data as PreEnrollmentRelationship;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Relationship com id '${id}' não encontrado`);
    }

    const { error } = await this.supabase
      .from('pre_enrollment_relationships')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete relationship: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment relationship deleted',
      'PreEnrollmentRelationshipsService',
      {
        id,
      },
    );
  }
}
