import { PartialType } from '@nestjs/mapped-types';
import { CreateGradeLevelDto } from './create-grade-level.dto';

export class UpdateGradeLevelDto extends PartialType(CreateGradeLevelDto) {}
