import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAssessmentDto } from './create-assessment.dto';

export class UpdateAssessmentDto extends PartialType(
  OmitType(CreateAssessmentDto, [
    'school_id',
    'academic_year_id',
    'class_group_subject_id',
  ] as const),
) {}
