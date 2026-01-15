import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsObject,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateThreadDto {
  @IsString()
  thread_type: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsUUID()
  @IsOptional()
  school_id?: string;

  @IsUUID()
  @IsOptional()
  academic_year_id?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  preview_text?: string;

  @IsBoolean()
  @IsOptional()
  requires_ack?: boolean;

  @IsDateString()
  @IsOptional()
  ack_deadline?: string;

  @IsString()
  @IsOptional()
  source_entity_type?: string;

  @IsUUID()
  @IsOptional()
  source_entity_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  ai_context?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  ai_summary?: string;
}

export class UpdateThreadDto extends PartialType(CreateThreadDto) {}

export class ScheduleThreadDto {
  @IsDateString()
  scheduled_at: string;
}

export class SendThreadDto {
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}

export class CreateMessageDto {
  @IsString()
  @IsOptional()
  author_type?: string;

  @IsUUID()
  @IsOptional()
  author_user_id?: string;

  @IsUUID()
  @IsOptional()
  author_person_id?: string;

  @IsString()
  @IsOptional()
  message_type?: string;

  @IsString()
  body: string;

  @IsString()
  @IsOptional()
  body_format?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateMessageDto extends PartialType(CreateMessageDto) {}

export class AddParticipantDto {
  @IsUUID()
  @IsOptional()
  participant_user_id?: string;

  @IsUUID()
  @IsOptional()
  participant_person_id?: string;

  @IsString()
  @IsOptional()
  participant_role?: string;

  @IsBoolean()
  @IsOptional()
  is_muted?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateParticipantDto extends PartialType(AddParticipantDto) {}

export class CreateThreadLinkDto {
  @IsString()
  entity_type: string;

  @IsUUID()
  entity_id: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
