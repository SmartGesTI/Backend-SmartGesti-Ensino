import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';

export class UpdateClassGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Capacidade não pode ser negativa' })
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

export class AllocateRoomDto {
  @IsString()
  classroom_id: string;

  @IsString()
  valid_from: string;

  @IsOptional()
  @IsString()
  valid_to?: string;
}
