import type { DocBlock, DocPageFont, DocVideo } from '@/types'

// Hand-written mirror of supabase/migrations/*.sql. If you regenerate this
// from the CLI later (`supabase gen types typescript`), this file's shape is
// what that command would produce for the `public` schema.
//
// `nook_id` is required (not optional) in every Insert: unlike `user_id` it
// has no `default auth.uid()` to fall back on, so forgetting it is a type
// error rather than a runtime constraint violation.

export interface Database {
  public: {
    Tables: {
      time_blocks: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          item_id: string | null
          title: string
          day: string
          start_minute: number
          end_minute: number
          color: string | null
          kind: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          item_id?: string | null
          title: string
          day: string
          start_minute: number
          end_minute: number
          color?: string | null
          kind?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['time_blocks']['Insert']>
        Relationships: []
      }
      nooks: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          icon?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['nooks']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string
          avatar_url: string | null
          active_nook_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name: string
          avatar_url?: string | null
          active_nook_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      folders: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          name: string
          icon: string | null
          color: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          name: string
          icon?: string | null
          color?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['folders']['Insert']>
        Relationships: []
      }
      items: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          folder_id: string | null
          type: 'task' | 'note'
          title: string
          content: string | null
          status: 'todo' | 'in_progress' | 'done'
          priority: 'low' | 'medium' | 'high' | null
          due_date: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          folder_id?: string | null
          type: 'task' | 'note'
          title: string
          content?: string | null
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high' | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['items']['Insert']>
        Relationships: []
      }
      item_links: {
        Row: {
          user_id: string
          nook_id: string
          item_id: string
          linked_item_id: string
          created_at: string
        }
        Insert: {
          user_id?: string
          nook_id: string
          item_id: string
          linked_item_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['item_links']['Insert']>
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          theme: string
          accent_color: string | null
          visual_intensity: string
          animations_enabled: boolean
          work_start_time: string
          lunch_start_time: string
          lunch_end_time: string
          work_end_time: string
          extra: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          theme?: string
          accent_color?: string | null
          visual_intensity?: string
          animations_enabled?: boolean
          work_start_time?: string
          lunch_start_time?: string
          lunch_end_time?: string
          work_end_time?: string
          extra?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>
        Relationships: []
      }
      focus_sessions: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          item_id: string | null
          mode: string | null
          planned_duration: number
          actual_duration: number
          started_at: string
          ended_at: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          item_id?: string | null
          mode?: string | null
          planned_duration: number
          actual_duration: number
          started_at: string
          ended_at?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['focus_sessions']['Insert']>
        Relationships: []
      }
      garden_progress: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          xp: number
          level: number
          active_days: number
          last_active_date: string | null
          extra: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          xp?: number
          level?: number
          active_days?: number
          last_active_date?: string | null
          extra?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['garden_progress']['Insert']>
        Relationships: []
      }
      doc_pages: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          parent_id: string | null
          title: string
          icon: string | null
          position: number
          font: DocPageFont
          blocks: DocBlock[]
          videos: DocVideo[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          parent_id?: string | null
          title?: string
          icon?: string | null
          position?: number
          font?: DocPageFont
          blocks?: DocBlock[]
          videos?: DocVideo[]
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['doc_pages']['Insert']>
        Relationships: []
      }
      garden_unlocks: {
        Row: {
          id: string
          user_id: string
          nook_id: string
          element_type: string
          element_key: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nook_id: string
          element_type: string
          element_key: string
          unlocked_at?: string
        }
        Update: Partial<Database['public']['Tables']['garden_unlocks']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_nook: {
        Args: { p_name: string; p_icon?: string | null; p_with_starter_folders?: boolean }
        Returns: string
      }
      nook_of: {
        Args: { p_kind: 'folder' | 'item' | 'doc_page'; p_id: string }
        Returns: string | null
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
