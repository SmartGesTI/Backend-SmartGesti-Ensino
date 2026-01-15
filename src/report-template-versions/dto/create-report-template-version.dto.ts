import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateReportTemplateVersionDto {
  @IsUUID()
  report_template_id: string;

  @IsOptional()
  @IsArray()
  snapshot_sections?: unknown[];

  @IsOptional()
  @IsObject()
  snapshot_prompt?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  snapshot_data_requirements?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_current?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
