import { IsEnum } from 'class-validator';

export class UpdateOwnerDto {
  @IsEnum(['owner', 'co-owner'], {
    message: 'ownership_level must be either "owner" or "co-owner"',
  })
  ownership_level: 'owner' | 'co-owner';
}
