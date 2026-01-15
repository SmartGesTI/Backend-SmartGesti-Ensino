import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateFeatureDto,
  UpdateFeatureDto,
} from './dto/billing-config.dto';
import {
  PaymentProvider,
  FeatureDefinition,
} from '../common/types/billing.types';

@Injectable()
export class BillingConfigService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== PROVIDERS ====================

  async findProviders(tenantId: string): Promise<PaymentProvider[]> {
    const result = await this.supabase
      .from('payment_providers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (result.error) {
      this.logger.error(
        'Erro ao listar provedores',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    return (result.data || []) as PaymentProvider[];
  }

  async findAllProviders(tenantId: string): Promise<PaymentProvider[]> {
    const result = await this.supabase
      .from('payment_providers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (result.error) {
      this.logger.error(
        'Erro ao listar todos os provedores',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    return (result.data || []) as PaymentProvider[];
  }

  async findProvider(
    id: string,
    tenantId: string,
  ): Promise<PaymentProvider | null> {
    const result = await this.supabase
      .from('payment_providers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao buscar provedor',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    return result.data as PaymentProvider | null;
  }

  async createProvider(
    dto: CreateProviderDto,
    tenantId: string,
    userId: string,
  ): Promise<PaymentProvider> {
    const result = await this.supabase
      .from('payment_providers')
      .insert({
        ...dto,
        tenant_id: tenantId,
        is_active: dto.is_active ?? true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao criar provedor',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    const provider = result.data as PaymentProvider;
    this.logger.log(`Provedor criado: ${provider.id}`, 'BillingConfigService');
    return provider;
  }

  async updateProvider(
    id: string,
    dto: UpdateProviderDto,
    tenantId: string,
    userId: string,
  ): Promise<PaymentProvider> {
    const result = await this.supabase
      .from('payment_providers')
      .update({
        ...dto,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao atualizar provedor',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    this.logger.log(`Provedor atualizado: ${id}`, 'BillingConfigService');
    return result.data as PaymentProvider;
  }

  async removeProvider(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('payment_providers')
      .update({
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        'Erro ao desativar provedor',
        error.message,
        'BillingConfigService',
      );
      throw error;
    }

    this.logger.log(`Provedor desativado: ${id}`, 'BillingConfigService');
  }

  // ==================== FEATURES ====================

  async findFeatures(tenantId: string): Promise<FeatureDefinition[]> {
    const result = await this.supabase
      .from('feature_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (result.error) {
      this.logger.error(
        'Erro ao listar features',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    return (result.data || []) as FeatureDefinition[];
  }

  async findAllFeatures(tenantId: string): Promise<FeatureDefinition[]> {
    const result = await this.supabase
      .from('feature_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (result.error) {
      this.logger.error(
        'Erro ao listar todas as features',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    return (result.data || []) as FeatureDefinition[];
  }

  async findFeature(
    id: string,
    tenantId: string,
  ): Promise<FeatureDefinition | null> {
    const result = await this.supabase
      .from('feature_definitions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao buscar feature',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    return result.data as FeatureDefinition | null;
  }

  async createFeature(
    dto: CreateFeatureDto,
    tenantId: string,
    userId: string,
  ): Promise<FeatureDefinition> {
    const result = await this.supabase
      .from('feature_definitions')
      .insert({
        ...dto,
        tenant_id: tenantId,
        is_active: dto.is_active ?? true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao criar feature',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    const feature = result.data as FeatureDefinition;
    this.logger.log(`Feature criada: ${feature.id}`, 'BillingConfigService');
    return feature;
  }

  async updateFeature(
    id: string,
    dto: UpdateFeatureDto,
    tenantId: string,
    userId: string,
  ): Promise<FeatureDefinition> {
    const result = await this.supabase
      .from('feature_definitions')
      .update({
        ...dto,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao atualizar feature',
        result.error.message,
        'BillingConfigService',
      );
      throw result.error;
    }

    this.logger.log(`Feature atualizada: ${id}`, 'BillingConfigService');
    return result.data as FeatureDefinition;
  }

  async removeFeature(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('feature_definitions')
      .update({
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        'Erro ao desativar feature',
        error.message,
        'BillingConfigService',
      );
      throw error;
    }

    this.logger.log(`Feature desativada: ${id}`, 'BillingConfigService');
  }
}
