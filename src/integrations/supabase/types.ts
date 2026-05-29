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
      app_settings: {
        Row: {
          currency: string | null
          id: string
          language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          currency?: string | null
          id?: string
          language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          currency?: string | null
          id?: string
          language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_delete_otp_codes: {
        Row: {
          commission_type: string
          created_at: string | null
          expires_at: string
          id: string
          month: number
          otp_code: string
          period: number | null
          record_ids: string[]
          target_id: string
          target_name: string
          used: boolean | null
          user_id: string
          year: number
        }
        Insert: {
          commission_type: string
          created_at?: string | null
          expires_at: string
          id?: string
          month: number
          otp_code: string
          period?: number | null
          record_ids: string[]
          target_id: string
          target_name: string
          used?: boolean | null
          user_id: string
          year: number
        }
        Update: {
          commission_type?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          month?: number
          otp_code?: string
          period?: number | null
          record_ids?: string[]
          target_id?: string
          target_name?: string
          used?: boolean | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      commission_payments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          total_amount: number
          total_units: number
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          total_amount: number
          total_units: number
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_amount?: number
          total_units?: number
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_prepaid_packages: {
        Row: {
          amount_paid: number
          company_id: string
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          product_id: string
          remaining_units: number
          total_units: number
          unit_price: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          amount_paid?: number
          company_id: string
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id: string
          remaining_units: number
          total_units: number
          unit_price: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          amount_paid?: number
          company_id?: string
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string
          remaining_units?: number
          total_units?: number
          unit_price?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_prepaid_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prepaid_packages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prepaid_packages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prepaid_packages_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_prices: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          notes: string | null
          product_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_name: string | null
          category: Database["public"]["Enums"]["customer_category"] | null
          company_id: string
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          email: string | null
          facade_photo_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          category?: Database["public"]["Enums"]["customer_category"] | null
          company_id: string
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email?: string | null
          facade_photo_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          category?: Database["public"]["Enums"]["customer_category"] | null
          company_id?: string
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email?: string | null
          facade_photo_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      delete_otp_codes: {
        Row: {
          created_at: string
          delete_all: boolean | null
          expires_at: string
          id: string
          order_ids: string[] | null
          otp_code: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delete_all?: boolean | null
          expires_at: string
          id?: string
          order_ids?: string[] | null
          otp_code: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          delete_all?: boolean | null
          expires_at?: string
          id?: string
          order_ids?: string[] | null
          otp_code?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      distributor_credit_usage: {
        Row: {
          company_id: string
          created_at: string
          credit_id: string
          id: string
          notes: string | null
          quantity: number
          registered_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          credit_id: string
          id?: string
          notes?: string | null
          quantity: number
          registered_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          credit_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributor_credit_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_credit_usage_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "distributor_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      distributor_credits: {
        Row: {
          amount_paid: number
          company_id: string
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          notes: string | null
          package_name: string
          purchase_date: string
          remaining_credits: number
          total_credits: number
          updated_at: string
        }
        Insert: {
          amount_paid: number
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          package_name: string
          purchase_date?: string
          remaining_credits: number
          total_credits: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          package_name?: string
          purchase_date?: string
          remaining_credits?: number
          total_credits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributor_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      distributor_empty_containers: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          quantity: number
          registered_at: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          quantity: number
          registered_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          registered_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributor_empty_containers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_empty_containers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_requests: {
        Row: {
          company_id: string
          created_at: string
          customer_address: string | null
          customer_name: string
          document_number: string
          document_type: string
          id: string
          invoice_file_url: string | null
          order_id: string
          receipt_type: string
          sent_at: string | null
          sent_via: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_address?: string | null
          customer_name: string
          document_number: string
          document_type: string
          id?: string
          invoice_file_url?: string | null
          order_id: string
          receipt_type: string
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          document_number?: string
          document_type?: string
          id?: string
          invoice_file_url?: string | null
          order_id?: string
          receipt_type?: string
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operarios: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          customer_latitude: number | null
          customer_longitude: number | null
          customer_name: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_photo_url: string | null
          delivery_pin: string | null
          id: string
          notes: string | null
          repartidor_id: string | null
          repartidor_name: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          tracking_code: string | null
          updated_at: string
          vendedor_id: string | null
          vendedor_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_latitude?: number | null
          customer_longitude?: number | null
          customer_name: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_photo_url?: string | null
          delivery_pin?: string | null
          id?: string
          notes?: string | null
          repartidor_id?: string | null
          repartidor_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          tracking_code?: string | null
          updated_at?: string
          vendedor_id?: string | null
          vendedor_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_latitude?: number | null
          customer_longitude?: number | null
          customer_name?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_photo_url?: string | null
          delivery_pin?: string | null
          id?: string
          notes?: string | null
          repartidor_id?: string | null
          repartidor_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          tracking_code?: string | null
          updated_at?: string
          vendedor_id?: string | null
          vendedor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "repartidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_production: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          requested_by: string
          requested_by_name: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          requested_by: string
          requested_by_name?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          requested_by?: string
          requested_by_name?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      prepaid_package_usages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          order_id: string
          package_id: string
          quantity_used: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          order_id: string
          package_id: string
          quantity_used: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          order_id?: string
          package_id?: string
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "prepaid_package_usages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_package_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_package_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_package_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_package_usages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "customer_prepaid_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      product_edit_otp_codes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          pending_changes: Json
          product_id: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          pending_changes: Json
          product_id: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          pending_changes?: Json
          product_id?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_edit_otp_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_delete_otp_codes: {
        Row: {
          created_at: string
          delete_all: boolean | null
          expires_at: string
          id: string
          otp_code: string
          production_ids: string[] | null
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delete_all?: boolean | null
          expires_at: string
          id?: string
          otp_code: string
          production_ids?: string[] | null
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          delete_all?: boolean | null
          expires_at?: string
          id?: string
          otp_code?: string
          production_ids?: string[] | null
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      production_history: {
        Row: {
          company_id: string
          id: string
          notes: string | null
          produced_at: string
          produced_by: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          company_id: string
          id?: string
          notes?: string | null
          produced_at?: string
          produced_by?: string | null
          product_id: string
          quantity: number
        }
        Update: {
          company_id?: string
          id?: string
          notes?: string | null
          produced_at?: string
          produced_by?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_recipes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          input_product_id: string
          is_active: boolean
          output_product_id: string
          quantity_ratio: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          input_product_id: string
          is_active?: boolean
          output_product_id: string
          quantity_ratio?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          input_product_id?: string
          is_active?: boolean
          output_product_id?: string
          quantity_ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_recipes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_recipes_input_product_id_fkey"
            columns: ["input_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_recipes_output_product_id_fkey"
            columns: ["output_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_waste: {
        Row: {
          company_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          reason: string | null
          registered_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          registered_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_waste_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_waste_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          commission_amount: number
          company_id: string
          created_at: string
          id: string
          min_stock: number
          name: string
          notes: string | null
          operario_commission_amount: number
          price: number
          product_type: string
          repartidor_commission_amount: number
          reserved_stock: number
          sku: string
          stock: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          commission_amount?: number
          company_id: string
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          notes?: string | null
          operario_commission_amount?: number
          price?: number
          product_type?: string
          repartidor_commission_amount?: number
          reserved_stock?: number
          sku: string
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          commission_amount?: number
          company_id?: string
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          notes?: string | null
          operario_commission_amount?: number
          price?: number
          product_type?: string
          repartidor_commission_amount?: number
          reserved_stock?: number
          sku?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          product_id: string
          product_name: string
          product_sku: string
          purchase_id: string
          quantity: number
          stock_updated: boolean
          subtotal: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          product_sku: string
          purchase_id: string
          quantity: number
          stock_updated?: boolean
          subtotal?: number
          unit_cost: number
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          product_sku?: string
          purchase_id?: string
          quantity?: number
          stock_updated?: boolean
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          includes_tax: boolean
          issue_date: string
          notes: string | null
          receipt_number: string
          receipt_series: string | null
          receipt_type: string
          status: string
          subtotal: number
          supplier_id: string
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          includes_tax?: boolean
          issue_date?: string
          notes?: string | null
          receipt_number: string
          receipt_series?: string | null
          receipt_type?: string
          status?: string
          subtotal?: number
          supplier_id: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          includes_tax?: boolean
          issue_date?: string
          notes?: string | null
          receipt_number?: string
          receipt_series?: string | null
          receipt_type?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      repartidores: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string | null
          zone: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
          zone?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repartidores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      restore_otp_codes: {
        Row: {
          backup_data: Json
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          selected_tables: string[]
          used: boolean | null
          user_id: string
        }
        Insert: {
          backup_data: Json
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          selected_tables: string[]
          used?: boolean | null
          user_id: string
        }
        Update: {
          backup_data?: Json
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          selected_tables?: string[]
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      reveal_pin_otp_codes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          otp_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          otp_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          otp_code?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_number: string | null
          address: string | null
          bank_name: string | null
          business_name: string | null
          cci: string | null
          city: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          document_type: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          ruc: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          business_name?: string | null
          cci?: string | null
          city?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          ruc?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          business_name?: string | null
          cci?: string | null
          city?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          ruc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_extra_load_items: {
        Row: {
          company_id: string
          id: string
          load_id: string
          product_id: string
          quantity_loaded: number
          quantity_returned: number
          quantity_sold: number
        }
        Insert: {
          company_id: string
          id?: string
          load_id: string
          product_id: string
          quantity_loaded?: number
          quantity_returned?: number
          quantity_sold?: number
        }
        Update: {
          company_id?: string
          id?: string
          load_id?: string
          product_id?: string
          quantity_loaded?: number
          quantity_returned?: number
          quantity_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "truck_extra_load_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_extra_load_items_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "truck_extra_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_extra_load_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_extra_loads: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          repartidor_id: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          repartidor_id: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          repartidor_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_extra_loads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_extra_loads_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "repartidores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      volume_pricing_rules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          min_quantity: number
          product_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_quantity: number
          product_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_quantity?: number
          product_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volume_pricing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volume_pricing_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_order_history: {
        Row: {
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total: number | null
          tracking_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_address: string | null
          id: string | null
          repartidor_name: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total: number | null
          tracking_code: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      close_truck_extra_load: { Args: { _load_id: string }; Returns: undefined }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_company_stock: {
        Args: { _company_id: string }
        Returns: number
      }
      recalculate_my_company_stock: { Args: never; Returns: number }
    }
    Enums: {
      customer_category: "regular" | "premium" | "vip"
      customer_type: "minorista" | "mayorista" | "distribuidor"
      order_status:
        | "pending"
        | "preparation"
        | "ready"
        | "delivery"
        | "delivered"
        | "cancelled"
        | "backorder"
      user_role: "superadmin" | "admin" | "vendedor" | "repartidor" | "operario"
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
      customer_category: ["regular", "premium", "vip"],
      customer_type: ["minorista", "mayorista", "distribuidor"],
      order_status: [
        "pending",
        "preparation",
        "ready",
        "delivery",
        "delivered",
        "cancelled",
        "backorder",
      ],
      user_role: ["superadmin", "admin", "vendedor", "repartidor", "operario"],
    },
  },
} as const
