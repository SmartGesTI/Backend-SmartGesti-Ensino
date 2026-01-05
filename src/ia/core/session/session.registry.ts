import { Injectable, Logger } from '@nestjs/common';
import { SessionType, SessionFactory, SessionConfig } from './session.types';
import { CoreSession } from './session.types';

/**
 * Registry para registro de tipos de sessão
 */
@Injectable()
export class SessionRegistry {
  private readonly logger = new Logger(SessionRegistry.name);
  private readonly factories: Map<SessionType, SessionFactory> = new Map();

  /**
   * Registra um factory de sessão
   */
  register(type: SessionType, factory: SessionFactory): void {
    if (this.factories.has(type)) {
      this.logger.warn(
        `Factory de sessão ${type} já está registrado. Substituindo...`,
      );
    }

    this.factories.set(type, factory);
    this.logger.log(`Factory de sessão registrado: ${type}`);
  }

  /**
   * Obtém um factory de sessão
   */
  get(type: SessionType): SessionFactory | null {
    return this.factories.get(type) || null;
  }

  /**
   * Verifica se um tipo de sessão está registrado
   */
  has(type: SessionType): boolean {
    return this.factories.has(type);
  }

  /**
   * Lista todos os tipos de sessão registrados
   */
  listTypes(): SessionType[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Cria uma sessão usando o factory registrado
   */
  async create(
    type: SessionType,
    config: SessionConfig,
  ): Promise<CoreSession> {
    const factory = this.factories.get(type);

    if (!factory) {
      throw new Error(`Tipo de sessão não registrado: ${type}`);
    }

    return await factory(config);
  }
}
