import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RagChunk } from './rag-chunk.entity';

@Entity('rag_documents')
export class RagDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Index({ unique: true })
  @Column({ type: 'text', name: 'file_path' })
  filePath: string;

  @Index()
  @Column({ type: 'text' })
  category: string;

  @Column({ type: 'text', nullable: true, name: 'route_pattern' })
  routePattern: string | null;

  @Column({ type: 'text', nullable: true, name: 'menu_path' })
  menuPath: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ type: 'text', name: 'content_hash' })
  contentHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RagChunk, (chunk) => chunk.document, { cascade: true })
  chunks: RagChunk[];
}
