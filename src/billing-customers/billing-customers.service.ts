import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  UpdateProfileDto,
  CreatePaymentMethodDto,
} from './dto/billing-customers.dto';
import {
  BillingCustomer,
  BillingCustomerWithProvider,
  TenantBillingProfile,
  BillingPaymentMethod,
  BillingPaymentMethodWithProvider,
} from '../common/types/billing.types';

@Injectable()
export class BillingCustomersService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== CUSTOMER ====================

  async getCustomer(
    tenantId: string,
  ): Promise<BillingCustomerWithProvider | null> {
    const result = await this.supabase
      .from('billing_customers')
      .select('*, payment_providers(name, slug)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (result.error) {
      this.logger.error(
        'Erro ao buscar customer',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    return (result.data as BillingCustomerWithProvider | null) ?? null;
  }

  async createCustomer(
    dto: CreateCustomerDto,
    tenantId: string,
    userId: string,
  ): Promise<BillingCustomer> {
    const result = await this.supabase
      .from('billing_customers')
      .insert({
        ...dto,
        tenant_id: tenantId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao criar customer',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    const customer = result.data as BillingCustomer;
    this.logger.log(
      `Customer criado: ${customer.id}`,
      'BillingCustomersService',
    );
    return customer;
  }

  async updateCustomer(
    dto: UpdateCustomerDto,
    tenantId: string,
    userId: string,
  ): Promise<BillingCustomer> {
    const result = await this.supabase
      .from('billing_customers')
      .update({
        ...dto,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao atualizar customer',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    const customer = result.data as BillingCustomer;
    this.logger.log(
      `Customer atualizado: ${customer.id}`,
      'BillingCustomersService',
    );
    return customer;
  }

  // ==================== BILLING PROFILE ====================

  async getProfile(tenantId: string): Promise<TenantBillingProfile | null> {
    const result = await this.supabase
      .from('tenant_billing_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (result.error) {
      this.logger.error(
        'Erro ao buscar perfil de cobrança',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    return (result.data as TenantBillingProfile | null) ?? null;
  }

  async updateProfile(
    dto: UpdateProfileDto,
    tenantId: string,
    userId: string,
  ): Promise<TenantBillingProfile> {
    // Check if profile exists
    const existing = await this.getProfile(tenantId);

    if (existing) {
      const result = await this.supabase
        .from('tenant_billing_profiles')
        .update({
          ...dto,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (result.error) {
        this.logger.error(
          'Erro ao atualizar perfil',
          result.error.message,
          'BillingCustomersService',
        );
        throw result.error;
      }

      const profile = result.data as TenantBillingProfile;
      this.logger.log(
        `Perfil atualizado: ${profile.id}`,
        'BillingCustomersService',
      );
      return profile;
    } else {
      const result = await this.supabase
        .from('tenant_billing_profiles')
        .insert({
          ...dto,
          tenant_id: tenantId,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (result.error) {
        this.logger.error(
          'Erro ao criar perfil',
          result.error.message,
          'BillingCustomersService',
        );
        throw result.error;
      }

      const profile = result.data as TenantBillingProfile;
      this.logger.log(
        `Perfil criado: ${profile.id}`,
        'BillingCustomersService',
      );
      return profile;
    }
  }

  // ==================== PAYMENT METHODS ====================

  async getPaymentMethods(
    tenantId: string,
  ): Promise<BillingPaymentMethodWithProvider[]> {
    const result = await this.supabase
      .from('billing_payment_methods')
      .select('*, payment_providers(name, slug)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (result.error) {
      this.logger.error(
        'Erro ao listar métodos de pagamento',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    return (result.data as BillingPaymentMethodWithProvider[]) || [];
  }

  async addPaymentMethod(
    dto: CreatePaymentMethodDto,
    tenantId: string,
    userId: string,
  ): Promise<BillingPaymentMethod> {
    // If setting as default, unset other defaults first
    if (dto.is_default) {
      await this.supabase
        .from('billing_payment_methods')
        .update({ is_default: false, updated_by: userId })
        .eq('tenant_id', tenantId);
    }

    const result = await this.supabase
      .from('billing_payment_methods')
      .insert({
        ...dto,
        tenant_id: tenantId,
        is_active: true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao adicionar método de pagamento',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    const paymentMethod = result.data as BillingPaymentMethod;
    this.logger.log(
      `Método de pagamento adicionado: ${paymentMethod.id}`,
      'BillingCustomersService',
    );
    return paymentMethod;
  }

  async removePaymentMethod(
    methodId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.supabase
      .from('billing_payment_methods')
      .update({
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', methodId)
      .eq('tenant_id', tenantId);

    if (result.error) {
      this.logger.error(
        'Erro ao remover método de pagamento',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    this.logger.log(
      `Método de pagamento removido: ${methodId}`,
      'BillingCustomersService',
    );
  }

  async setDefaultPaymentMethod(
    methodId: string,
    tenantId: string,
    userId: string,
  ): Promise<BillingPaymentMethod> {
    // Unset all defaults
    await this.supabase
      .from('billing_payment_methods')
      .update({ is_default: false, updated_by: userId })
      .eq('tenant_id', tenantId);

    // Set the new default
    const result = await this.supabase
      .from('billing_payment_methods')
      .update({
        is_default: true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', methodId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao definir método padrão',
        result.error.message,
        'BillingCustomersService',
      );
      throw result.error;
    }

    const paymentMethod = result.data as BillingPaymentMethod;
    this.logger.log(
      `Método de pagamento padrão definido: ${methodId}`,
      'BillingCustomersService',
    );
    return paymentMethod;
  }
}
