import { IsString, IsOptional, IsUUID, IsIn, IsBoolean } from 'class-validator';

export class CreatePreEnrollmentRelationshipDto {
  @IsUUID()
  application_id: string;

  @IsUUID()
  student_person_id: string;

  @IsUUID()
  guardian_person_id: string;

  @IsIn([
    'pai',
    'mae',
    'responsavel_legal',
    'avo',
    'avoa',
    'tio',
    'tia',
    'outro',
  ])
  relationship_type:
    | 'pai'
    | 'mae'
    | 'responsavel_legal'
    | 'avo'
    | 'avoa'
    | 'tio'
    | 'tia'
    | 'outro';

  @IsOptional()
  @IsBoolean()
  is_financial_responsible?: boolean;

  @IsOptional()
  @IsBoolean()
  is_emergency_contact?: boolean;

  @IsOptional()
  @IsBoolean()
  lives_with?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePreEnrollmentRelationshipDto {
  @IsOptional()
  @IsIn([
    'pai',
    'mae',
    'responsavel_legal',
    'avo',
    'avoa',
    'tio',
    'tia',
    'outro',
  ])
  relationship_type?:
    | 'pai'
    | 'mae'
    | 'responsavel_legal'
    | 'avo'
    | 'avoa'
    | 'tio'
    | 'tia'
    | 'outro';

  @IsOptional()
  @IsBoolean()
  is_financial_responsible?: boolean;

  @IsOptional()
  @IsBoolean()
  is_emergency_contact?: boolean;

  @IsOptional()
  @IsBoolean()
  lives_with?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
