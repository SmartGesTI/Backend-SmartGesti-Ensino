import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RagDocument } from './rag-document.entity';

@Entity('rag_chunks')
export class RagChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'document_id' })
  documentId: string;

  @Column({ type: 'integer', name: 'chunk_index' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true, name: 'section_title' })
  sectionTitle: string | null;

  // Embedding vector - pgvector type
  // Note: TypeORM não suporta vector nativamente, usamos string e convertemos no SQL
  @Column({ type: 'text', nullable: true, name: 'embedding' })
  embedding: string | null;

  @Column({ type: 'integer', nullable: true, name: 'token_count' })
  tokenCount: number | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => RagDocument, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: RagDocument;
}
