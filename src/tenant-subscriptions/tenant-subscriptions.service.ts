import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreateSubscriptionDto,
  ChangePlanDto,
  CancelSubscriptionDto,
  CreateOverrideDto,
  UpdateOverrideDto,
} from './dto/tenant-subscriptions.dto';

@Injectable()
export class TenantSubscriptionsService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== SUBSCRIPTION ====================

  async getSubscription(tenantId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('tenant_subscriptions')
      .select(
        `
        *,
        subscription_plans(name, slug, tier),
        subscription_plan_prices(currency, interval, amount_cents),
        billing_payment_methods(method_type, card_brand, card_last4)
      `,
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error(
        'Erro ao buscar subscription',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    return data;
  }

  async createSubscription(
    dto: CreateSubscriptionDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('tenant_subscriptions')
      .insert({
        tenant_id: tenantId,
        subscription_plan_id: dto.plan_id,
        subscription_plan_price_id: dto.plan_price_id,
        collection_method: dto.collection_method ?? 'charge_automatically',
        default_payment_method_id: dto.payment_method_id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: this.calculatePeriodEnd(new Date()),
        created_by: userId,
        updated_by: userId,
        ...(dto.metadata && { metadata: dto.metadata }),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao criar subscription',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Subscription criada: ${data.id}`,
      'TenantSubscriptionsService',
    );
    return data;
  }

  async changePlan(
    dto: ChangePlanDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('tenant_subscriptions')
      .update({
        subscription_plan_id: dto.new_plan_id,
        subscription_plan_price_id: dto.new_price_id,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao alterar plano',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Plano alterado para subscription: ${data.id}`,
      'TenantSubscriptionsService',
    );
    return data;
  }

  async cancelSubscription(
    dto: CancelSubscriptionDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const newStatus = dto.immediate ? 'canceled' : 'pending_cancellation';
    const cancelAt = dto.immediate ? new Date().toISOString() : null;

    const { data, error } = await this.supabase
      .from('tenant_subscriptions')
      .update({
        status: newStatus,
        canceled_at: cancelAt,
        cancellation_reason: dto.reason,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'trialing'])
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao cancelar subscription',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Subscription cancelada: ${data.id}`,
      'TenantSubscriptionsService',
    );
    return data;
  }

  async pauseSubscription(tenantId: string, userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('tenant_subscriptions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao pausar subscription',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Subscription pausada: ${data.id}`,
      'TenantSubscriptionsService',
    );
    return data;
  }

  async resumeSubscription(tenantId: string, userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('tenant_subscriptions')
      .update({
        status: 'active',
        paused_at: null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'paused')
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao retomar subscription',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Subscription retomada: ${data.id}`,
      'TenantSubscriptionsService',
    );
    return data;
  }

  // ==================== ENTITLEMENTS ====================

  async getEffectiveEntitlements(tenantId: string): Promise<any[]> {
    // Get subscription with plan entitlements
    const subscription = await this.getSubscription(tenantId);
    if (!subscription) return [];

    const { data: planEntitlements, error: peError } = await this.supabase
      .from('subscription_plan_entitlements')
      .select('*')
      .eq('subscription_plan_id', subscription.subscription_plan_id);

    if (peError) {
      this.logger.error(
        'Erro ao buscar entitlements do plano',
        peError.message,
        'TenantSubscriptionsService',
      );
      throw peError;
    }

    // Get overrides
    const { data: overrides, error: oError } = await this.supabase
      .from('tenant_subscription_entitlement_overrides')
      .select('*')
      .eq('tenant_subscription_id', subscription.id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (oError) {
      this.logger.error(
        'Erro ao buscar overrides',
        oError.message,
        'TenantSubscriptionsService',
      );
      throw oError;
    }

    // Merge: overrides take precedence
    const overrideMap = new Map(
      (overrides || []).map((o) => [o.entitlement_key, o]),
    );
    const effectiveEntitlements = (planEntitlements || []).map((pe) => {
      const override = overrideMap.get(pe.entitlement_key);
      return override ? { ...pe, ...override, is_override: true } : pe;
    });

    return effectiveEntitlements;
  }

  async checkEntitlement(
    tenantId: string,
    key: string,
  ): Promise<{ allowed: boolean; limit?: number; usage?: number }> {
    const entitlements = await this.getEffectiveEntitlements(tenantId);
    const entitlement = entitlements.find((e) => e.entitlement_key === key);

    if (!entitlement) {
      return { allowed: false };
    }

    if (entitlement.entitlement_type === 'boolean') {
      return { allowed: entitlement.enabled ?? false };
    }

    if (entitlement.entitlement_type === 'limit') {
      return {
        allowed: true,
        limit: entitlement.limit_value,
      };
    }

    return { allowed: entitlement.enabled ?? true };
  }

  // ==================== OVERRIDES ====================

  async getOverrides(subscriptionId: string, tenantId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('tenant_subscription_entitlement_overrides')
      .select('*')
      .eq('tenant_subscription_id', subscriptionId)
      .eq('tenant_id', tenantId)
      .order('entitlement_key', { ascending: true });

    if (error) {
      this.logger.error(
        'Erro ao listar overrides',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    return data || [];
  }

  async addOverride(
    subscriptionId: string,
    dto: CreateOverrideDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('tenant_subscription_entitlement_overrides')
      .insert({
        ...dto,
        tenant_subscription_id: subscriptionId,
        tenant_id: tenantId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao adicionar override',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Override adicionado: ${data.id}`,
      'TenantSubscriptionsService',
    );
    return data;
  }

  async updateOverride(
    overrideId: string,
    dto: UpdateOverrideDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('tenant_subscription_entitlement_overrides')
      .update({
        ...dto,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', overrideId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao atualizar override',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Override atualizado: ${overrideId}`,
      'TenantSubscriptionsService',
    );
    return data;
  }

  async removeOverride(overrideId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('tenant_subscription_entitlement_overrides')
      .delete()
      .eq('id', overrideId)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        'Erro ao remover override',
        error.message,
        'TenantSubscriptionsService',
      );
      throw error;
    }

    this.logger.log(
      `Override removido: ${overrideId}`,
      'TenantSubscriptionsService',
    );
  }

  // ==================== HELPERS ====================

  private calculatePeriodEnd(startDate: Date): string {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    return endDate.toISOString();
  }
}
