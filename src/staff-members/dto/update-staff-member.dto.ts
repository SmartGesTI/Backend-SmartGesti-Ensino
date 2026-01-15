import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateStaffMemberDto } from './create-staff-member.dto';

export class UpdateStaffMemberDto extends PartialType(
  OmitType(CreateStaffMemberDto, ['person_id'] as const),
) {}
