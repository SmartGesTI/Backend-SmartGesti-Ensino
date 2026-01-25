import {
  IsInt,
  IsOptional,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class UpdateWizardDto {
  @IsInt()
  @Min(1)
  @Max(7)
  wizard_step: number;

  @IsObject()
  @IsOptional()
  wizard_data?: Record<string, unknown>;
}

export class CompleteWizardDto {
  @IsObject()
  @IsOptional()
  final_data?: Record<string, unknown>;
}
