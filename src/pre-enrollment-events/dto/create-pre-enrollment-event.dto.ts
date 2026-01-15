import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreatePreEnrollmentEventDto {
  @IsUUID()
  household_id: string;

  @IsOptional()
  @IsUUID()
  application_id?: string;

  @IsIn([
    'created',
    'updated',
    'submitted',
    'status_changed',
    'needs_info_requested',
    'approved',
    'rejected',
    'converted',
    'attachment_added',
    'comment_added',
  ])
  event_type:
    | 'created'
    | 'updated'
    | 'submitted'
    | 'status_changed'
    | 'needs_info_requested'
    | 'approved'
    | 'rejected'
    | 'converted'
    | 'attachment_added'
    | 'comment_added';

  @IsOptional()
  @IsDateString()
  occurred_at?: string;

  @IsIn(['public', 'user', 'ai', 'system'])
  actor_type: 'public' | 'user' | 'ai' | 'system';

  @IsOptional()
  @IsUUID()
  actor_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
