// Sprint 7: Monetizacao

export type PlanTier = 'free' | 'basic' | 'standard' | 'pro' | 'enterprise';
export type PriceInterval = 'month' | 'year';
export type EntitlementType = 'boolean' | 'limit' | 'quota' | 'metered';
export type ResetPeriod =
  | 'none'
  | 'daily'
  | 'monthly'
  | 'yearly'
  | 'subscription_period';
export type Enforcement = 'hard' | 'soft';
export type BillingCustomerStatus = 'active' | 'inactive';
export type PaymentMethodType =
  | 'card_credit'
  | 'card_debit'
  | 'pix'
  | 'boleto'
  | 'bank_transfer'
  | 'manual';
export type PaymentMethodStatus = 'active' | 'inactive';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'unpaid';
export type CollectionMethod = 'automatic' | 'invoice';
export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';
export type InvoiceCollectionMethod = 'automatic' | 'invoice' | 'manual';
export type InvoiceLineType =
  | 'subscription'
  | 'usage'
  | 'manual'
  | 'discount'
  | 'tax'
  | 'credit';
export type PaymentStatus =
  | 'pending'
  | 'requires_action'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded';
export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';
export type WebhookEventStatus =
  | 'received'
  | 'processed'
  | 'failed'
  | 'ignored';
export type UsageSource = 'system' | 'user' | 'ai' | 'import';

export interface PaymentProvider {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  capabilities: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface FeatureDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface SubscriptionPlan {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  tier: PlanTier;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
  ai_context: Record<string, unknown>;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface SubscriptionPlanPrice {
  id: string;
  plan_id: string;
  provider_id: string | null;
  currency: string;
  interval: PriceInterval;
  amount_cents: number;
  trial_days: number;
  is_active: boolean;
  provider_price_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface SubscriptionPlanEntitlement {
  id: string;
  plan_id: string;
  entitlement_key: string;
  entitlement_type: EntitlementType;
  enabled: boolean | null;
  limit_value: number | null;
  unit: string | null;
  reset_period: ResetPeriod;
  enforcement: Enforcement;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface BillingCustomer {
  id: string;
  tenant_id: string;
  provider_id: string;
  provider_customer_id: string;
  status: BillingCustomerStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TenantBillingProfile {
  id: string;
  tenant_id: string;
  legal_name: string | null;
  trade_name: string | null;
  tax_id: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  use_tenant_address: boolean;
  address_override: Record<string, unknown>;
  invoice_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface BillingPaymentMethod {
  id: string;
  tenant_id: string;
  provider_id: string;
  billing_customer_id: string;
  method_type: PaymentMethodType;
  provider_payment_method_id: string | null;
  is_default: boolean;
  status: PaymentMethodStatus;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  holder_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  provider_id: string;
  billing_customer_id: string;
  plan_id: string;
  plan_price_id: string;
  status: SubscriptionStatus;
  collection_method: CollectionMethod;
  default_payment_method_id: string | null;
  provider_subscription_id: string | null;
  started_at: string;
  trial_start_at: string | null;
  trial_end_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  ended_at: string | null;
  metadata: Record<string, unknown>;
  provider_payload: Record<string, unknown>;
  ai_context: Record<string, unknown>;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TenantSubscriptionEntitlementOverride {
  id: string;
  tenant_subscription_id: string;
  entitlement_key: string;
  entitlement_type: EntitlementType;
  enabled: boolean | null;
  limit_value: number | null;
  unit: string | null;
  reset_period: ResetPeriod;
  enforcement: Enforcement;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface BillingInvoice {
  id: string;
  tenant_id: string;
  provider_id: string;
  billing_customer_id: string;
  tenant_subscription_id: string | null;
  invoice_number: string | null;
  status: InvoiceStatus;
  collection_method: InvoiceCollectionMethod;
  currency: string;
  subtotal_cents: number;
  discounts_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_due_cents: number;
  amount_paid_cents: number;
  issued_at: string | null;
  due_at: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
  provider_invoice_id: string | null;
  hosted_invoice_url: string | null;
  pdf_url: string | null;
  payment_instructions: string | null;
  metadata: Record<string, unknown>;
  provider_payload: Record<string, unknown>;
  ai_context: Record<string, unknown>;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface BillingInvoiceLine {
  id: string;
  invoice_id: string;
  line_type: InvoiceLineType;
  description: string;
  quantity: number;
  unit_amount_cents: number;
  amount_cents: number;
  currency: string;
  reference_table: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface BillingPayment {
  id: string;
  tenant_id: string;
  provider_id: string;
  billing_customer_id: string;
  invoice_id: string;
  payment_method_id: string | null;
  method_type: PaymentMethodType;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  installments_count: number | null;
  initiated_at: string;
  authorized_at: string | null;
  captured_at: string | null;
  failed_at: string | null;
  canceled_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  provider_payment_id: string | null;
  provider_charge_id: string | null;
  idempotency_key: string | null;
  payment_details: Record<string, unknown>;
  provider_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface BillingRefund {
  id: string;
  provider_id: string;
  payment_id: string;
  status: RefundStatus;
  amount_cents: number;
  currency: string;
  reason: string | null;
  provider_refund_id: string | null;
  provider_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface BillingWebhookEvent {
  id: string;
  provider_id: string;
  event_id: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  status: WebhookEventStatus;
  signature_valid: boolean | null;
  tenant_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  payload: Record<string, unknown>;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface WebhookEventInsert {
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  received_at: string;
}

export interface WebhookEventWithProvider extends BillingWebhookEvent {
  provider?: string;
  provider_event_id?: string;
  retry_count?: number;
}

export interface UsageMetric {
  id: string;
  key: string;
  name: string;
  unit: string;
  reset_period: ResetPeriod;
  is_active: boolean;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TenantUsageEvent {
  id: string;
  tenant_id: string;
  school_id: string | null;
  metric_key: string;
  quantity: number;
  occurred_at: string;
  source: UsageSource;
  user_id: string | null;
  reference_table: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TenantUsageRollup {
  id: string;
  tenant_id: string;
  metric_key: string;
  period_start: string;
  period_end: string;
  used_value: number;
  limit_value: number | null;
  is_over_limit: boolean;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface SubscriptionPlanWithPrices extends SubscriptionPlan {
  prices?: SubscriptionPlanPrice[];
  entitlements?: SubscriptionPlanEntitlement[];
}

export interface TenantSubscriptionWithRelations extends TenantSubscription {
  plan?: SubscriptionPlan;
  price?: SubscriptionPlanPrice;
  payment_method?: BillingPaymentMethod;
  overrides?: TenantSubscriptionEntitlementOverride[];
}

export interface BillingInvoiceWithRelations extends BillingInvoice {
  lines?: BillingInvoiceLine[];
  payments?: BillingPayment[];
  subscription?: TenantSubscription;
}

// Types for Supabase responses with relations
export interface BillingCustomerWithProvider extends BillingCustomer {
  payment_providers?: Pick<PaymentProvider, 'name' | 'slug'>;
}

export interface BillingPaymentMethodWithProvider extends BillingPaymentMethod {
  payment_providers?: Pick<PaymentProvider, 'name' | 'slug'>;
}
