import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IngestionService } from './rag/services/ingestion.service';
import { LoggerService } from './common/logger/logger.service';
import { RagDocument, RagChunk } from './rag/entities';
import { EmbeddingService, ChunkService, SearchService } from './rag/services';
import { LoggerModule } from './common/logger/logger.module';
import { SharedModule } from './agents/shared/shared.module';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'db.eazovcqdbarejrhxvjdm.supabase.co',
      port: 5432,
      username: 'postgres',
      password: process.env.SUPABASE_PASSWORD || 'postgres',
      database: 'postgres',
      entities: [RagDocument, RagChunk],
      synchronize: false,
      logging: false,
      ssl: { rejectUnauthorized: false },
    }),
    TypeOrmModule.forFeature([RagDocument, RagChunk]),
    LoggerModule,
    SharedModule,
  ],
  providers: [IngestionService, EmbeddingService, ChunkService, SearchService],
})
class RagCliModule {}

async function bootstrap() {
  const app = await NestFactory.create(RagCliModule);
  const ingestionService = app.get(IngestionService);
  const logger = app.get(LoggerService);
  
  // Aguardar um pouco para garantir que o banco de dados está pronto
  await new Promise(resolve => setTimeout(resolve, 1000));
  

  const command = process.argv[2];
  const subcommand = process.argv[3];

  try {
    if (command === 'rag:ingest') {
      // Caminho para a pasta de documentação
      const docsPath = path.join(
        __dirname,
        '..',
        '..',
        'docs',
        'knowledge-base',
        'pages',
      );

      logger.log(`Iniciando ingestão de documentos de: ${docsPath}`, 'CLI');

      // Ingerir todos os documentos
      const results = await ingestionService.ingestDirectory(docsPath);

      // Resumo dos resultados
      const successful = results.filter((r) => r.success).length;
      const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);

      logger.log(
        `
╔════════════════════════════════════════════╗
║         INGESTÃO CONCLUÍDA COM SUCESSO     ║
╠════════════════════════════════════════════╣
║ Documentos processados: ${results.length}
║ Documentos com sucesso: ${successful}
║ Chunks criados: ${totalChunks}
╚════════════════════════════════════════════╝
      `,
        'CLI',
      );

      // Mostrar detalhes de cada documento
      logger.log('Detalhes dos documentos ingeridos:', 'CLI');
      results.forEach((result) => {
        const status = result.success ? '✓' : '✗';
        logger.log(
          `${status} ${result.title} - ${result.chunksCreated} chunks - ${result.message}`,
          'CLI',
        );
      });
    } else if (command === 'rag:status') {
      const searchService = app.get('SearchService');
      // Importar SearchService corretamente se necessário
      logger.log('Status do RAG não implementado ainda', 'CLI');
    } else {
      logger.log(
        'Comando desconhecido. Use: rag:ingest ou rag:status',
        'CLI',
      );
    }
  } catch (error) {
    logger.error(`Erro ao executar comando: ${error.message}`, error.stack, 'CLI');
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
