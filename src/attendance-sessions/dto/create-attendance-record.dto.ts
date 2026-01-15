import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsIn,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAttendanceRecordDto {
  @IsUUID()
  enrollment_id: string;

  @IsIn(['present', 'absent', 'late', 'excused'])
  attendance_status: 'present' | 'absent' | 'late' | 'excused';

  @IsOptional()
  @IsInt()
  @Min(0)
  minutes_late?: number;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BulkRecordItemDto {
  @IsUUID()
  enrollment_id: string;

  @IsIn(['present', 'absent', 'late', 'excused'])
  attendance_status: 'present' | 'absent' | 'late' | 'excused';

  @IsOptional()
  @IsInt()
  @Min(0)
  minutes_late?: number;

  @IsOptional()
  @IsString()
  justification?: string;
}

export class BulkCreateRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkRecordItemDto)
  records: BulkRecordItemDto[];
}
