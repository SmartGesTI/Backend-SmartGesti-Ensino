import { IsUUID, IsOptional } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  role_id: string;

  @IsUUID()
  @IsOptional()
  school_id?: string;
}
