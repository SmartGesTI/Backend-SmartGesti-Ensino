import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class AddOwnerDto {
  @IsEmail({}, { message: 'Invalid email format' })
  user_email: string;

  @IsOptional()
  @IsEnum(['owner', 'co-owner'], {
    message: 'ownership_level must be either "owner" or "co-owner"',
  })
  ownership_level?: 'owner' | 'co-owner';
}
