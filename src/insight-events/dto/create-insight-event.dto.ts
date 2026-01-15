import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreateInsightEventDto {
  @IsUUID()
  insight_instance_id: string;

  @IsIn([
    'created',
    'status_changed',
    'approved',
    'dismissed',
    'resolved',
    'delivered',
    'comment_added',
  ])
  event_type:
    | 'created'
    | 'status_changed'
    | 'approved'
    | 'dismissed'
    | 'resolved'
    | 'delivered'
    | 'comment_added';

  @IsOptional()
  @IsDateString()
  occurred_at?: string;

  @IsIn(['user', 'ai', 'system'])
  actor_type: 'user' | 'ai' | 'system';

  @IsOptional()
  @IsUUID()
  actor_id?: string;

  @IsOptional()
  @IsString()
  old_status?: string;

  @IsOptional()
  @IsString()
  new_status?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
