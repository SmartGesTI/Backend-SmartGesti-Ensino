import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAttendanceRecordDto } from './create-attendance-record.dto';

export class UpdateAttendanceRecordDto extends PartialType(
  OmitType(CreateAttendanceRecordDto, ['enrollment_id'] as const),
) {}
