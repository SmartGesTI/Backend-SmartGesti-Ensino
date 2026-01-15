import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { ReportTemplateVersion } from '../common/types';
import { CreateReportTemplateVersionDto } from './dto/create-report-template-version.dto';

@Injectable()
export class ReportTemplateVersionsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: { reportTemplateId?: string; isCurrent?: boolean },
  ): Promise<ReportTemplateVersion[]> {
    let query = this.supabase
      .from('report_template_versions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false });
    if (options?.reportTemplateId)
      query = query.eq('report_template_id', options.reportTemplateId);
    if (options?.isCurrent !== undefined)
      query = query.eq('is_current', options.isCurrent);
    const { data, error } = await query;
    if (error)
      throw new Error(
        `Failed to list report template versions: ${error.message}`,
      );
    return (data || []) as ReportTemplateVersion[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<ReportTemplateVersion | null> {
    const { data, error } = await this.supabase
      .from('report_template_versions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(
        `Failed to get report template version: ${error.message}`,
      );
    }
    return data as ReportTemplateVersion;
  }

  async getCurrentVersion(
    reportTemplateId: string,
    tenantId: string,
  ): Promise<ReportTemplateVersion | null> {
    const { data, error } = await this.supabase
      .from('report_template_versions')
      .select('*')
      .eq('report_template_id', reportTemplateId)
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get current version: ${error.message}`);
    }
    return data as ReportTemplateVersion;
  }

  async createVersion(
    tenantId: string,
    dto: CreateReportTemplateVersionDto,
    userId?: string,
  ): Promise<ReportTemplateVersion> {
    const now = new Date().toISOString();

    // Get the latest version number
    const { data: latestVersions } = await this.supabase
      .from('report_template_versions')
      .select('version')
      .eq('tenant_id', tenantId)
      .eq('report_template_id', dto.report_template_id)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion =
      latestVersions && latestVersions.length > 0
        ? latestVersions[0].version + 1
        : 1;

    // If this is to be the current version, unset any existing current
    if (dto.is_current !== false) {
      await this.supabase
        .from('report_template_versions')
        .update({ is_current: false })
        .eq('tenant_id', tenantId)
        .eq('report_template_id', dto.report_template_id)
        .eq('is_current', true);
    }

    const { data, error } = await this.supabase
      .from('report_template_versions')
      .insert({
        tenant_id: tenantId,
        report_template_id: dto.report_template_id,
        version: nextVersion,
        snapshot_sections: dto.snapshot_sections ?? [],
        snapshot_prompt: dto.snapshot_prompt ?? {},
        snapshot_data_requirements: dto.snapshot_data_requirements ?? {},
        is_current: dto.is_current ?? true,
        notes: dto.notes ?? null,
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error)
      throw new Error(
        `Failed to create report template version: ${error.message}`,
      );
    this.logger.log(
      'Report template version created',
      'ReportTemplateVersionsService',
      { id: data.id, version: nextVersion },
    );
    return data as ReportTemplateVersion;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Report template version com id '${id}' não encontrada`,
      );
    const { error } = await this.supabase
      .from('report_template_versions')
      .delete()
      .eq('id', id);
    if (error)
      throw new Error(
        `Failed to delete report template version: ${error.message}`,
      );
  }
}
