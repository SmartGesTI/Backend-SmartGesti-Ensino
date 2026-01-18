import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Tipos validos para shape e border style
const VALID_SHAPES = ['square', 'rounded', 'circle', 'diamond'] as const;
const VALID_BORDER_STYLES = ['solid', 'dashed'] as const;

// Cores validas da paleta
const VALID_COLORS = [
  'white',
  'gray-200',
  'gray-500',
  'red-500',
  'orange-500',
  'amber-500',
  'yellow-500',
  'lime-500',
  'green-500',
  'emerald-500',
  'cyan-500',
  'blue-500',
  'indigo-500',
  'purple-500',
  'pink-500',
] as const;

class BorderConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsEnum(VALID_BORDER_STYLES, {
    message: 'style deve ser "solid" ou "dashed"',
  })
  style: (typeof VALID_BORDER_STYLES)[number];
}

class DisplayConfigDto {
  @IsString()
  @IsNotEmpty()
  background_color: string;

  @IsString()
  @IsNotEmpty()
  text_color: string;

  @IsEnum(VALID_SHAPES, {
    message: 'shape deve ser "square", "rounded", "circle" ou "diamond"',
  })
  shape: (typeof VALID_SHAPES)[number];

  @ValidateNested()
  @Type(() => BorderConfigDto)
  border: BorderConfigDto;
}

export class CreateCalendarDayTypeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message:
      'slug deve comecar com letra minuscula e conter apenas letras, numeros e hifen',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  affects_instruction: boolean;

  @IsBoolean()
  @IsOptional()
  is_shared?: boolean;

  @ValidateNested()
  @Type(() => DisplayConfigDto)
  @IsObject()
  display_config: DisplayConfigDto;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(1000)
  order_index?: number;

  @IsBoolean()
  @IsOptional()
  is_visible_in_legend?: boolean;
}

// Exportar constantes para uso em validacoes
export { VALID_SHAPES, VALID_BORDER_STYLES, VALID_COLORS };
