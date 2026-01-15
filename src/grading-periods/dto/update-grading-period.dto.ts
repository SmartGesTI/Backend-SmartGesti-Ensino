import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateGradingPeriodDto } from './create-grading-period.dto';

export class UpdateGradingPeriodDto extends PartialType(
  OmitType(CreateGradingPeriodDto, ['school_id', 'academic_year_id'] as const),
) {}
