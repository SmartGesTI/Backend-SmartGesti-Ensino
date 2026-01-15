import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateClassGroupSubjectDto } from './create-class-group-subject.dto';

export class UpdateClassGroupSubjectDto extends PartialType(
  OmitType(CreateClassGroupSubjectDto, [
    'school_id',
    'academic_year_id',
    'class_group_id',
    'subject_id',
  ] as const),
) {}
