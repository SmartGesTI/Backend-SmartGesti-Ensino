import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  Min,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTimeSlotDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  shift_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsInt()
  @Min(1)
  slot_index: number;

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'start_time deve estar no formato HH:MM ou HH:MM:SS',
  })
  start_time: string;

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'end_time deve estar no formato HH:MM ou HH:MM:SS',
  })
  end_time: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
