import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class ReplicateFromBlueprintDto {
  @IsUUID()
  @IsNotEmpty()
  blueprint_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
