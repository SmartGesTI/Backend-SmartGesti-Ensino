import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { PreEnrollmentReview } from '../common/types';
import { CreatePreEnrollmentReviewDto } from './dto/create-pre-enrollment-review.dto';

@Injectable()
export class PreEnrollmentReviewsService {
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
      applicationId?: string;
      reviewType?: string;
      actorType?: string;
    },
  ): Promise<PreEnrollmentReview[]> {
    let query = this.supabase
      .from('pre_enrollment_reviews')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.applicationId) {
      query = query.eq('application_id', options.applicationId);
    }

    if (options?.reviewType) {
      query = query.eq('review_type', options.reviewType);
    }

    if (options?.actorType) {
      query = query.eq('actor_type', options.actorType);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment reviews: ${error.message}`,
        undefined,
        'PreEnrollmentReviewsService',
      );
      throw new Error(`Failed to list reviews: ${error.message}`);
    }

    return (data || []) as PreEnrollmentReview[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentReview | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_reviews')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get review: ${error.message}`);
    }

    return data as PreEnrollmentReview;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentReviewDto,
    userId?: string,
  ): Promise<PreEnrollmentReview> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_reviews')
      .insert({
        tenant_id: tenantId,
        application_id: dto.application_id,
        review_type: dto.review_type,
        score: dto.score ?? null,
        missing_fields: dto.missing_fields ?? [],
        flags: dto.flags ?? [],
        recommendations: dto.recommendations ?? [],
        summary_markdown: dto.summary_markdown ?? null,
        structured_output: dto.structured_output ?? {},
        actor_type: dto.actor_type,
        actor_id: dto.actor_id ?? userId ?? null,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create review: ${error.message}`,
        undefined,
        'PreEnrollmentReviewsService',
      );
      throw new Error(`Failed to create review: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment review created',
      'PreEnrollmentReviewsService',
      {
        id: data.id,
        type: dto.review_type,
      },
    );

    return data as PreEnrollmentReview;
  }

  async createAIIntake(
    tenantId: string,
    applicationId: string,
    aiResult: {
      score?: number;
      missingFields?: unknown[];
      flags?: unknown[];
      recommendations?: unknown[];
      summary?: string;
      structuredOutput?: Record<string, unknown>;
    },
  ): Promise<PreEnrollmentReview> {
    return this.create(tenantId, {
      application_id: applicationId,
      review_type: 'ai_intake',
      score: aiResult.score,
      missing_fields: aiResult.missingFields,
      flags: aiResult.flags,
      recommendations: aiResult.recommendations,
      summary_markdown: aiResult.summary,
      structured_output: aiResult.structuredOutput,
      actor_type: 'ai',
    });
  }

  async createDuplicateCheck(
    tenantId: string,
    applicationId: string,
    duplicateResult: {
      score?: number;
      flags?: unknown[];
      summary?: string;
      structuredOutput?: Record<string, unknown>;
    },
  ): Promise<PreEnrollmentReview> {
    return this.create(tenantId, {
      application_id: applicationId,
      review_type: 'ai_duplicate_check',
      score: duplicateResult.score,
      flags: duplicateResult.flags,
      summary_markdown: duplicateResult.summary,
      structured_output: duplicateResult.structuredOutput,
      actor_type: 'ai',
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Review com id '${id}' não encontrado`);
    }

    const { error } = await this.supabase
      .from('pre_enrollment_reviews')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete review: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment review deleted',
      'PreEnrollmentReviewsService',
      {
        id,
      },
    );
  }
}
