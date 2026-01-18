import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsInt,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_SHAPES = ['square', 'rounded', 'circle', 'diamond'] as const;
const VALID_BORDER_STYLES = ['solid', 'dashed'] as const;

class BorderConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  color?: string;

  @IsEnum(VALID_BORDER_STYLES, {
    message: 'style deve ser "solid" ou "dashed"',
  })
  @IsOptional()
  style?: (typeof VALID_BORDER_STYLES)[number];
}

class PartialDisplayConfigDto {
  @IsString()
  @IsOptional()
  background_color?: string;

  @IsString()
  @IsOptional()
  text_color?: string;

  @IsEnum(VALID_SHAPES, {
    message: 'shape deve ser "square", "rounded", "circle" ou "diamond"',
  })
  @IsOptional()
  shape?: (typeof VALID_SHAPES)[number];

  @ValidateNested()
  @Type(() => BorderConfigDto)
  @IsOptional()
  border?: BorderConfigDto;
}

export class UpdateCalendarDayTypeDto {
  // slug nao pode ser alterado

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  affects_instruction?: boolean;

  @ValidateNested()
  @Type(() => PartialDisplayConfigDto)
  @IsObject()
  @IsOptional()
  display_config?: PartialDisplayConfigDto;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(1000)
  order_index?: number;

  @IsBoolean()
  @IsOptional()
  is_visible_in_legend?: boolean;
}

export class ShareCalendarDayTypeDto {
  @IsBoolean()
  is_shared: boolean;
}
