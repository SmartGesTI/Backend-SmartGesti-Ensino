import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateNotificationRuleDto {
  @IsString() event_type: string;
  @IsString() @IsOptional() status?: string;
  @IsString() target_kind: string;
  @IsObject() @IsOptional() audience_config?: Record<string, unknown>;
  @IsObject() @IsOptional() template_config?: Record<string, unknown>;
  @IsArray() @IsOptional() channels?: string[];
  @IsUUID() @IsOptional() school_id?: string;
}

export class MarkReadDto {
  @IsArray() notification_ids: string[];
}

export class UpdatePreferencesDto {
  @IsObject() preferences: Record<string, unknown>;
}
