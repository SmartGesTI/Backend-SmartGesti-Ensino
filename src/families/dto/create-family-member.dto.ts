import { IsUUID, IsIn } from 'class-validator';

export class CreateFamilyMemberDto {
  @IsUUID()
  person_id: string;

  @IsIn(['guardian', 'student', 'other'])
  member_role: 'guardian' | 'student' | 'other';
}
