import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CoreTool, CoreToolConfig } from './tool.types';
import { CoreContext } from '../context/context.types';
import { ToolFactory } from './tool.factory';

/**
 * Builder para construção de tools complexas
 */
@Injectable()
export class ToolBuilder<TContext extends CoreContext = CoreContext> {
  private config: Partial<CoreToolConfig<TContext>> = {};

  constructor(private readonly toolFactory: ToolFactory) {}

  /**
   * Define o nome da tool
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Define a descrição da tool
   */
  withDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  /**
   * Define os parâmetros da tool (Zod schema)
   */
  withParameters(parameters: z.ZodType<any>): this {
    this.config.parameters = parameters;
    return this;
  }

  /**
   * Define a função de execução da tool
   */
  withExecute(
    execute: (
      params: any,
      context: any,
    ) => Promise<any>,
  ): this {
    this.config.execute = execute;
    return this;
  }

  /**
   * Define a categoria da tool
   */
  withCategory(category: string): this {
    this.config.category = category;
    return this;
  }

  /**
   * Adiciona tags
   */
  withTags(tags: string[]): this {
    this.config.tags = tags;
    return this;
  }

  /**
   * Define a versão da tool
   */
  withVersion(version: string): this {
    this.config.version = version;
    return this;
  }

  /**
   * Constrói e retorna a tool
   */
  build(): CoreTool<TContext> {
    if (!this.config.name) {
      throw new Error('Nome da tool é obrigatório');
    }

    if (!this.config.description) {
      throw new Error('Descrição da tool é obrigatória');
    }

    if (!this.config.parameters) {
      throw new Error('Parâmetros da tool são obrigatórios');
    }

    if (!this.config.execute) {
      throw new Error('Função execute da tool é obrigatória');
    }

    return this.toolFactory.create(this.config as CoreToolConfig<TContext>);
  }

  /**
   * Reseta o builder para criar uma nova tool
   */
  reset(): this {
    this.config = {};
    return this;
  }
}
