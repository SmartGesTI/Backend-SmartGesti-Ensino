import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  MaxLength,
  IsUUID,
} from 'class-validator';

/**
 * DTO para aprovar transferência
 */
export class ApproveTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO para rejeitar transferência
 */
export class RejectTransferDto {
  @IsString()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO para completar transferência
 */
export class CompleteTransferDto {
  @IsOptional()
  @IsUUID('4', { message: 'ID da turma de destino deve ser um UUID válido' })
  to_class_group_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  school_registration_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO para cancelar transferência
 */
export class CancelTransferDto {
  @IsString()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
