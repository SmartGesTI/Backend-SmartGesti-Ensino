import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EducaIAFeedbackDto, FeedbackType } from './dto';

export interface FeedbackData extends EducaIAFeedbackDto {
  tenantId: string;
}

/**
 * Feedback Service for EducaIA
 * Saves user feedback to rag_feedback table for future fine-tuning
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Save feedback to database
   */
  async saveFeedback(data: FeedbackData): Promise<void> {
    try {
      const { error } = await this.supabase
        .getClient()
        .from('rag_feedback')
        .insert({
          tenant_id: data.tenantId,
          message_id: data.messageId,
          question: data.question,
          answer: data.answer,
          feedback_type: data.feedbackType,
          feedback_comment: data.feedbackComment || null,
          context_used: data.contextUsed || null,
          sources: data.sources || null,
          conversation_history: data.conversationHistory || null,
          model_used: data.modelUsed || 'gpt-5-mini',
        });

      if (error) {
        this.logger.error(`Error saving feedback: ${error.message}`, error);
        throw error;
      }

      this.logger.log(
        `Feedback saved: ${data.feedbackType} for message ${data.messageId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to save feedback: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get feedback statistics for a tenant
   */
  async getFeedbackStats(tenantId: string): Promise<{
    totalLikes: number;
    totalDislikes: number;
    recentFeedback: any[];
  }> {
    try {
      // Count likes
      const { count: likeCount, error: likeError } = await this.supabase
        .getClient()
        .from('rag_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('feedback_type', 'like');

      if (likeError) {
        this.logger.error(`Error counting likes: ${likeError.message}`);
      }

      // Count dislikes
      const { count: dislikeCount, error: dislikeError } = await this.supabase
        .getClient()
        .from('rag_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('feedback_type', 'dislike');

      if (dislikeError) {
        this.logger.error(`Error counting dislikes: ${dislikeError.message}`);
      }

      // Get recent feedback with comments
      const { data: recentFeedback, error: recentError } = await this.supabase
        .getClient()
        .from('rag_feedback')
        .select('id, feedback_type, feedback_comment, question, created_at')
        .eq('tenant_id', tenantId)
        .not('feedback_comment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) {
        this.logger.error(
          `Error getting recent feedback: ${recentError.message}`,
        );
      }

      return {
        totalLikes: likeCount || 0,
        totalDislikes: dislikeCount || 0,
        recentFeedback: recentFeedback || [],
      };
    } catch (error: any) {
      this.logger.error(
        `Error getting feedback stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Export positive feedback for fine-tuning
   * Returns question-answer pairs that received likes
   */
  async exportForFineTuning(
    tenantId: string,
    limit: number = 1000,
  ): Promise<
    Array<{
      question: string;
      answer: string;
      context: string | null;
    }>
  > {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('rag_feedback')
        .select('question, answer, context_used')
        .eq('tenant_id', tenantId)
        .eq('feedback_type', 'like')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(`Error exporting feedback: ${error.message}`);
        throw error;
      }

      return (data || []).map((item) => ({
        question: item.question,
        answer: item.answer,
        context: item.context_used,
      }));
    } catch (error: any) {
      this.logger.error(
        `Error exporting for fine-tuning: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
