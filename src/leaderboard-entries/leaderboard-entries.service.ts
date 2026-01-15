import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { LeaderboardEntry } from '../common/types';

@Injectable()
export class LeaderboardEntriesService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: { snapshotId?: string; limit?: number },
  ): Promise<LeaderboardEntry[]> {
    let query = this.supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('rank', { ascending: true });
    if (options?.snapshotId)
      query = query.eq('leaderboard_snapshot_id', options.snapshotId);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list leaderboard entries: ${error.message}`);
    return (data || []) as LeaderboardEntry[];
  }

  async findBySnapshot(
    snapshotId: string,
    tenantId: string,
    limit?: number,
  ): Promise<LeaderboardEntry[]> {
    return this.findAll(tenantId, { snapshotId, limit: limit ?? 50 });
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<LeaderboardEntry | null> {
    const { data, error } = await this.supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get leaderboard entry: ${error.message}`);
    }
    return data as LeaderboardEntry;
  }

  async findByStudent(
    studentId: string,
    snapshotId: string,
    tenantId: string,
  ): Promise<LeaderboardEntry | null> {
    const { data, error } = await this.supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('student_id', studentId)
      .eq('leaderboard_snapshot_id', snapshotId)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get leaderboard entry: ${error.message}`);
    }
    return data as LeaderboardEntry;
  }
}
