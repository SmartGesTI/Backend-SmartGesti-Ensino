import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
} from 'class-validator';

export class CreatePersonContactDto {
  @IsIn(['email', 'phone', 'whatsapp', 'other'])
  contact_type: 'email' | 'phone' | 'whatsapp' | 'other';

  @IsString()
  @MaxLength(200)
  value: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class UpdatePersonContactDto {
  @IsOptional()
  @IsIn(['email', 'phone', 'whatsapp', 'other'])
  contact_type?: 'email' | 'phone' | 'whatsapp' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}
