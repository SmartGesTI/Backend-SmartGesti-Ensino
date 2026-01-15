import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { PreEnrollmentConversion } from '../common/types';
import {
  CreatePreEnrollmentConversionDto,
  ConvertApplicationDto,
} from './dto/create-pre-enrollment-conversion.dto';

@Injectable()
export class PreEnrollmentConversionsService {
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
    },
  ): Promise<PreEnrollmentConversion[]> {
    let query = this.supabase
      .from('pre_enrollment_conversions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('converted_at', { ascending: false });

    if (options?.householdId) {
      query = query.eq('household_id', options.householdId);
    }

    if (options?.applicationId) {
      query = query.eq('application_id', options.applicationId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment conversions: ${error.message}`,
        undefined,
        'PreEnrollmentConversionsService',
      );
      throw new Error(`Failed to list conversions: ${error.message}`);
    }

    return (data || []) as PreEnrollmentConversion[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentConversion | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_conversions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get conversion: ${error.message}`);
    }

    return data as PreEnrollmentConversion;
  }

  async findByApplicationId(
    applicationId: string,
    tenantId: string,
  ): Promise<PreEnrollmentConversion | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_conversions')
      .select('*')
      .eq('application_id', applicationId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get conversion: ${error.message}`);
    }

    return data as PreEnrollmentConversion;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentConversionDto,
    userId?: string,
  ): Promise<PreEnrollmentConversion> {
    const now = new Date().toISOString();

    // Verificar se já existe conversão para esta aplicação
    const existing = await this.findByApplicationId(
      dto.application_id,
      tenantId,
    );
    if (existing) {
      throw new BadRequestException('Esta aplicação já foi convertida');
    }

    const { data, error } = await this.supabase
      .from('pre_enrollment_conversions')
      .insert({
        tenant_id: tenantId,
        household_id: dto.household_id,
        application_id: dto.application_id,
        converted_at: dto.converted_at ?? now,
        converted_by: userId ?? null,
        family_id: dto.family_id ?? null,
        student_id: dto.student_id ?? null,
        enrollment_id: dto.enrollment_id ?? null,
        created_entities: dto.created_entities ?? {},
        notes: dto.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create conversion: ${error.message}`,
        undefined,
        'PreEnrollmentConversionsService',
      );
      throw new Error(`Failed to create conversion: ${error.message}`);
    }

    // Atualizar status da aplicação para 'converted'
    await this.supabase
      .from('pre_enrollment_applications')
      .update({ status: 'converted', updated_at: now, updated_by: userId })
      .eq('id', dto.application_id);

    // Atualizar status do household para 'converted' se todas as aplicações foram convertidas
    const { data: pendingApps } = await this.supabase
      .from('pre_enrollment_applications')
      .select('id')
      .eq('household_id', dto.household_id)
      .neq('status', 'converted')
      .is('deleted_at', null);

    if (!pendingApps || pendingApps.length === 0) {
      await this.supabase
        .from('pre_enrollment_households')
        .update({ status: 'converted', updated_at: now, updated_by: userId })
        .eq('id', dto.household_id);
    }

    this.logger.log(
      'Pre-enrollment conversion created',
      'PreEnrollmentConversionsService',
      {
        id: data.id,
        applicationId: dto.application_id,
      },
    );

    return data as PreEnrollmentConversion;
  }

  async convert(
    applicationId: string,
    tenantId: string,
    dto: ConvertApplicationDto,
    userId?: string,
  ): Promise<PreEnrollmentConversion> {
    // Buscar a aplicação
    const { data: application, error: appError } = await this.supabase
      .from('pre_enrollment_applications')
      .select('*, pre_enrollment_households!inner(*)')
      .eq('id', applicationId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (appError || !application) {
      throw new NotFoundException(
        `Aplicação com id '${applicationId}' não encontrada`,
      );
    }

    if (application.status !== 'approved') {
      throw new BadRequestException(
        'Apenas aplicações aprovadas podem ser convertidas',
      );
    }

    // TODO: Implementar lógica de conversão real
    // - Criar família se não existir
    // - Criar pessoa/aluno
    // - Criar matrícula
    // Por enquanto, apenas registra a conversão

    const createdEntities: Record<string, unknown> = {};

    if (dto.options?.createFamily && !dto.family_id) {
      // Lógica para criar família seria implementada aqui
      createdEntities.family = {
        created: false,
        note: 'Implementação pendente',
      };
    }

    if (dto.options?.createStudent) {
      // Lógica para criar aluno seria implementada aqui
      createdEntities.student = {
        created: false,
        note: 'Implementação pendente',
      };
    }

    if (dto.options?.createEnrollment) {
      // Lógica para criar matrícula seria implementada aqui
      createdEntities.enrollment = {
        created: false,
        note: 'Implementação pendente',
      };
    }

    return this.create(
      tenantId,
      {
        household_id: application.household_id,
        application_id: applicationId,
        family_id: dto.family_id,
        created_entities: createdEntities,
        notes: dto.notes,
      },
      userId,
    );
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Conversion com id '${id}' não encontrada`);
    }

    const { error } = await this.supabase
      .from('pre_enrollment_conversions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete conversion: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment conversion deleted',
      'PreEnrollmentConversionsService',
      {
        id,
      },
    );
  }
}
