/**
 * Tipos do schema público do Supabase alinhados com `supabase/init.sql`
 * (formato compatível com `supabase gen types typescript`).
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          user_type: string | null;
          interests: string[] | null;
          bio: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          phone?: string | null;
          user_type?: string | null;
          interests?: string[] | null;
          bio?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          user_type?: string | null;
          interests?: string[] | null;
          bio?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      animals: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          species: string;
          size: string;
          approximate_age: string;
          sex: string;
          description: string | null;
          health_notes: string | null;
          special_care: string | null;
          status: string;
          neighborhood: string;
          city: string;
          region: string | null;
          latitude: number | null;
          longitude: number | null;
          moderation_status: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          owner_id: string;
          name: string;
          species: string;
          size: string;
          approximate_age: string;
          sex: string;
          description?: string | null;
          health_notes?: string | null;
          special_care?: string | null;
          status?: string;
          neighborhood: string;
          city: string;
          region?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          moderation_status?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          species?: string;
          size?: string;
          approximate_age?: string;
          sex?: string;
          description?: string | null;
          health_notes?: string | null;
          special_care?: string | null;
          status?: string;
          neighborhood?: string;
          city?: string;
          region?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          moderation_status?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      animal_photos: {
        Row: {
          id: string;
          animal_id: string;
          local_path: string | null;
          remote_url: string;
          is_main: boolean | null;
          upload_status: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          animal_id: string;
          local_path?: string | null;
          remote_url: string;
          is_main?: boolean | null;
          upload_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          animal_id?: string;
          local_path?: string | null;
          remote_url?: string;
          is_main?: boolean | null;
          upload_status?: string | null;
          created_at?: string;
        };
      };
      animal_tombstones: {
        Row: {
          animal_id: string;
          reason: 'DELETED' | 'HIDDEN';
          removed_at: string;
        };
        Insert: {
          animal_id: string;
          reason?: 'DELETED' | 'HIDDEN';
          removed_at?: string;
        };
        Update: {
          animal_id?: string;
          reason?: 'DELETED' | 'HIDDEN';
          removed_at?: string;
        };
      };
      favorites: {
        Row: {
          user_id: string;
          animal_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          animal_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          animal_id?: string;
          created_at?: string;
        };
      };
      adoption_interests: {
        Row: {
          id: string;
          user_id: string;
          animal_id: string;
          message: string | null;
          contact_phone: string | null;
          contact_name: string | null;
          contact_email: string | null;
          status: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          user_id: string;
          animal_id: string;
          message?: string | null;
          contact_phone?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          animal_id?: string;
          message?: string | null;
          contact_phone?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
    };
  };
}

export type PublicTableName = keyof Database['public']['Tables'];
