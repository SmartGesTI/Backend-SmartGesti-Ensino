import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsIn,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class CreateStudentGuardianLinkDto {
  @IsUUID()
  guardian_id: string;

  @IsIn([
    'father',
    'mother',
    'legal_guardian',
    'stepfather',
    'stepmother',
    'grandparent',
    'sibling',
    'tutor',
    'other',
  ])
  relationship:
    | 'father'
    | 'mother'
    | 'legal_guardian'
    | 'stepfather'
    | 'stepmother'
    | 'grandparent'
    | 'sibling'
    | 'tutor'
    | 'other';

  @IsOptional()
  @IsIn(['full', 'shared', 'none', 'unknown'])
  custody_type?: 'full' | 'shared' | 'none' | 'unknown';

  @IsOptional()
  @IsBoolean()
  financial_responsible?: boolean;

  @IsOptional()
  @IsBoolean()
  pickup_allowed?: boolean;

  @IsOptional()
  @IsBoolean()
  is_primary_contact?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  contact_priority?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

export class UpdateStudentGuardianLinkDto {
  @IsOptional()
  @IsIn([
    'father',
    'mother',
    'legal_guardian',
    'stepfather',
    'stepmother',
    'grandparent',
    'sibling',
    'tutor',
    'other',
  ])
  relationship?:
    | 'father'
    | 'mother'
    | 'legal_guardian'
    | 'stepfather'
    | 'stepmother'
    | 'grandparent'
    | 'sibling'
    | 'tutor'
    | 'other';

  @IsOptional()
  @IsIn(['full', 'shared', 'none', 'unknown'])
  custody_type?: 'full' | 'shared' | 'none' | 'unknown';

  @IsOptional()
  @IsBoolean()
  financial_responsible?: boolean;

  @IsOptional()
  @IsBoolean()
  pickup_allowed?: boolean;

  @IsOptional()
  @IsBoolean()
  is_primary_contact?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  contact_priority?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
