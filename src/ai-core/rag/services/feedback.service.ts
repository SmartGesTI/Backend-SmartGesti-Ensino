import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { SendFeedbackDto, ChatMessageDto } from '../dto';

export interface FeedbackRecord {
  id: string;
  messageId: string;
  question: string;
  answer: string;
  feedbackType: 'like' | 'dislike';
  comment?: string;
  sources?: any[];
  conversationHistory?: ChatMessageDto[];
  createdAt: Date;
}

export interface FinetuningExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Salva feedback do usuário
   */
  async saveFeedback(
    tenantId: string,
    dto: SendFeedbackDto,
    contextUsed?: string,
  ): Promise<{ success: boolean; id?: string }> {
    try {
      const client = this.supabase.getClient();

      const { data, error } = await client
        .from('rag_feedback')
        .insert({
          tenant_id: tenantId,
          message_id: dto.messageId,
          question: dto.question,
          answer: dto.answer,
          feedback_type: dto.feedbackType,
          feedback_comment: dto.comment,
          sources: dto.sources,
          conversation_history: dto.conversationHistory,
          context_used: contextUsed,
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error('Error saving feedback: ' + error.message);
        return { success: false };
      }

      this.logger.log(
        `Feedback saved: ${dto.feedbackType} for message ${dto.messageId}`,
      );

      return { success: true, id: data.id };
    } catch (error) {
      this.logger.error('Error saving feedback: ' + error);
      return { success: false };
    }
  }

  /**
   * Obtém estatísticas de feedback
   */
  async getStats(tenantId: string): Promise<{
    totalLikes: number;
    totalDislikes: number;
    total: number;
  }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('rag_feedback')
      .select('feedback_type')
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error('Error getting feedback stats: ' + error.message);
      return { totalLikes: 0, totalDislikes: 0, total: 0 };
    }

    const likes = data.filter((f) => f.feedback_type === 'like').length;
    const dislikes = data.filter((f) => f.feedback_type === 'dislike').length;

    return {
      totalLikes: likes,
      totalDislikes: dislikes,
      total: data.length,
    };
  }

  /**
   * Exporta dados para fine-tuning no formato OpenAI
   * Apenas feedbacks positivos (likes) são usados
   */
  async exportForFinetuning(
    tenantId: string,
    options: { feedbackType?: 'like' | 'dislike'; limit?: number } = {},
  ): Promise<FinetuningExample[]> {
    const { feedbackType = 'like', limit = 1000 } = options;

    const client = this.supabase.getClient();

    let query = client
      .from('rag_feedback')
      .select('question, answer, conversation_history, context_used')
      .eq('tenant_id', tenantId)
      .eq('feedback_type', feedbackType)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      this.logger.error('Error exporting for finetuning: ' + error.message);
      return [];
    }

    // Converter para formato OpenAI fine-tuning
    return data.map((record) => {
      const messages: FinetuningExample['messages'] = [
        {
          role: 'system',
          content: `Você é um assistente do sistema SmartGesti-Ensino. Use as informações do contexto para responder de forma precisa e útil.${
            record.context_used ? '\n\nCONTEXTO:\n' + record.context_used : ''
          }`,
        },
      ];

      // Adicionar histórico da conversa se existir
      if (record.conversation_history && Array.isArray(record.conversation_history)) {
        for (const msg of record.conversation_history) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }

      // Adicionar a pergunta e resposta atual
      messages.push({ role: 'user', content: record.question });
      messages.push({ role: 'assistant', content: record.answer });

      return { messages };
    });
  }

  /**
   * Exporta em formato JSONL para fine-tuning
   */
  async exportAsJsonl(
    tenantId: string,
    options: { feedbackType?: 'like' | 'dislike'; limit?: number } = {},
  ): Promise<string> {
    const examples = await this.exportForFinetuning(tenantId, options);
    return examples.map((ex) => JSON.stringify(ex)).join('\n');
  }

  /**
   * Lista feedbacks recentes
   */
  async listRecent(
    tenantId: string,
    options: { limit?: number; feedbackType?: 'like' | 'dislike' } = {},
  ): Promise<FeedbackRecord[]> {
    const { limit = 50, feedbackType } = options;

    const client = this.supabase.getClient();

    let query = client
      .from('rag_feedback')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (feedbackType) {
      query = query.eq('feedback_type', feedbackType);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Error listing feedback: ' + error.message);
      return [];
    }

    return data.map((record) => ({
      id: record.id,
      messageId: record.message_id,
      question: record.question,
      answer: record.answer,
      feedbackType: record.feedback_type,
      comment: record.feedback_comment,
      sources: record.sources,
      conversationHistory: record.conversation_history,
      createdAt: new Date(record.created_at),
    }));
  }
}
