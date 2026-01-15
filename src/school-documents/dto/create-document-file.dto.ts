import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';

export class CreateDocumentFileDto {
  @IsIn(['attachment', 'generated_pdf', 'signed_pdf', 'image', 'other'])
  file_kind: 'attachment' | 'generated_pdf' | 'signed_pdf' | 'image' | 'other';

  @IsString()
  storage_bucket: string;

  @IsString()
  storage_path: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size_bytes?: number;

  @IsOptional()
  @IsString()
  checksum_sha256?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}
