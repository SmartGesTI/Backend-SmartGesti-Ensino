import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreateMetricDto,
  UpdateMetricDto,
  TrackUsageDto,
  UsageHistoryFiltersDto,
} from './dto/usage-tracking.dto';

@Injectable()
export class UsageTrackingService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== METRICS ====================

  async findMetrics(tenantId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(
        'Erro ao listar métricas',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    return data || [];
  }

  async findMetric(id: string, tenantId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      this.logger.error(
        'Erro ao buscar métrica',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    return data;
  }

  async findMetricByKey(key: string, tenantId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('key', key)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        'Erro ao buscar métrica por key',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    return data;
  }

  async createMetric(
    dto: CreateMetricDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('usage_metrics')
      .insert({
        ...dto,
        tenant_id: tenantId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao criar métrica',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    this.logger.log(`Métrica criada: ${data.id}`, 'UsageTrackingService');
    return data;
  }

  async updateMetric(
    id: string,
    dto: UpdateMetricDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('usage_metrics')
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
        'Erro ao atualizar métrica',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    this.logger.log(`Métrica atualizada: ${id}`, 'UsageTrackingService');
    return data;
  }

  // ==================== USAGE TRACKING ====================

  async trackUsage(
    dto: TrackUsageDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // Find metric by key
    const metric = await this.findMetricByKey(dto.metric_key, tenantId);
    if (!metric) {
      throw new Error(`Métrica não encontrada: ${dto.metric_key}`);
    }

    // Create usage event
    const { data, error } = await this.supabase
      .from('tenant_usage_events')
      .insert({
        tenant_id: tenantId,
        usage_metric_id: metric.id,
        quantity: dto.quantity,
        source: dto.source,
        reference_table: dto.reference_table,
        reference_id: dto.reference_id,
        school_id: dto.school_id,
        recorded_at: new Date().toISOString(),
        ...(dto.metadata && { metadata: dto.metadata }),
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao registrar uso',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    // Update or create rollup
    await this.updateRollup(tenantId, metric.id, dto.quantity, userId);

    this.logger.log(`Uso registrado: ${data.id}`, 'UsageTrackingService');
    return data;
  }

  async getCurrentUsage(tenantId: string): Promise<any[]> {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).toISOString();

    const { data, error } = await this.supabase
      .from('tenant_usage_rollups')
      .select('*, usage_metrics(key, name, unit)')
      .eq('tenant_id', tenantId)
      .gte('period_start', startOfMonth)
      .lte('period_end', endOfMonth);

    if (error) {
      this.logger.error(
        'Erro ao buscar uso atual',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    return data || [];
  }

  async getUsageHistory(
    tenantId: string,
    filters?: UsageHistoryFiltersDto,
  ): Promise<any[]> {
    let query = this.supabase
      .from('tenant_usage_rollups')
      .select('*, usage_metrics(key, name, unit)')
      .eq('tenant_id', tenantId)
      .order('period_start', { ascending: false });

    if (filters?.from) {
      query = query.gte('period_start', filters.from);
    }
    if (filters?.to) {
      query = query.lte('period_end', filters.to);
    }
    if (filters?.metric_key) {
      // Need to filter by metric key through join
      const metric = await this.findMetricByKey(filters.metric_key, tenantId);
      if (metric) {
        query = query.eq('usage_metric_id', metric.id);
      }
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        'Erro ao buscar histórico de uso',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    return data || [];
  }

  async checkLimits(tenantId: string): Promise<any[]> {
    // Get current usage
    const currentUsage = await this.getCurrentUsage(tenantId);

    // Get entitlements (would need TenantSubscriptionsService injected for full implementation)
    // For now, return usage with placeholder limits
    return currentUsage.map((u) => ({
      metric_key: u.usage_metrics?.key,
      metric_name: u.usage_metrics?.name,
      current_usage: u.total_quantity,
      limit: null, // Would come from entitlements
      unit: u.usage_metrics?.unit,
      percentage_used: null,
    }));
  }

  async recalculateRollups(tenantId: string, metricKey: string): Promise<void> {
    const metric = await this.findMetricByKey(metricKey, tenantId);
    if (!metric) {
      throw new Error(`Métrica não encontrada: ${metricKey}`);
    }

    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).toISOString();

    // Sum all events for the current period
    const { data: events, error: eventsError } = await this.supabase
      .from('tenant_usage_events')
      .select('quantity')
      .eq('tenant_id', tenantId)
      .eq('usage_metric_id', metric.id)
      .gte('recorded_at', startOfMonth)
      .lte('recorded_at', endOfMonth);

    if (eventsError) {
      this.logger.error(
        'Erro ao buscar eventos para recálculo',
        eventsError.message,
        'UsageTrackingService',
      );
      throw eventsError;
    }

    const totalQuantity = (events || []).reduce(
      (sum, e) => sum + (e.quantity || 0),
      0,
    );

    // Upsert rollup
    const { error } = await this.supabase.from('tenant_usage_rollups').upsert(
      {
        tenant_id: tenantId,
        usage_metric_id: metric.id,
        period_start: startOfMonth,
        period_end: endOfMonth,
        total_quantity: totalQuantity,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'tenant_id,usage_metric_id,period_start',
      },
    );

    if (error) {
      this.logger.error(
        'Erro ao atualizar rollup',
        error.message,
        'UsageTrackingService',
      );
      throw error;
    }

    this.logger.log(
      `Rollup recalculado para ${metricKey}`,
      'UsageTrackingService',
    );
  }

  // ==================== HELPERS ====================

  private async updateRollup(
    tenantId: string,
    metricId: string,
    quantity: number,
    userId: string,
  ): Promise<void> {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).toISOString();

    // Check if rollup exists
    const { data: existing, error: existingError } = await this.supabase
      .from('tenant_usage_rollups')
      .select('id, total_quantity')
      .eq('tenant_id', tenantId)
      .eq('usage_metric_id', metricId)
      .eq('period_start', startOfMonth)
      .maybeSingle();

    if (existingError) {
      this.logger.error(
        'Erro ao buscar rollup existente',
        existingError.message,
        'UsageTrackingService',
      );
      return;
    }

    if (existing) {
      // Update existing
      await this.supabase
        .from('tenant_usage_rollups')
        .update({
          total_quantity: (existing.total_quantity || 0) + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await this.supabase.from('tenant_usage_rollups').insert({
        tenant_id: tenantId,
        usage_metric_id: metricId,
        period_start: startOfMonth,
        period_end: endOfMonth,
        total_quantity: quantity,
        created_by: userId,
      });
    }
  }
}
