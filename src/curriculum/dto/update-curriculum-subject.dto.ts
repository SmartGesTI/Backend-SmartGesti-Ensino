import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCurriculumSubjectDto } from './create-curriculum-subject.dto';

export class UpdateCurriculumSubjectDto extends PartialType(
  OmitType(CreateCurriculumSubjectDto, ['subject_id'] as const),
) {}
