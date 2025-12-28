import { IsEmail, IsUUID, IsOptional } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsUUID()
  role_id: string;

  @IsUUID()
  @IsOptional()
  school_id?: string;

  @IsUUID()
  @IsOptional()
  permission_group_id?: string;
}
