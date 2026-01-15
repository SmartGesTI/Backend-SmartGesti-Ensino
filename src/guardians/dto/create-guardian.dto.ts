import { IsString, IsOptional, IsUUID, IsIn } from 'class-validator';

export class CreateGuardianDto {
  @IsUUID()
  person_id: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  global_status?: 'active' | 'inactive';
}

export class UpdateGuardianDto {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  global_status?: 'active' | 'inactive';
}
