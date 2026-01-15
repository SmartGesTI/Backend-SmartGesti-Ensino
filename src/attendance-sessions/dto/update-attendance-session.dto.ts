import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAttendanceSessionDto } from './create-attendance-session.dto';

export class UpdateAttendanceSessionDto extends PartialType(
  OmitType(CreateAttendanceSessionDto, [
    'school_id',
    'academic_year_id',
    'class_group_id',
    'class_group_subject_id',
  ] as const),
) {}
