import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCurriculumDto } from './create-curriculum.dto';

export class UpdateCurriculumDto extends PartialType(
  OmitType(CreateCurriculumDto, [
    'school_id',
    'academic_year_id',
    'grade_level_id',
  ] as const),
) {}
