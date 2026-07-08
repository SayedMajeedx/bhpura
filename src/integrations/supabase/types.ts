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
      activity_logs: {
        Row: {
          action: string
          brand_id: string
          created_at: string
          id: string
          message_ar: string
          message_en: string
          metadata: Json
          order_id: string | null
          product_id: string | null
          user_id: string
          variant_id: string | null
        }
        Insert: {
          action: string
          brand_id: string
          created_at?: string
          id?: string
          message_ar: string
          message_en: string
          metadata?: Json
          order_id?: string | null
          product_id?: string | null
          user_id: string
          variant_id?: string | null
        }
        Update: {
          action?: string
          brand_id?: string
          created_at?: string
          id?: string
          message_ar?: string
          message_en?: string
          metadata?: Json
          order_id?: string | null
          product_id?: string | null
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          about_ar: string | null
          about_en: string | null
          created_at: string
          created_by: string | null
          hero_media: Json
          id: string
          is_active: boolean
          logo_url: string | null
          name_ar: string | null
          name_en: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          about_ar?: string | null
          about_en?: string | null
          created_at?: string
          created_by?: string | null
          hero_media?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar?: string | null
          name_en: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          about_ar?: string | null
          about_en?: string | null
          created_at?: string
          created_by?: string | null
          hero_media?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar?: string | null
          name_en?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string | null
          background_color: string
          benefit_enabled: boolean
          benefit_qr_url: string | null
          brand_id: string
          btn_checkout_bg: string | null
          btn_checkout_fg: string | null
          btn_primary_bg: string | null
          btn_primary_fg: string | null
          btn_secondary_bg: string | null
          btn_secondary_fg: string | null
          business_name: string
          card_enabled: boolean
          cod_enabled: boolean
          created_at: string
          currency: string
          default_tax_rate: number
          delivery_enabled: boolean
          delivery_fee: number
          email: string | null
          font_family: string
          font_size: number
          font_url: string | null
          footer_bg: string | null
          footer_fg: string | null
          footer_note: string | null
          header_bg: string | null
          header_fg: string | null
          heading_color: string | null
          link_color: string | null
          logo_align: string
          logo_height: number
          logo_size: number
          logo_url: string | null
          logo_width: number
          logo_x: number
          logo_y: number
          next_invoice_number: number
          pages: Json
          phone: string | null
          pickup_enabled: boolean
          primary_color: string
          socials: Json
          text_color: string
          updated_at: string
          user_id: string
          vat_number: string | null
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          background_color?: string
          benefit_enabled?: boolean
          benefit_qr_url?: string | null
          brand_id: string
          btn_checkout_bg?: string | null
          btn_checkout_fg?: string | null
          btn_primary_bg?: string | null
          btn_primary_fg?: string | null
          btn_secondary_bg?: string | null
          btn_secondary_fg?: string | null
          business_name?: string
          card_enabled?: boolean
          cod_enabled?: boolean
          created_at?: string
          currency?: string
          default_tax_rate?: number
          delivery_enabled?: boolean
          delivery_fee?: number
          email?: string | null
          font_family?: string
          font_size?: number
          font_url?: string | null
          footer_bg?: string | null
          footer_fg?: string | null
          footer_note?: string | null
          header_bg?: string | null
          header_fg?: string | null
          heading_color?: string | null
          link_color?: string | null
          logo_align?: string
          logo_height?: number
          logo_size?: number
          logo_url?: string | null
          logo_width?: number
          logo_x?: number
          logo_y?: number
          next_invoice_number?: number
          pages?: Json
          phone?: string | null
          pickup_enabled?: boolean
          primary_color?: string
          socials?: Json
          text_color?: string
          updated_at?: string
          user_id: string
          vat_number?: string | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          background_color?: string
          benefit_enabled?: boolean
          benefit_qr_url?: string | null
          brand_id?: string
          btn_checkout_bg?: string | null
          btn_checkout_fg?: string | null
          btn_primary_bg?: string | null
          btn_primary_fg?: string | null
          btn_secondary_bg?: string | null
          btn_secondary_fg?: string | null
          business_name?: string
          card_enabled?: boolean
          cod_enabled?: boolean
          created_at?: string
          currency?: string
          default_tax_rate?: number
          delivery_enabled?: boolean
          delivery_fee?: number
          email?: string | null
          font_family?: string
          font_size?: number
          font_url?: string | null
          footer_bg?: string | null
          footer_fg?: string | null
          footer_note?: string | null
          header_bg?: string | null
          header_fg?: string | null
          heading_color?: string | null
          link_color?: string | null
          logo_align?: string
          logo_height?: number
          logo_size?: number
          logo_url?: string | null
          logo_width?: number
          logo_x?: number
          logo_y?: number
          next_invoice_number?: number
          pages?: Json
          phone?: string | null
          pickup_enabled?: boolean
          primary_color?: string
          socials?: Json
          text_color?: string
          updated_at?: string
          user_id?: string
          vat_number?: string | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string | null
          name_en: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          block: string | null
          brand_id: string
          created_at: string
          customer_id: string
          flat: string | null
          house: string | null
          id: string
          is_default: boolean
          label: string | null
          region: string | null
          road: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          block?: string | null
          brand_id: string
          created_at?: string
          customer_id: string
          flat?: string | null
          house?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          region?: string | null
          road?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          block?: string | null
          brand_id?: string
          created_at?: string
          customer_id?: string
          flat?: string | null
          house?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          region?: string | null
          road?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          auth_user_id: string | null
          block: string | null
          brand_id: string
          city: string | null
          created_at: string
          email: string | null
          flat: string | null
          house: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          region: string | null
          road: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          block?: string | null
          brand_id: string
          city?: string | null
          created_at?: string
          email?: string | null
          flat?: string | null
          house?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          region?: string | null
          road?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          block?: string | null
          brand_id?: string
          city?: string | null
          created_at?: string
          email?: string | null
          flat?: string | null
          house?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          region?: string | null
          road?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      customization_options: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          name: string
          price_delta: number
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          name: string
          price_delta?: number
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          name?: string
          price_delta?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customization_options_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          brand_id: string
          category: string
          created_at: string
          currency: string
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          brand_id: string
          category: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          brand_id?: string
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          api_key: string | null
          base_url: string | null
          brand_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          provider: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          brand_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          provider: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          brand_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          provider?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          brand_id: string
          channel: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          brand_id: string
          channel?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          brand_id?: string
          channel?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          brand_id: string
          created_at: string
          customization_total: number
          customizations: Json
          description: string
          id: string
          line_total: number
          location: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          user_id: string
          variant_id: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          customization_total?: number
          customizations?: Json
          description: string
          id?: string
          line_total?: number
          location?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          user_id: string
          variant_id?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          customization_total?: number
          customizations?: Json
          description?: string
          id?: string
          line_total?: number
          location?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
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
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          advance_paid: number
          brand_id: string
          channel: string
          created_at: string
          currency: string
          customer_id: string | null
          discount: number
          fulfillment_method: string
          id: string
          invoice_number: number
          notes: string | null
          order_date: string
          payment_method: string | null
          payment_status: string
          shipping: number
          shipping_address_id: string | null
          status: string
          stock_deducted: boolean
          stock_snapshot: Json | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_paid?: number
          brand_id: string
          channel?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount?: number
          fulfillment_method?: string
          id?: string
          invoice_number: number
          notes?: string | null
          order_date?: string
          payment_method?: string | null
          payment_status?: string
          shipping?: number
          shipping_address_id?: string | null
          status?: string
          stock_deducted?: boolean
          stock_snapshot?: Json | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          advance_paid?: number
          brand_id?: string
          channel?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount?: number
          fulfillment_method?: string
          id?: string
          invoice_number?: number
          notes?: string | null
          order_date?: string
          payment_method?: string | null
          payment_status?: string
          shipping?: number
          shipping_address_id?: string | null
          status?: string
          stock_deducted?: boolean
          stock_snapshot?: Json | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
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
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          brand_id: string
          color: string | null
          cost_price: number
          created_at: string
          fabric: string | null
          id: string
          product_id: string
          selling_price: number
          size: string | null
          sku: string | null
          stock: number
          stock_incubator: number
          stock_main: number
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand_id: string
          color?: string | null
          cost_price?: number
          created_at?: string
          fabric?: string | null
          id?: string
          product_id: string
          selling_price?: number
          size?: string | null
          sku?: string | null
          stock?: number
          stock_incubator?: number
          stock_main?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand_id?: string
          color?: string | null
          cost_price?: number
          created_at?: string
          fabric?: string | null
          id?: string
          product_id?: string
          selling_price?: number
          size?: string | null
          sku?: string | null
          stock?: number
          stock_incubator?: number
          stock_main?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number | null
          brand_id: string
          category: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          image_url: string | null
          is_active: boolean
          media: Json
          name: string
          name_ar: string | null
          name_en: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_price?: number | null
          brand_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          media?: Json
          name: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_price?: number | null
          brand_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          media?: Json
          name?: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          brand_id: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      brand_public_settings: {
        Row: {
          background_color: string | null
          benefit_enabled: boolean | null
          benefit_qr_url: string | null
          brand_id: string | null
          btn_checkout_bg: string | null
          btn_checkout_fg: string | null
          btn_primary_bg: string | null
          btn_primary_fg: string | null
          btn_secondary_bg: string | null
          btn_secondary_fg: string | null
          business_name: string | null
          card_enabled: boolean | null
          cod_enabled: boolean | null
          currency: string | null
          delivery_enabled: boolean | null
          delivery_fee: number | null
          font_family: string | null
          font_url: string | null
          footer_bg: string | null
          footer_fg: string | null
          footer_note: string | null
          header_bg: string | null
          header_fg: string | null
          heading_color: string | null
          link_color: string | null
          logo_align: string | null
          logo_size: number | null
          logo_url: string | null
          pages: Json | null
          pickup_enabled: boolean | null
          primary_color: string | null
          socials: Json | null
          text_color: string | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_brand: { Args: { _brand_id: string }; Returns: boolean }
      current_brand_id: { Args: never; Returns: string }
      delete_brand: {
        Args: { p_brand_id: string; p_hard?: boolean }
        Returns: Json
      }
      delete_category: { Args: { p_id: string }; Returns: Json }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_brand_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      link_storefront_customer: {
        Args: { p_brand_slug: string; p_name?: string; p_phone?: string }
        Returns: Json
      }
      place_storefront_order:
        | {
            Args: {
              p_brand_slug: string
              p_customer: Json
              p_items: Json
              p_notes?: string
              p_payment_method: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_brand_slug: string
              p_customer: Json
              p_fulfillment?: string
              p_items: Json
              p_notes?: string
              p_payment_method: string
            }
            Returns: Json
          }
      sync_order_stock: { Args: { p_order_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
