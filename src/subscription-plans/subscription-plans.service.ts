import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreatePlanDto,
  UpdatePlanDto,
  CreatePriceDto,
  UpdatePriceDto,
  CreateEntitlementDto,
  UpdateEntitlementDto,
} from './dto/subscription-plans.dto';

@Injectable()
export class SubscriptionPlansService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== PLANS ====================

  async findPlans(tenantId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select(
        '*, subscription_plan_prices(*), subscription_plan_entitlements(*)',
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error(
        'Erro ao listar planos',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    return data || [];
  }

  async findPublicPlans(tenantId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select(
        '*, subscription_plan_prices(*), subscription_plan_entitlements(*)',
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_public', true)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error(
        'Erro ao listar planos públicos',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    return data || [];
  }

  async findPlan(id: string, tenantId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select(
        '*, subscription_plan_prices(*), subscription_plan_entitlements(*)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      this.logger.error(
        'Erro ao buscar plano',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    return data;
  }

  async createPlan(
    dto: CreatePlanDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .insert({
        ...dto,
        tenant_id: tenantId,
        is_active: dto.is_active ?? true,
        is_public: dto.is_public ?? false,
        sort_order: dto.sort_order ?? 0,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao criar plano',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(`Plano criado: ${data.id}`, 'SubscriptionPlansService');
    return data;
  }

  async updatePlan(
    id: string,
    dto: UpdatePlanDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .update({
        ...dto,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao atualizar plano',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(`Plano atualizado: ${id}`, 'SubscriptionPlansService');
    return data;
  }

  async removePlan(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('subscription_plans')
      .update({
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        'Erro ao desativar plano',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(`Plano desativado: ${id}`, 'SubscriptionPlansService');
  }

  // ==================== PRICES ====================

  async findPrices(planId: string, tenantId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('subscription_plan_prices')
      .select('*, payment_providers(name, slug)')
      .eq('subscription_plan_id', planId)
      .eq('tenant_id', tenantId)
      .order('amount_cents', { ascending: true });

    if (error) {
      this.logger.error(
        'Erro ao listar preços',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    return data || [];
  }

  async createPrice(
    planId: string,
    dto: CreatePriceDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('subscription_plan_prices')
      .insert({
        ...dto,
        subscription_plan_id: planId,
        tenant_id: tenantId,
        is_active: dto.is_active ?? true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao criar preço',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(
      `Preço criado: ${data.id} para plano ${planId}`,
      'SubscriptionPlansService',
    );
    return data;
  }

  async updatePrice(
    priceId: string,
    dto: UpdatePriceDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('subscription_plan_prices')
      .update({
        ...dto,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', priceId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao atualizar preço',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(`Preço atualizado: ${priceId}`, 'SubscriptionPlansService');
    return data;
  }

  async removePrice(
    priceId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('subscription_plan_prices')
      .update({
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', priceId)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        'Erro ao desativar preço',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(`Preço desativado: ${priceId}`, 'SubscriptionPlansService');
  }

  // ==================== ENTITLEMENTS ====================

  async findEntitlements(planId: string, tenantId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('subscription_plan_entitlements')
      .select('*')
      .eq('subscription_plan_id', planId)
      .eq('tenant_id', tenantId)
      .order('entitlement_key', { ascending: true });

    if (error) {
      this.logger.error(
        'Erro ao listar entitlements',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    return data || [];
  }

  async createEntitlement(
    planId: string,
    dto: CreateEntitlementDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('subscription_plan_entitlements')
      .insert({
        ...dto,
        subscription_plan_id: planId,
        tenant_id: tenantId,
        enabled: dto.enabled ?? true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao criar entitlement',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(
      `Entitlement criado: ${data.id} para plano ${planId}`,
      'SubscriptionPlansService',
    );
    return data;
  }

  async updateEntitlement(
    entitlementId: string,
    dto: UpdateEntitlementDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('subscription_plan_entitlements')
      .update({
        ...dto,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entitlementId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao atualizar entitlement',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(
      `Entitlement atualizado: ${entitlementId}`,
      'SubscriptionPlansService',
    );
    return data;
  }

  async removeEntitlement(
    entitlementId: string,
    tenantId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('subscription_plan_entitlements')
      .delete()
      .eq('id', entitlementId)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        'Erro ao remover entitlement',
        error.message,
        'SubscriptionPlansService',
      );
      throw error;
    }

    this.logger.log(
      `Entitlement removido: ${entitlementId}`,
      'SubscriptionPlansService',
    );
  }
}
