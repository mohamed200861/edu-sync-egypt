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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attended_at: string
          attended_on: string
          course_id: string | null
          created_at: string
          device: string
          group_id: string | null
          id: string
          operator_id: string | null
          status: string
          student_user_id: string
          teacher_id: string | null
          type: string
        }
        Insert: {
          attended_at?: string
          attended_on?: string
          course_id?: string | null
          created_at?: string
          device?: string
          group_id?: string | null
          id?: string
          operator_id?: string | null
          status?: string
          student_user_id: string
          teacher_id?: string | null
          type?: string
        }
        Update: {
          attended_at?: string
          attended_on?: string
          course_id?: string | null
          created_at?: string
          device?: string
          group_id?: string | null
          id?: string
          operator_id?: string | null
          status?: string
          student_user_id?: string
          teacher_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          id: boolean
          mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          academic_year_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_settings: {
        Row: {
          academic_year_id: string | null
          course_id: string | null
          created_at: string
          id: string
          monthly_fee: number
          notes: string | null
          scope: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          monthly_fee: number
          notes?: string | null
          scope: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          monthly_fee?: number
          notes?: string | null
          scope?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_settings_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_settings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_settings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          academic_year_id: string | null
          capacity: number | null
          course_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          academic_year_id?: string | null
          capacity?: number | null
          course_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          academic_year_id?: string | null
          capacity?: number | null
          course_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          enabled: boolean
          id: string
          name_ar: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          enabled?: boolean
          id?: string
          name_ar: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name_ar?: string
          sort_order?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          charge_id: string | null
          created_at: string
          discount: number
          id: string
          method_code: string
          notes: string | null
          operator_id: string | null
          paid_at: string
          payment_method_id: string | null
          receipt_no: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          charge_id?: string | null
          created_at?: string
          discount?: number
          id?: string
          method_code: string
          notes?: string | null
          operator_id?: string | null
          paid_at?: string
          payment_method_id?: string | null
          receipt_no: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          charge_id?: string | null
          created_at?: string
          discount?: number
          id?: string
          method_code?: string
          notes?: string | null
          operator_id?: string | null
          paid_at?: string
          payment_method_id?: string | null
          receipt_no?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "student_monthly_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          must_change_password: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receipt_counters: {
        Row: {
          last_no: number
          year: number
        }
        Insert: {
          last_no?: number
          year: number
        }
        Update: {
          last_no?: number
          year?: number
        }
        Relationships: []
      }
      secretaries: {
        Row: {
          created_at: string
          hire_date: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hire_date?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hire_date?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      student_monthly_charges: {
        Row: {
          academic_year_id: string | null
          amount_due: number
          amount_paid: number
          course_id: string | null
          created_at: string
          discount: number
          group_id: string | null
          id: string
          notes: string | null
          period_month: number
          period_year: number
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          amount_due?: number
          amount_paid?: number
          course_id?: string | null
          created_at?: string
          discount?: number
          group_id?: string | null
          id?: string
          notes?: string | null
          period_month: number
          period_year: number
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          amount_due?: number
          amount_paid?: number
          course_id?: string | null
          created_at?: string
          discount?: number
          group_id?: string | null
          id?: string
          notes?: string | null
          period_month?: number
          period_year?: number
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_monthly_charges_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_monthly_charges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_monthly_charges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_monthly_charges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_qr_tokens: {
        Row: {
          active: boolean
          created_at: string
          id: string
          issued_by: string | null
          revoked_at: string | null
          student_user_id: string
          token: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          issued_by?: string | null
          revoked_at?: string | null
          student_user_id: string
          token: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          issued_by?: string | null
          revoked_at?: string | null
          student_user_id?: string
          token?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          academic_year_id: string | null
          address: string | null
          course_id: string | null
          date_of_birth: string | null
          email: string | null
          enrolled_at: string
          enrolled_by: string | null
          gender: string | null
          group_id: string | null
          id: string
          parent_phone: string | null
          status: string
          student_code: string
          student_phone: string | null
          user_id: string
        }
        Insert: {
          academic_year_id?: string | null
          address?: string | null
          course_id?: string | null
          date_of_birth?: string | null
          email?: string | null
          enrolled_at?: string
          enrolled_by?: string | null
          gender?: string | null
          group_id?: string | null
          id?: string
          parent_phone?: string | null
          status?: string
          student_code: string
          student_phone?: string | null
          user_id: string
        }
        Update: {
          academic_year_id?: string | null
          address?: string | null
          course_id?: string | null
          date_of_birth?: string | null
          email?: string | null
          enrolled_at?: string
          enrolled_by?: string | null
          gender?: string | null
          group_id?: string | null
          id?: string
          parent_phone?: string | null
          status?: string
          student_code?: string
          student_phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          hire_date: string | null
          id: string
          specialization: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          hire_date?: string | null
          id?: string
          specialization?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          hire_date?: string | null
          id?: string
          specialization?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_owner: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_owner?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_owner?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_student_charges: {
        Args: { _student_id: string; _up_to?: string }
        Returns: number
      }
      get_monthly_fee: { Args: { _student_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      next_receipt_no: { Args: { _year: number }; Returns: string }
      next_student_code: { Args: never; Returns: string }
      recompute_charge_status: {
        Args: { _charge_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "secretary" | "teacher" | "student"
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
      app_role: ["admin", "secretary", "teacher", "student"],
    },
  },
} as const
