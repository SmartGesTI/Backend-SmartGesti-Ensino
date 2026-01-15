import {
  IsOptional,
  IsUUID,
  IsObject,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class CreateLeaderboardSnapshotDto {
  @IsUUID()
  leaderboard_definition_id: string;

  @IsOptional()
  @IsDateString()
  as_of_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  entries_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cohort_size?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ComputeLeaderboardSnapshotDto {
  @IsUUID()
  leaderboard_definition_id: string;

  @IsOptional()
  @IsDateString()
  as_of_date?: string;
}
