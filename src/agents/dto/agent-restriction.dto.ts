import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAgentRestrictionDto {
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @IsUUID()
  @IsOptional()
  role_id?: string;

  @IsBoolean()
  @IsOptional()
  block_view?: boolean;

  @IsBoolean()
  @IsOptional()
  block_execute?: boolean;

  @IsBoolean()
  @IsOptional()
  block_edit?: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}
