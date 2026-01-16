import { PartialType } from '@nestjs/mapped-types';
import { CreateBlueprintEventDto } from './create-blueprint-event.dto';

export class UpdateBlueprintEventDto extends PartialType(
  CreateBlueprintEventDto,
) {}
