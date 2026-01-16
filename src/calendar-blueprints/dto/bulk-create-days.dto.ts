import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { CreateBlueprintDayDto } from './create-blueprint-day.dto';

export class BulkCreateDaysDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBlueprintDayDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(400) // ~1 ano escolar completo
  days: CreateBlueprintDayDto[];
}
