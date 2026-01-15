import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateStudentSubjectResultDto } from './create-student-subject-result.dto';

export class UpdateStudentSubjectResultDto extends PartialType(
  OmitType(CreateStudentSubjectResultDto, [
    'school_id',
    'academic_year_id',
    'enrollment_id',
    'subject_id',
  ] as const),
) {}
