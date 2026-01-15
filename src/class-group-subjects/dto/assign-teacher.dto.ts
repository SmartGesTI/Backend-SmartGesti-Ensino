import { IsOptional, IsUUID } from 'class-validator';

export class AssignTeacherDto {
  @IsOptional()
  @IsUUID()
  primary_staff_school_profile_id?: string | null;
}
