import { IsString, IsOptional, IsEnum } from 'class-validator';

export type FeedbackType = 'like' | 'dislike';

export class EducaIAFeedbackDto {
  @IsString()
  messageId: string;

  @IsString()
  question: string;

  @IsString()
  answer: string;

  @IsEnum(['like', 'dislike'])
  feedbackType: FeedbackType;

  @IsOptional()
  @IsString()
  feedbackComment?: string;

  @IsOptional()
  @IsString()
  contextUsed?: string;

  @IsOptional()
  sources?: any[];

  @IsOptional()
  conversationHistory?: any[];

  @IsOptional()
  @IsString()
  modelUsed?: string;
}
