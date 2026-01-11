import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LoggerService } from '../../../common/logger/logger.service';
import { EMBEDDING_CONFIG } from '../constants/rag.constants';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

@Injectable()
export class EmbeddingService {
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Gera embedding para um único texto
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_CONFIG.MODEL,
        input: text,
        dimensions: EMBEDDING_CONFIG.DIMENSIONS,
      });

      return {
        embedding: response.data[0].embedding,
        tokenCount: response.usage.total_tokens,
      };
    } catch (error: any) {
      this.logger.error(
        `Erro ao gerar embedding: ${error.message}`,
        error.stack,
        'EmbeddingService',
      );
      throw error;
    }
  }

  /**
   * Gera embeddings em batch (mais eficiente para múltiplos textos)
   * Seguindo best practice: batch multiple inputs per API call
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const results: EmbeddingResult[] = [];
      
      // Dividir em batches para respeitar limites da API
      for (let i = 0; i < texts.length; i += EMBEDDING_CONFIG.BATCH_SIZE) {
        const batch = texts.slice(i, i + EMBEDDING_CONFIG.BATCH_SIZE);
        
        this.logger.log(
          `Gerando embeddings: batch ${Math.floor(i / EMBEDDING_CONFIG.BATCH_SIZE) + 1}/${Math.ceil(texts.length / EMBEDDING_CONFIG.BATCH_SIZE)}`,
          'EmbeddingService',
        );

        const response = await this.openai.embeddings.create({
          model: EMBEDDING_CONFIG.MODEL,
          input: batch,
          dimensions: EMBEDDING_CONFIG.DIMENSIONS,
        });

        // Calcular tokens por texto (aproximado)
        const tokensPerText = Math.floor(response.usage.total_tokens / batch.length);

        for (const data of response.data) {
          results.push({
            embedding: data.embedding,
            tokenCount: tokensPerText,
          });
        }
      }

      this.logger.log(
        `Embeddings gerados: ${results.length} textos processados`,
        'EmbeddingService',
      );

      return results;
    } catch (error: any) {
      this.logger.error(
        `Erro ao gerar embeddings em batch: ${error.message}`,
        error.stack,
        'EmbeddingService',
      );
      throw error;
    }
  }

  /**
   * Converte array de números para string pgvector
   */
  embeddingToVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Converte string pgvector para array de números
   */
  vectorToEmbedding(vector: string): number[] {
    const cleanVector = vector.replace('[', '').replace(']', '');
    return cleanVector.split(',').map(Number);
  }

  /**
   * Calcula similaridade de cosseno entre dois embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
