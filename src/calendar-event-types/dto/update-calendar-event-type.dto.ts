import { PartialType } from '@nestjs/mapped-types';
import { CreateCalendarEventTypeDto } from './create-calendar-event-type.dto';

export class UpdateCalendarEventTypeDto extends PartialType(
  CreateCalendarEventTypeDto,
) {}
