import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateAttachmentDto {
  @IsString()
  storage_bucket: string;

  @IsString()
  storage_path: string;

  @IsString()
  filename: string;

  @IsString()
  @IsOptional()
  mime_type?: string;

  @IsNumber()
  @IsOptional()
  size_bytes?: number;

  @IsString()
  @IsOptional()
  classification?: string;

  @IsString()
  @IsOptional()
  checksum_sha256?: string;
}

export class UpdateAttachmentDto extends PartialType(CreateAttachmentDto) {}

export class AttachToMessageDto {
  @IsUUID()
  message_id: string;

  @IsNumber()
  @IsOptional()
  display_order?: number;
}
