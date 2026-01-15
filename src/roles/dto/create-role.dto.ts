import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  hierarchy_level: number;

  @IsObject()
  @IsOptional()
  default_permissions?: Record<string, string[]>;
}
