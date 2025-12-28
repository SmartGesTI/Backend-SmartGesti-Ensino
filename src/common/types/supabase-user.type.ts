export interface SupabaseUser {
  id: string; // UUID do Supabase (sub do JWT)
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
}
