import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { Consent } from '../common/types';
import { CreateConsentDto, RevokeConsentDto } from './dto/create-consent.dto';

@Injectable()
export class ConsentsService {
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
      guardianId?: string;
      studentId?: string;
      consentType?: string;
      status?: string;
    },
  ): Promise<Consent[]> {
    let query = this.supabase
      .from('consents')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('given_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.guardianId) {
      query = query.eq('guardian_id', options.guardianId);
    }

    if (options?.studentId) {
      query = query.eq('student_id', options.studentId);
    }

    if (options?.consentType) {
      query = query.eq('consent_type', options.consentType);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list consents: ${error.message}`,
        undefined,
        'ConsentsService',
      );
      throw new Error(`Failed to list consents: ${error.message}`);
    }

    return (data || []) as Consent[];
  }

  async findOne(id: string, tenantId: string): Promise<Consent | null> {
    const { data, error } = await this.supabase
      .from('consents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get consent: ${error.message}`);
    }

    return data as Consent;
  }

  async create(
    tenantId: string,
    dto: CreateConsentDto,
    userId?: string,
  ): Promise<Consent> {
    // Validar que pelo menos guardian_id ou student_id está preenchido
    if (!dto.guardian_id && !dto.student_id) {
      throw new BadRequestException(
        'É necessário informar guardian_id ou student_id',
      );
    }

    // Verificar se já existe consentimento ativo do mesmo tipo
    const existingQuery = this.supabase
      .from('consents')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('consent_type', dto.consent_type)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (dto.guardian_id) {
      existingQuery.eq('guardian_id', dto.guardian_id);
    }

    if (dto.student_id) {
      existingQuery.eq('student_id', dto.student_id);
    }

    if (dto.school_id) {
      existingQuery.eq('school_id', dto.school_id);
    } else {
      existingQuery.is('school_id', null);
    }

    const { data: existingConsent } = await existingQuery.single();

    if (existingConsent) {
      throw new ConflictException(
        'Já existe um consentimento ativo deste tipo para este contexto',
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('consents')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        guardian_id: dto.guardian_id ?? null,
        student_id: dto.student_id ?? null,
        consent_type: dto.consent_type,
        scope: dto.scope ?? {},
        given_at: dto.given_at ?? now,
        status: 'active',
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create consent: ${error.message}`,
        undefined,
        'ConsentsService',
      );
      throw new Error(`Failed to create consent: ${error.message}`);
    }

    this.logger.log('Consent created', 'ConsentsService', {
      id: data.id,
      type: dto.consent_type,
    });

    return data as Consent;
  }

  async revoke(
    id: string,
    tenantId: string,
    dto: RevokeConsentDto,
    userId: string,
  ): Promise<Consent> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Consentimento com id '${id}' não encontrado`,
      );
    }

    if (existing.status === 'revoked') {
      throw new BadRequestException('Este consentimento já foi revogado');
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('consents')
      .update({
        status: 'revoked',
        revoked_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to revoke consent: ${error.message}`);
    }

    this.logger.log('Consent revoked', 'ConsentsService', { id });

    return data as Consent;
  }

  async verify(
    tenantId: string,
    options: {
      studentId?: string;
      guardianId?: string;
      consentType: string;
      schoolId?: string;
    },
  ): Promise<{ valid: boolean; consent?: Consent }> {
    if (!options.studentId && !options.guardianId) {
      throw new BadRequestException(
        'É necessário informar studentId ou guardianId',
      );
    }

    let query = this.supabase
      .from('consents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('consent_type', options.consentType)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (options.studentId) {
      query = query.eq('student_id', options.studentId);
    }

    if (options.guardianId) {
      query = query.eq('guardian_id', options.guardianId);
    }

    if (options.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { valid: false };
      }
      throw new Error(`Failed to verify consent: ${error.message}`);
    }

    return {
      valid: true,
      consent: data as Consent,
    };
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Consentimento com id '${id}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'consents',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete consent: ${result.error}`);
    }

    this.logger.log('Consent deleted', 'ConsentsService', { id });
  }
}
