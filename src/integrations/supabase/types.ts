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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          name_hindi: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          name_hindi?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          name_hindi?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          name_hindi: string | null
          notes: string | null
          outstanding_balance: number
          phone: string | null
          total_purchases: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          name_hindi?: string | null
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          total_purchases?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          name_hindi?: string | null
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          total_purchases?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_logs: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_length: number | null
          new_quantity: number | null
          notes: string | null
          previous_length: number | null
          previous_quantity: number | null
          sku_id: string
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_length?: number | null
          new_quantity?: number | null
          notes?: string | null
          previous_length?: number | null
          previous_quantity?: number | null
          sku_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_length?: number | null
          new_quantity?: number | null
          notes?: string | null
          previous_length?: number | null
          previous_quantity?: number | null
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          length_metres: number | null
          line_total: number
          price_type: Database["public"]["Enums"]["price_type"]
          quantity: number | null
          rate: number | null
          sku_code: string
          sku_id: string
          sku_name: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          length_metres?: number | null
          line_total: number
          price_type: Database["public"]["Enums"]["price_type"]
          quantity?: number | null
          rate?: number | null
          sku_code: string
          sku_id: string
          sku_name: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          length_metres?: number | null
          line_total?: number
          price_type?: Database["public"]["Enums"]["price_type"]
          quantity?: number | null
          rate?: number | null
          sku_code?: string
          sku_id?: string
          sku_name?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number
          id: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes: string | null
          parent_invoice_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pending_amount: number
          returned_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          supplier_id: string | null
          supplier_name: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          parent_invoice_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pending_amount?: number
          returned_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          parent_invoice_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pending_amount?: number
          returned_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          logo_url: string | null
          phone: string | null
          pincode: string | null
          shop_name: string
          shop_name_hindi: string | null
          state: string | null
          tagline: string | null
          terms_and_conditions: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          pincode?: string | null
          shop_name?: string
          shop_name_hindi?: string | null
          state?: string | null
          tagline?: string | null
          terms_and_conditions?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          pincode?: string | null
          shop_name?: string
          shop_name_hindi?: string | null
          state?: string | null
          tagline?: string | null
          terms_and_conditions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      skus: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          fixed_price: number | null
          id: string
          image_url: string | null
          length_metres: number | null
          low_stock_threshold: number | null
          name: string
          name_hindi: string | null
          price_type: Database["public"]["Enums"]["price_type"]
          quantity: number | null
          rate: number | null
          sku_code: string
          subcategory_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fixed_price?: number | null
          id?: string
          image_url?: string | null
          length_metres?: number | null
          low_stock_threshold?: number | null
          name: string
          name_hindi?: string | null
          price_type?: Database["public"]["Enums"]["price_type"]
          quantity?: number | null
          rate?: number | null
          sku_code: string
          subcategory_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fixed_price?: number | null
          id?: string
          image_url?: string | null
          length_metres?: number | null
          low_stock_threshold?: number | null
          name?: string
          name_hindi?: string | null
          price_type?: Database["public"]["Enums"]["price_type"]
          quantity?: number | null
          rate?: number | null
          sku_code?: string
          subcategory_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skus_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          user_id?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          name_hindi: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          name_hindi?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          name_hindi?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          supplier_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          gstin: string | null
          id: string
          name: string
          name_hindi: string | null
          notes: string | null
          outstanding_balance: number
          phone: string | null
          total_paid: number
          total_purchases: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          name_hindi?: string | null
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          total_paid?: number
          total_purchases?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          name_hindi?: string | null
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          total_paid?: number
          total_purchases?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
      cancel_invoice: { Args: { p_invoice_id: string }; Returns: Json }
      cancel_purchase_invoice: { Args: { p_invoice_id: string }; Returns: Json }
      complete_invoice:
        | {
            Args: {
              p_invoice_id: string
              p_payment_method?: Database["public"]["Enums"]["payment_method"]
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount_paid?: number
              p_customer_id?: string
              p_invoice_id: string
              p_payment_method?: Database["public"]["Enums"]["payment_method"]
            }
            Returns: Json
          }
      complete_purchase_invoice: {
        Args: {
          p_amount_paid?: number
          p_invoice_id: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
      ensure_user_bootstrap: {
        Args: { p_full_name?: string; p_user_id: string }
        Returns: Json
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_returnable_items: {
        Args: { p_invoice_id: string }
        Returns: {
          line_total: number
          original_length: number
          original_quantity: number
          price_type: Database["public"]["Enums"]["price_type"]
          rate: number
          returnable_length: number
          returnable_quantity: number
          returned_length: number
          returned_quantity: number
          sku_code: string
          sku_id: string
          sku_name: string
          unit_price: number
        }[]
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["permission_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      process_invoice_return: {
        Args: {
          p_notes?: string
          p_parent_invoice_id: string
          p_return_items: Json
        }
        Returns: Json
      }
      record_customer_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_notes?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
      record_supplier_payment: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_supplier_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "staff"
      invoice_status: "draft" | "completed" | "cancelled"
      invoice_type: "sale" | "purchase" | "return"
      payment_method: "cash" | "upi" | "card" | "credit"
      permission_type:
        | "sales_bill"
        | "purchase_bill"
        | "stock_edit"
        | "receive_payment"
        | "pay_supplier"
        | "view_reports"
        | "view_profit"
        | "manage_employees"
      price_type: "per_metre" | "fixed"
      sync_status: "synced" | "pending" | "offline"
      user_role: "owner" | "staff"
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
      app_role: ["owner", "staff"],
      invoice_status: ["draft", "completed", "cancelled"],
      invoice_type: ["sale", "purchase", "return"],
      payment_method: ["cash", "upi", "card", "credit"],
      permission_type: [
        "sales_bill",
        "purchase_bill",
        "stock_edit",
        "receive_payment",
        "pay_supplier",
        "view_reports",
        "view_profit",
        "manage_employees",
      ],
      price_type: ["per_metre", "fixed"],
      sync_status: ["synced", "pending", "offline"],
      user_role: ["owner", "staff"],
    },
  },
} as const
