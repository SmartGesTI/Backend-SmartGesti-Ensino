import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { BillingWebhooksService } from './billing-webhooks.service';
import { WebhookEventsFiltersDto } from './dto/billing-webhooks.dto';
import { BillingWebhookEvent } from '../common/types/billing.types';

@Controller('billing/webhooks')
export class BillingWebhooksController {
  constructor(
    private readonly billingWebhooksService: BillingWebhooksService,
  ) {}

  // ==================== WEBHOOK ENDPOINTS (public - no auth) ====================

  @Post('stripe')
  async handleStripeWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('stripe-signature') signature: string,
  ): Promise<BillingWebhookEvent> {
    return this.billingWebhooksService.handleStripeWebhook(payload, signature);
  }

  @Post('pagarme')
  async handlePagarmeWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('x-hub-signature') signature: string,
  ): Promise<BillingWebhookEvent> {
    return this.billingWebhooksService.handlePagarmeWebhook(payload, signature);
  }

  // ==================== ADMIN ENDPOINTS (authenticated) ====================

  @Get('events')
  @UseGuards(JwtAuthGuard)
  async findWebhookEvents(
    @Query() filters: WebhookEventsFiltersDto,
  ): Promise<BillingWebhookEvent[]> {
    return this.billingWebhooksService.findWebhookEvents(filters);
  }

  @Get('events/:id')
  @UseGuards(JwtAuthGuard)
  async findWebhookEvent(
    @Param('id') id: string,
  ): Promise<BillingWebhookEvent | null> {
    return this.billingWebhooksService.findWebhookEvent(id);
  }

  @Post('events/:id/reprocess')
  @UseGuards(JwtAuthGuard)
  async reprocessEvent(
    @Param('id') eventId: string,
  ): Promise<{ success: boolean }> {
    return this.billingWebhooksService.reprocessEvent(eventId);
  }
}
