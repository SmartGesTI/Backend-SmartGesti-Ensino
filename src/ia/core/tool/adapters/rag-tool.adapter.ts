import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CoreTool } from '../tool.types';
import { CoreContext } from '../../context/context.types';

/**
 * Tipo para tool do RAG
 */
interface RagToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties?: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Adapter para converter tools do RAG para CoreTool
 */
@Injectable()
export class RagToolAdapter {
  private readonly logger = new Logger(RagToolAdapter.name);

  /**
   * Adapta uma tool do RAG para CoreTool
   */
  adapt<TContext extends CoreContext = CoreContext>(
    ragTool: RagToolDefinition,
    executeFn: (params: any, context: any) => Promise<any>,
  ): CoreTool<TContext> {
    // Converter JSON Schema para Zod Schema
    const zodSchema = this.jsonSchemaToZod(ragTool.function.parameters);

    return {
      name: ragTool.function.name,
      description: ragTool.function.description,
      parameters: zodSchema,
      execute: async (params: any, runContext) => {
        const context = (runContext as any).context || runContext;
        return await executeFn(params, context);
      },
      category: 'rag',
      tags: ['rag', 'adapter'],
    };
  }

  /**
   * Converte JSON Schema para Zod Schema
   */
  private jsonSchemaToZod(jsonSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  }): z.ZodSchema {
    if (!jsonSchema || jsonSchema.type === undefined) {
      return z.any();
    }

    if (jsonSchema.type === 'object') {
      const shape: Record<string, z.ZodSchema> = {};
      if (jsonSchema.properties) {
        for (const [key, value] of Object.entries(jsonSchema.properties)) {
          shape[key] = this.propertyToZod(value as any);
          // Tornar opcional se não estiver em required
          if (
            !jsonSchema.required ||
            !jsonSchema.required.includes(key)
          ) {
            shape[key] = shape[key].optional();
          }
        }
      }
      return z.object(shape);
    }

    return z.any();
  }

  /**
   * Converte uma propriedade JSON Schema para Zod
   */
  private propertyToZod(property: any): z.ZodSchema {
    switch (property.type) {
      case 'string':
        if (property.enum) {
          return z.enum(property.enum);
        }
        return z.string();
      case 'number':
      case 'integer':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        const itemsSchema = property.items
          ? this.propertyToZod(property.items)
          : z.any();
        return z.array(itemsSchema);
      default:
        return z.any();
    }
  }
}
