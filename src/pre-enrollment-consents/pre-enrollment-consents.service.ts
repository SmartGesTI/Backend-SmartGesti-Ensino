import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { PreEnrollmentConsent } from '../common/types';
import { CreatePreEnrollmentConsentDto } from './dto/create-pre-enrollment-consent.dto';

@Injectable()
export class PreEnrollmentConsentsService {
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
      schoolId?: string;
      householdId?: string;
      applicationId?: string;
      consentType?: string;
    },
  ): Promise<PreEnrollmentConsent[]> {
    let query = this.supabase
      .from('pre_enrollment_consents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('consented_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.householdId) {
      query = query.eq('household_id', options.householdId);
    }

    if (options?.applicationId) {
      query = query.eq('application_id', options.applicationId);
    }

    if (options?.consentType) {
      query = query.eq('consent_type', options.consentType);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment consents: ${error.message}`,
        undefined,
        'PreEnrollmentConsentsService',
      );
      throw new Error(`Failed to list consents: ${error.message}`);
    }

    return (data || []) as PreEnrollmentConsent[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentConsent | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_consents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get consent: ${error.message}`);
    }

    return data as PreEnrollmentConsent;
  }

  async verify(
    tenantId: string,
    householdId: string,
    consentType: string,
  ): Promise<{ verified: boolean; consent?: PreEnrollmentConsent }> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_consents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('household_id', householdId)
      .eq('consent_type', consentType)
      .eq('consented', true)
      .order('consented_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { verified: false };
      }
      throw new Error(`Failed to verify consent: ${error.message}`);
    }

    return { verified: true, consent: data as PreEnrollmentConsent };
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentConsentDto,
  ): Promise<PreEnrollmentConsent> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_consents')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        household_id: dto.household_id,
        application_id: dto.application_id ?? null,
        guardian_person_id: dto.guardian_person_id ?? null,
        consent_type: dto.consent_type,
        consented: dto.consented,
        consented_at: dto.consented_at ?? now,
        ip: dto.ip ?? null,
        user_agent: dto.user_agent ?? null,
        evidence: dto.evidence ?? {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Já existe um consentimento deste tipo para este household',
        );
      }
      this.logger.error(
        `Failed to create consent: ${error.message}`,
        undefined,
        'PreEnrollmentConsentsService',
      );
      throw new Error(`Failed to create consent: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment consent created',
      'PreEnrollmentConsentsService',
      {
        id: data.id,
        type: dto.consent_type,
      },
    );

    return data as PreEnrollmentConsent;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Consent com id '${id}' não encontrado`);
    }

    const { error } = await this.supabase
      .from('pre_enrollment_consents')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete consent: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment consent deleted',
      'PreEnrollmentConsentsService',
      {
        id,
      },
    );
  }
}
