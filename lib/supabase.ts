import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      pools: {
        Row: {
          id: string
          name: string
          code: string
          created_by: string
          created_at: string
          entry_fee: number | null
          max_players: number | null
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          code: string
          created_by: string
          created_at?: string
          entry_fee?: number | null
          max_players?: number | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          code?: string
          created_by?: string
          created_at?: string
          entry_fee?: number | null
          max_players?: number | null
          is_active?: boolean
        }
      }
      players: {
        Row: {
          id: string
          pool_id: string
          user_id: string
          display_name: string
          joined_at: string
          is_eliminated: boolean
          elimination_round: number | null
        }
        Insert: {
          id?: string
          pool_id: string
          user_id: string
          display_name: string
          joined_at?: string
          is_eliminated?: boolean
          elimination_round?: number | null
        }
        Update: {
          id?: string
          pool_id?: string
          user_id?: string
          display_name?: string
          joined_at?: string
          is_eliminated?: boolean
          elimination_round?: number | null
        }
      }
    }
  }
}