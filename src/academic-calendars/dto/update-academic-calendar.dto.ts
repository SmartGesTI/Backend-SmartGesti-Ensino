import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAcademicCalendarDto } from './create-academic-calendar.dto';

export class UpdateAcademicCalendarDto extends PartialType(
  OmitType(CreateAcademicCalendarDto, [
    'school_id',
    'academic_year_id',
  ] as const),
) {}
