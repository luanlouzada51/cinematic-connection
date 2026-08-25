export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_swipes: {
        Row: {
          created_at: string
          interested: boolean
          title_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          interested: boolean
          title_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          interested?: boolean
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_swipes_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "title_scores"
            referencedColumns: ["title_id"]
          },
          {
            foreignKeyName: "content_swipes_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          name_en: string
          name_es: string
          name_pt: string
          slug: string
          sort: number
        }
        Insert: {
          name_en: string
          name_es: string
          name_pt: string
          slug: string
          sort?: number
        }
        Update: {
          name_en?: string
          name_es?: string
          name_pt?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      list_items: {
        Row: {
          created_at: string
          list_id: string
          title_id: string
        }
        Insert: {
          created_at?: string
          list_id: string
          title_id: string
        }
        Update: {
          created_at?: string
          list_id?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "title_scores"
            referencedColumns: ["title_id"]
          },
          {
            foreignKeyName: "list_items_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_likes: {
        Row: {
          list_id: string
          user_id: string
        }
        Insert: {
          list_id: string
          user_id: string
        }
        Update: {
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_likes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          flagged: boolean
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          flagged?: boolean
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          flagged?: boolean
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          user_id?: string
        }
        Relationships: []
      }
      person_swipes: {
        Row: {
          created_at: string
          id: string
          liked: boolean
          super_like: boolean
          swiper_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liked: boolean
          super_like?: boolean
          swiper_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liked?: boolean
          super_like?: boolean
          swiper_id?: string
          target_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          genre_slug: string
          id: string
          kind: string
          score: number
          title: string
        }
        Insert: {
          author_id: string
          body?: string
          created_at?: string
          genre_slug: string
          id?: string
          kind: string
          score?: number
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          genre_slug?: string
          id?: string
          kind?: string
          score?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_genre_slug_fkey"
            columns: ["genre_slug"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          allow_matches: boolean
          allow_private_chats: boolean
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string
          favorite_genres: string[]
          gender: string | null
          id: string
          interested_in: string[]
          is_premium: boolean
          language: string
          last_rating_date: string | null
          onboarding_done: boolean
          photos: string[]
          streak_count: number
          taste_vector: Json
          updated_at: string
        }
        Insert: {
          age?: number | null
          allow_matches?: boolean
          allow_private_chats?: boolean
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          favorite_genres?: string[]
          gender?: string | null
          id: string
          interested_in?: string[]
          is_premium?: boolean
          language?: string
          last_rating_date?: string | null
          onboarding_done?: boolean
          photos?: string[]
          streak_count?: number
          taste_vector?: Json
          updated_at?: string
        }
        Update: {
          age?: number | null
          allow_matches?: boolean
          allow_private_chats?: boolean
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          favorite_genres?: string[]
          gender?: string | null
          id?: string
          interested_in?: string[]
          is_premium?: boolean
          language?: string
          last_rating_date?: string | null
          onboarding_done?: boolean
          photos?: string[]
          streak_count?: number
          taste_vector?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          stars: number
          title_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stars: number
          title_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stars?: number
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "title_scores"
            referencedColumns: ["title_id"]
          },
          {
            foreignKeyName: "ratings_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          context: string | null
          created_at: string
          id: string
          reason: string
          reporter_id: string
          target_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          target_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          target_id?: string | null
        }
        Relationships: []
      }
      titles: {
        Row: {
          cast_list: string | null
          country: string | null
          created_at: string
          genre_slugs: string[]
          id: string
          kind: string
          overview: string | null
          poster_url: string | null
          title: string
          year: number | null
        }
        Insert: {
          cast_list?: string | null
          country?: string | null
          created_at?: string
          genre_slugs?: string[]
          id?: string
          kind: string
          overview?: string | null
          poster_url?: string | null
          title: string
          year?: number | null
        }
        Update: {
          cast_list?: string | null
          country?: string | null
          created_at?: string
          genre_slugs?: string[]
          id?: string
          kind?: string
          overview?: string | null
          poster_url?: string | null
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          post_id: string
          user_id: string
          value: number
        }
        Insert: {
          post_id: string
          user_id: string
          value: number
        }
        Update: {
          post_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_parties: {
        Row: {
          created_at: string
          host_id: string
          id: string
          note: string | null
          scheduled_at: string
          title_id: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          note?: string | null
          scheduled_at: string
          title_id: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          note?: string | null
          scheduled_at?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_parties_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "title_scores"
            referencedColumns: ["title_id"]
          },
          {
            foreignKeyName: "watch_parties_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_party_members: {
        Row: {
          party_id: string
          user_id: string
        }
        Insert: {
          party_id: string
          user_id: string
        }
        Update: {
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_party_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          party_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          party_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          party_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_party_messages_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          title_id: string
          user_id: string
          watched: boolean
          watched_at: string | null
        }
        Insert: {
          created_at?: string
          title_id: string
          user_id: string
          watched?: boolean
          watched_at?: string | null
        }
        Update: {
          created_at?: string
          title_id?: string
          user_id?: string
          watched?: boolean
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "title_scores"
            referencedColumns: ["title_id"]
          },
          {
            foreignKeyName: "watchlist_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      title_scores: {
        Row: {
          avg_stars: number | null
          ratings_count: number | null
          title_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_matched_with: { Args: { _other: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
