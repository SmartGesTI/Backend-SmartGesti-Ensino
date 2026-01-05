import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CoreTool } from '../tool.types';
import { CoreContext } from '../../context/context.types';
import { Tool as LegacyTool } from '../../../../agents/shared/tools/tool.interface';

/**
 * Adapter para converter tools do sistema legado para CoreTool
 */
@Injectable()
export class LegacyToolAdapter {
  private readonly logger = new Logger(LegacyToolAdapter.name);

  /**
   * Adapta uma tool legada para CoreTool
   */
  adapt<TContext extends CoreContext = CoreContext>(
    legacyTool: LegacyTool,
  ): CoreTool<TContext> {
    // Converter JSON Schema para Zod Schema
    const zodSchema = this.jsonSchemaToZod(legacyTool.parameters);

    return {
      name: legacyTool.name,
      description: legacyTool.description,
      parameters: zodSchema,
      execute: async (params: any, runContext) => {
        // Adaptar contexto legado para novo formato
        const context = (runContext as any).context || runContext;
        const legacyContext = {
          userId: context.userId,
          tenantId: context.tenantId,
          schoolId: context.schoolId,
          permissions: context.permissions,
          supabaseId: context.supabaseId,
          schoolSlug: context.schoolSlug,
          tenantSubdomain: context.tenantSubdomain,
          requestOrigin: context.requestOrigin,
        };

        return await legacyTool.execute(params, legacyContext);
      },
      category: 'legacy',
      tags: ['legacy', 'adapter'],
    };
  }

  /**
   * Converte JSON Schema para Zod Schema (simplificado)
   * Nota: Esta é uma conversão básica. Para schemas complexos, pode ser necessário ajuste manual.
   */
  private jsonSchemaToZod(jsonSchema: Record<string, any>): z.ZodSchema {
    if (!jsonSchema || jsonSchema.type === undefined) {
      return z.any();
    }

    switch (jsonSchema.type) {
      case 'string':
        let stringSchema = z.string();
        if (jsonSchema.enum) {
          return z.enum(jsonSchema.enum);
        }
        return stringSchema;
      case 'number':
      case 'integer':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        const itemsSchema = jsonSchema.items
          ? this.jsonSchemaToZod(jsonSchema.items)
          : z.any();
        return z.array(itemsSchema);
      case 'object':
        const shape: Record<string, z.ZodSchema> = {};
        if (jsonSchema.properties) {
          for (const [key, value] of Object.entries(jsonSchema.properties)) {
            shape[key] = this.jsonSchemaToZod(value as Record<string, any>);
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
      default:
        return z.any();
    }
  }
}
