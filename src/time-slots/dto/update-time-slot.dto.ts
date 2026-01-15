import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTimeSlotDto } from './create-time-slot.dto';

export class UpdateTimeSlotDto extends PartialType(
  OmitType(CreateTimeSlotDto, ['school_id', 'shift_id'] as const),
) {}
