import { IsString, IsOptional, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsString()
  message: string;

  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  model?: string;
}

export class StreamingMessageDto {
  @IsString()
  message: string;

  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  model?: string;
}
