import { IsString, IsOptional, IsEnum } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsEnum(['ios', 'android', 'web', 'other'])
  @IsOptional()
  device_type?: 'ios' | 'android' | 'web' | 'other';

  @IsString()
  @IsOptional()
  device_name?: string;

  @IsString()
  @IsOptional()
  os_version?: string;

  @IsString()
  @IsOptional()
  app_version?: string;
}
