import { PartialType } from '@nestjs/mapped-types';
import { CreateBlueprintDayDto } from './create-blueprint-day.dto';

export class UpdateBlueprintDayDto extends PartialType(CreateBlueprintDayDto) {}
