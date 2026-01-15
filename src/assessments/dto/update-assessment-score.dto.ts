import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAssessmentScoreDto } from './create-assessment-score.dto';

export class UpdateAssessmentScoreDto extends PartialType(
  OmitType(CreateAssessmentScoreDto, ['enrollment_id'] as const),
) {}
