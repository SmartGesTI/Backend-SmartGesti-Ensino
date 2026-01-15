import {
  IsString,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  hierarchy_level?: number;

  @IsObject()
  @IsOptional()
  default_permissions?: Record<string, string[]>;
}
