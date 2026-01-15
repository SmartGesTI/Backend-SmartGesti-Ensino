import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateStaffSchoolProfileDto } from './create-staff-school-profile.dto';

export class UpdateStaffSchoolProfileDto extends PartialType(
  OmitType(CreateStaffSchoolProfileDto, ['school_id'] as const),
) {}
