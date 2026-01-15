import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { WebhookEventsFiltersDto } from './dto/billing-webhooks.dto';
import {
  BillingWebhookEvent,
  WebhookEventInsert,
  WebhookEventWithProvider,
} from '../common/types/billing.types';

@Injectable()
export class BillingWebhooksService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== STRIPE WEBHOOK ====================

  async handleStripeWebhook(
    payload: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _signature: string,
  ): Promise<WebhookEventWithProvider> {
    // In production, verify signature using Stripe SDK
    // const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    const eventType = payload.type as string;
    const eventId = payload.id as string;

    // Store webhook event
    const result = await this.supabase
      .from('billing_webhook_events')
      .insert({
        provider: 'stripe',
        provider_event_id: eventId,
        event_type: eventType,
        payload: payload,
        status: 'pending',
        received_at: new Date().toISOString(),
      } as WebhookEventInsert)
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao armazenar evento Stripe',
        result.error.message,
        'BillingWebhooksService',
      );
      throw result.error;
    }

    const webhookEvent = result.data as WebhookEventWithProvider;

    // Process event
    try {
      this.processStripeEvent(webhookEvent.id, eventType, payload);

      // Mark as processed
      await this.supabase
        .from('billing_webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEvent.id);

      this.logger.log(
        `Evento Stripe processado: ${eventId}`,
        'BillingWebhooksService',
      );
    } catch (processError) {
      const error = processError as Error;
      // Mark as failed
      await this.supabase
        .from('billing_webhook_events')
        .update({
          status: 'failed',
          error_message: error.message,
          retry_count: 1,
        })
        .eq('id', webhookEvent.id);

      this.logger.error(
        'Erro ao processar evento Stripe',
        error.message,
        'BillingWebhooksService',
      );
    }

    return webhookEvent;
  }

  private processStripeEvent(
    _webhookEventId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): void {
    const data = payload.data as Record<string, unknown>;
    const object = data?.object as Record<string, unknown>;

    switch (eventType) {
      case 'invoice.paid':
        this.handleInvoicePaid('stripe', object);
        break;
      case 'invoice.payment_failed':
        this.handlePaymentFailed('stripe', object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        this.handleSubscriptionUpdate('stripe', object);
        break;
      case 'customer.subscription.deleted':
        this.handleSubscriptionCanceled('stripe', object);
        break;
      case 'payment_intent.succeeded':
        this.handlePaymentSucceeded('stripe', object);
        break;
      case 'charge.refunded':
        this.handleRefund('stripe', object);
        break;
      default:
        this.logger.log(
          `Evento Stripe não tratado: ${eventType}`,
          'BillingWebhooksService',
        );
    }
  }

  // ==================== PAGAR.ME WEBHOOK ====================

  async handlePagarmeWebhook(
    payload: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _signature: string,
  ): Promise<WebhookEventWithProvider> {
    // In production, verify signature using Pagar.me SDK
    // const isValid = pagarme.validateSignature(payload, signature, webhookSecret);

    const eventType = payload.type as string;
    const eventId = payload.id as string;

    // Store webhook event
    const result = await this.supabase
      .from('billing_webhook_events')
      .insert({
        provider: 'pagarme',
        provider_event_id: eventId,
        event_type: eventType,
        payload: payload,
        status: 'pending',
        received_at: new Date().toISOString(),
      } as WebhookEventInsert)
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao armazenar evento Pagar.me',
        result.error.message,
        'BillingWebhooksService',
      );
      throw result.error;
    }

    const webhookEvent = result.data as WebhookEventWithProvider;

    // Process event
    try {
      this.processPagarmeEvent(webhookEvent.id, eventType, payload);

      // Mark as processed
      await this.supabase
        .from('billing_webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEvent.id);

      this.logger.log(
        `Evento Pagar.me processado: ${eventId}`,
        'BillingWebhooksService',
      );
    } catch (processError) {
      const error = processError as Error;
      // Mark as failed
      await this.supabase
        .from('billing_webhook_events')
        .update({
          status: 'failed',
          error_message: error.message,
          retry_count: 1,
        })
        .eq('id', webhookEvent.id);

      this.logger.error(
        'Erro ao processar evento Pagar.me',
        error.message,
        'BillingWebhooksService',
      );
    }

    return webhookEvent;
  }

  private processPagarmeEvent(
    _webhookEventId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): void {
    const data = payload.data as Record<string, unknown>;

    switch (eventType) {
      case 'charge.paid':
        this.handlePaymentSucceeded('pagarme', data);
        break;
      case 'charge.failed':
        this.handlePaymentFailed('pagarme', data);
        break;
      case 'charge.refunded':
        this.handleRefund('pagarme', data);
        break;
      case 'subscription.created':
      case 'subscription.updated':
        this.handleSubscriptionUpdate('pagarme', data);
        break;
      case 'subscription.canceled':
        this.handleSubscriptionCanceled('pagarme', data);
        break;
      default:
        this.logger.log(
          `Evento Pagar.me não tratado: ${eventType}`,
          'BillingWebhooksService',
        );
    }
  }

  // ==================== COMMON HANDLERS ====================

  private handleInvoicePaid(
    provider: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: Record<string, unknown>,
  ): void {
    // Update invoice status in database
    this.logger.log(`Invoice paga via ${provider}`, 'BillingWebhooksService');
    // Implementation would update billing_invoices table
  }

  private handlePaymentSucceeded(
    provider: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: Record<string, unknown>,
  ): void {
    // Update payment status in database
    this.logger.log(
      `Pagamento confirmado via ${provider}`,
      'BillingWebhooksService',
    );
    // Implementation would update billing_payments table
  }

  private handlePaymentFailed(
    provider: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: Record<string, unknown>,
  ): void {
    // Handle payment failure
    this.logger.log(
      `Pagamento falhou via ${provider}`,
      'BillingWebhooksService',
    );
    // Implementation would update billing_payments and billing_invoices tables
  }

  private handleSubscriptionUpdate(
    provider: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: Record<string, unknown>,
  ): void {
    // Update subscription status
    this.logger.log(
      `Subscription atualizada via ${provider}`,
      'BillingWebhooksService',
    );
    // Implementation would update tenant_subscriptions table
  }

  private handleSubscriptionCanceled(
    provider: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: Record<string, unknown>,
  ): void {
    // Handle subscription cancellation
    this.logger.log(
      `Subscription cancelada via ${provider}`,
      'BillingWebhooksService',
    );
    // Implementation would update tenant_subscriptions table
  }

  private handleRefund(
    provider: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: Record<string, unknown>,
  ): void {
    // Handle refund
    this.logger.log(
      `Reembolso processado via ${provider}`,
      'BillingWebhooksService',
    );
    // Implementation would update billing_refunds table
  }

  // ==================== EVENT MANAGEMENT ====================

  async findWebhookEvents(
    filters?: WebhookEventsFiltersDto,
  ): Promise<BillingWebhookEvent[]> {
    let query = this.supabase
      .from('billing_webhook_events')
      .select('*')
      .order('received_at', { ascending: false });

    if (filters?.provider) {
      query = query.eq('provider', filters.provider);
    }
    if (filters?.event_type) {
      query = query.eq('event_type', filters.event_type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 10) - 1,
      );
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        'Erro ao listar eventos webhook',
        result.error.message,
        'BillingWebhooksService',
      );
      throw result.error;
    }

    return (result.data || []) as BillingWebhookEvent[];
  }

  async findWebhookEvent(id: string): Promise<BillingWebhookEvent | null> {
    const result = await this.supabase
      .from('billing_webhook_events')
      .select('*')
      .eq('id', id)
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao buscar evento webhook',
        result.error.message,
        'BillingWebhooksService',
      );
      throw result.error;
    }

    return result.data as BillingWebhookEvent | null;
  }

  async reprocessEvent(eventId: string): Promise<{ success: boolean }> {
    const event = await this.findWebhookEvent(eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    const eventWithProvider = event as WebhookEventWithProvider;

    // Increment retry count
    await this.supabase
      .from('billing_webhook_events')
      .update({
        status: 'pending',
        retry_count: (eventWithProvider.retry_count || 0) + 1,
      })
      .eq('id', eventId);

    // Reprocess based on provider
    try {
      const provider = eventWithProvider.provider || '';
      if (provider === 'stripe') {
        this.processStripeEvent(eventId, event.event_type, event.payload);
      } else if (provider === 'pagarme') {
        this.processPagarmeEvent(eventId, event.event_type, event.payload);
      }

      await this.supabase
        .from('billing_webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      this.logger.log(
        `Evento reprocessado com sucesso: ${eventId}`,
        'BillingWebhooksService',
      );
      return { success: true };
    } catch (error) {
      const err = error as Error;
      await this.supabase
        .from('billing_webhook_events')
        .update({
          status: 'failed',
          error_message: err.message,
        })
        .eq('id', eventId);

      throw error;
    }
  }
}
