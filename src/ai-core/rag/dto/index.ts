import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RAG_CATEGORIES } from '../constants/rag.constants';
import type { RagCategory } from '../constants/rag.constants';

/**
 * DTO para busca na knowledge base
 */
export class SearchQueryDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  category?: RagCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  topK?: number = 5;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/**
 * DTO para ingestão de documento
 */
export class IngestDocumentDto {
  @IsString()
  filePath: string;

  @IsOptional()
  @IsString()
  content?: string;
}

/**
 * DTO para resposta de ingestão
 */
export class IngestResponseDto {
  success: boolean;
  documentId: string;
  title: string;
  chunksCreated: number;
  message: string;
}

/**
 * DTO para status da knowledge base
 */
export class RagStatusDto {
  totalDocuments: number;
  totalChunks: number;
  categoryCounts: Record<string, number>;
  lastUpdated: Date | null;
}

/**
 * DTO para resultado de busca
 */
export class SearchResultDto {
  id: string;
  documentId: string;
  content: string;
  sectionTitle: string;
  similarity: number;
  rank?: number;
  document: {
    id: string;
    title: string;
    category: RagCategory;
    routePattern: string | null;
    menuPath: string | null;
    tags: string[];
  };
  metadata: Record<string, any>;
}

/**
 * DTO para uma mensagem do histórico
 */
export class ChatMessageDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

/**
 * DTO para perguntar ao assistente (com histórico opcional)
 */
export class AskQuestionDto {
  @IsString()
  question: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

/**
 * DTO para enviar feedback
 */
export class SendFeedbackDto {
  @IsString()
  messageId: string;

  @IsString()
  question: string;

  @IsString()
  answer: string;

  @IsString()
  @IsIn(['like', 'dislike'])
  feedbackType: 'like' | 'dislike';

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  sources?: any[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  conversationHistory?: ChatMessageDto[];
}

/**
 * DTO para regenerar resposta
 */
export class RegenerateDto {
  @IsString()
  question: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

/**
 * DTO para exportar dados de fine-tuning
 */
export class ExportFinetuningDto {
  @IsOptional()
  @IsString()
  @IsIn(['like', 'dislike'])
  feedbackType?: 'like' | 'dislike';

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * DTO para streaming de perguntas (query params)
 */
export class StreamingAskDto {
  @IsString()
  question: string;
}
