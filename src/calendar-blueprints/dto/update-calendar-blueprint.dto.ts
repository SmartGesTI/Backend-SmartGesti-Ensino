import { PartialType } from '@nestjs/mapped-types';
import { CreateCalendarBlueprintDto } from './create-calendar-blueprint.dto';

export class UpdateCalendarBlueprintDto extends PartialType(
  CreateCalendarBlueprintDto,
) {}
