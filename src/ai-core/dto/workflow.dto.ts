import {
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowStepDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  agent?: string;

  @IsOptional()
  @IsString()
  tool?: string;

  @IsOptional()
  @IsObject()
  input?: any;
}

export class WorkflowDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['sequential', 'parallel', 'orchestrator', 'evaluator-optimizer'])
  pattern: 'sequential' | 'parallel' | 'orchestrator' | 'evaluator-optimizer';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[];

  @IsOptional()
  @IsObject()
  context?: {
    tenantId: string;
    userId: string;
    schoolId?: string;
    data?: Record<string, any>;
  };
}
