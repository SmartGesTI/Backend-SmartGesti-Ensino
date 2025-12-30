import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAgentPermissionDto {
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @IsUUID()
  @IsOptional()
  role_id?: string;

  @IsBoolean()
  @IsOptional()
  can_view?: boolean;

  @IsBoolean()
  @IsOptional()
  can_execute?: boolean;

  @IsBoolean()
  @IsOptional()
  can_edit?: boolean;
}