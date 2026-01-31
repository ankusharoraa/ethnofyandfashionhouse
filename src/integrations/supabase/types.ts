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
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          name_hindi?: string | null
          shop_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          name_hindi?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_advance_refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          refund_date: string
          refund_method: Database["public"]["Enums"]["payment_method"]
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          refund_date?: string
          refund_method: Database["public"]["Enums"]["payment_method"]
          shop_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          refund_date?: string
          refund_method?: Database["public"]["Enums"]["payment_method"]
          shop_id?: string
        }
        Relationships: []
      }
      customer_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          credit_amount: number
          customer_id: string
          debit_amount: number
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          reference_id: string | null
          reference_label: string | null
          running_balance: number
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          customer_id: string
          debit_amount?: number
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          reference_id?: string | null
          reference_label?: string | null
          running_balance?: number
          shop_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          customer_id?: string
          debit_amount?: number
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          reference_id?: string | null
          reference_label?: string | null
          running_balance?: number
          shop_id?: string
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
          shop_id: string
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
          shop_id?: string
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
          shop_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          advance_balance: number
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          gstin: string | null
          id: string
          is_deleted: boolean
          name: string
          name_hindi: string | null
          notes: string | null
          outstanding_balance: number
          phone: string | null
          shop_id: string
          state: string | null
          total_purchases: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          advance_balance?: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          name_hindi?: string | null
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          shop_id?: string
          state?: string | null
          total_purchases?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          advance_balance?: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          name_hindi?: string | null
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          shop_id?: string
          state?: string | null
          total_purchases?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_leaves: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          is_deductible: boolean
          leave_date: string
          leave_type: string
          notes: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          is_deductible?: boolean
          leave_date: string
          leave_type: string
          notes?: string | null
          shop_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          is_deductible?: boolean
          leave_date?: string
          leave_type?: string
          notes?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          entry_type: Database["public"]["Enums"]["employee_ledger_entry_type"]
          id: string
          notes: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          entry_type: Database["public"]["Enums"]["employee_ledger_entry_type"]
          id?: string
          notes?: string | null
          shop_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          entry_type?: Database["public"]["Enums"]["employee_ledger_entry_type"]
          id?: string
          notes?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          ledger_id: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          ledger_id?: string | null
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          shop_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          ledger_id?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payments_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "employee_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          advance_balance: number
          created_at: string
          created_by: string | null
          id: string
          joining_date: string
          monthly_salary: number
          name: string
          notes: string | null
          phone: string | null
          salary_due: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          advance_balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          joining_date?: string
          monthly_salary?: number
          name: string
          notes?: string | null
          phone?: string | null
          salary_due?: number
          shop_id?: string
          updated_at?: string
        }
        Update: {
          advance_balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          joining_date?: string
          monthly_salary?: number
          name?: string
          notes?: string | null
          phone?: string | null
          salary_due?: number
          shop_id?: string
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
          shop_id: string
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
          shop_id?: string
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
          shop_id?: string
          sku_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          calculated_discount: number
          cgst_amount: number
          cost_price: number | null
          created_at: string
          discount_amount_per_unit: number
          discount_percent: number
          discount_total_amount: number
          discount_type: string | null
          gst_rate: number
          hsn_code: string | null
          id: string
          igst_amount: number
          invoice_id: string
          length_metres: number | null
          line_total: number
          mrp: number | null
          price_type: Database["public"]["Enums"]["price_type"]
          quantity: number | null
          rate: number | null
          sell_price: number | null
          sgst_amount: number
          shop_id: string
          sku_code: string
          sku_id: string
          sku_name: string
          taxable_value: number
          unit_price: number
        }
        Insert: {
          calculated_discount?: number
          cgst_amount?: number
          cost_price?: number | null
          created_at?: string
          discount_amount_per_unit?: number
          discount_percent?: number
          discount_total_amount?: number
          discount_type?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id: string
          length_metres?: number | null
          line_total: number
          mrp?: number | null
          price_type: Database["public"]["Enums"]["price_type"]
          quantity?: number | null
          rate?: number | null
          sell_price?: number | null
          sgst_amount?: number
          shop_id?: string
          sku_code: string
          sku_id: string
          sku_name: string
          taxable_value?: number
          unit_price: number
        }
        Update: {
          calculated_discount?: number
          cgst_amount?: number
          cost_price?: number | null
          created_at?: string
          discount_amount_per_unit?: number
          discount_percent?: number
          discount_total_amount?: number
          discount_type?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id?: string
          length_metres?: number | null
          line_total?: number
          mrp?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          quantity?: number | null
          rate?: number | null
          sell_price?: number | null
          sgst_amount?: number
          shop_id?: string
          sku_code?: string
          sku_id?: string
          sku_name?: string
          taxable_value?: number
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
      invoice_number_counters: {
        Row: {
          counter: number
          day: string
          shop_id: string
        }
        Insert: {
          counter: number
          day: string
          shop_id: string
        }
        Update: {
          counter?: number
          day?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_number_counters_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          shop_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          advance_applied: number
          amount_paid: number
          bank_account: string | null
          cgst_amount: number
          created_at: string
          created_by: string | null
          customer_gstin: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number
          gst_pricing_mode: string
          id: string
          igst_amount: number
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes: string | null
          parent_invoice_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pending_amount: number
          place_of_supply_state: string | null
          returned_amount: number
          round_off_amount: number
          sgst_amount: number
          shop_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          supplier_gstin: string | null
          supplier_id: string | null
          supplier_invoice_date: string | null
          supplier_invoice_no: string | null
          supplier_name: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          advance_applied?: number
          amount_paid?: number
          bank_account?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          customer_gstin?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          gst_pricing_mode?: string
          id?: string
          igst_amount?: number
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          parent_invoice_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pending_amount?: number
          place_of_supply_state?: string | null
          returned_amount?: number
          round_off_amount?: number
          sgst_amount?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          supplier_gstin?: string | null
          supplier_id?: string | null
          supplier_invoice_date?: string | null
          supplier_invoice_no?: string | null
          supplier_name?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          advance_applied?: number
          amount_paid?: number
          bank_account?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          customer_gstin?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          gst_pricing_mode?: string
          id?: string
          igst_amount?: number
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          parent_invoice_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pending_amount?: number
          place_of_supply_state?: string | null
          returned_amount?: number
          round_off_amount?: number
          sgst_amount?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          supplier_gstin?: string | null
          supplier_id?: string | null
          supplier_invoice_date?: string | null
          supplier_invoice_no?: string | null
          supplier_name?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_shop_id: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_shop_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_shop_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shop_members: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
          shop_id: string
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
          shop_id?: string
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
          shop_id?: string
          shop_name_hindi?: string | null
          state?: string | null
          tagline?: string | null
          terms_and_conditions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      skus: {
        Row: {
          barcode: string | null
          base_name: string | null
          category_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          fixed_price: number | null
          gst_rate: number
          hsn_code: string | null
          id: string
          image_url: string | null
          is_deleted: boolean
          length_metres: number
          low_stock_threshold: number
          name: string
          name_hindi: string | null
          parent_sku_id: string | null
          price_type: Database["public"]["Enums"]["price_type"]
          purchase_fixed_price: number | null
          purchase_rate: number | null
          quantity: number
          rate: number | null
          shop_id: string
          sku_code: string
          subcategory_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          barcode?: string | null
          base_name?: string | null
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          fixed_price?: number | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          length_metres?: number
          low_stock_threshold?: number
          name: string
          name_hindi?: string | null
          parent_sku_id?: string | null
          price_type?: Database["public"]["Enums"]["price_type"]
          purchase_fixed_price?: number | null
          purchase_rate?: number | null
          quantity?: number
          rate?: number | null
          shop_id?: string
          sku_code: string
          subcategory_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          barcode?: string | null
          base_name?: string | null
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          fixed_price?: number | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          length_metres?: number
          low_stock_threshold?: number
          name?: string
          name_hindi?: string | null
          parent_sku_id?: string | null
          price_type?: Database["public"]["Enums"]["price_type"]
          purchase_fixed_price?: number | null
          purchase_rate?: number | null
          quantity?: number
          rate?: number | null
          shop_id?: string
          sku_code?: string
          subcategory_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
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
            foreignKeyName: "skus_parent_sku_id_fkey"
            columns: ["parent_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
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
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_type"]
          shop_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          shop_id?: string
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
          shop_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          name_hindi?: string | null
          shop_id?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          name_hindi?: string | null
          shop_id?: string
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
      supplier_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          credit_amount: number
          debit_amount: number
          entry_type: Database["public"]["Enums"]["supplier_ledger_entry_type"]
          id: string
          reference_id: string | null
          reference_label: string | null
          running_balance: number
          shop_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          debit_amount?: number
          entry_type: Database["public"]["Enums"]["supplier_ledger_entry_type"]
          id?: string
          reference_id?: string | null
          reference_label?: string | null
          running_balance?: number
          shop_id?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          debit_amount?: number
          entry_type?: Database["public"]["Enums"]["supplier_ledger_entry_type"]
          id?: string
          reference_id?: string | null
          reference_label?: string | null
          running_balance?: number
          shop_id?: string
          supplier_id?: string
        }
        Relationships: []
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
          shop_id: string
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
          shop_id?: string
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
          shop_id?: string
          supplier_id?: string
        }
        Relationships: []
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
          shop_id: string
          state: string | null
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
          shop_id?: string
          state?: string | null
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
          shop_id?: string
          state?: string | null
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
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_profiles: {
        Args: never
        Returns: {
          current_shop_id: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      append_customer_ledger: {
        Args: {
          p_credit?: number
          p_customer_id: string
          p_debit?: number
          p_entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          p_reference_id?: string
          p_reference_label?: string
        }
        Returns: undefined
      }
      append_supplier_ledger: {
        Args: {
          p_credit?: number
          p_debit?: number
          p_entry_type: Database["public"]["Enums"]["supplier_ledger_entry_type"]
          p_reference_id?: string
          p_reference_label?: string
          p_supplier_id: string
        }
        Returns: undefined
      }
      complete_invoice_split: {
        Args: {
          p_advance_used?: number
          p_card?: number
          p_cash?: number
          p_confirm_overpay?: boolean
          p_credit?: number
          p_customer_id?: string
          p_invoice_id: string
          p_upi?: number
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
      current_shop_id: { Args: never; Returns: string }
      dead_stock_analysis: {
        Args: {
          p_as_of: string
          p_fast_days: number
          p_never_sold_dead_days: number
          p_slow_days: number
        }
        Returns: Json
      }
      ensure_user_bootstrap: {
        Args: { p_full_name?: string; p_user_id: string }
        Returns: undefined
      }
      generate_invoice_number: { Args: never; Returns: string }
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
      has_role_in_shop: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _shop_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_shop_member: { Args: { _shop_id: string }; Returns: boolean }
      is_user_in_current_shop: { Args: { _user_id: string }; Returns: boolean }
      profit_per_sku_report: {
        Args: {
          p_cost_basis: string
          p_from: string
          p_revenue_mode: string
          p_to: string
        }
        Returns: Json
      }
      purchase_recommendations_report: {
        Args: {
          p_as_of: string
          p_horizon_days: number
          p_lookback_days: number
        }
        Returns: Json
      }
      record_customer_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_notes?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
      record_supplier_payment: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_supplier_id: string
        }
        Returns: Json
      }
      refund_customer_advance: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_notes?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "staff"
      employee_ledger_entry_type:
        | "salary"
        | "advance_given"
        | "salary_paid"
        | "adjustment"
      invoice_status: "draft" | "completed" | "cancelled"
      invoice_type: "sale" | "purchase" | "return"
      ledger_entry_type: "sale" | "payment" | "return" | "adjustment"
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
      supplier_ledger_entry_type: "purchase" | "payment" | "adjustment"
      sync_status: "synced" | "pending" | "offline"
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
      employee_ledger_entry_type: [
        "salary",
        "advance_given",
        "salary_paid",
        "adjustment",
      ],
      invoice_status: ["draft", "completed", "cancelled"],
      invoice_type: ["sale", "purchase", "return"],
      ledger_entry_type: ["sale", "payment", "return", "adjustment"],
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
      supplier_ledger_entry_type: ["purchase", "payment", "adjustment"],
      sync_status: ["synced", "pending", "offline"],
    },
  },
} as const
