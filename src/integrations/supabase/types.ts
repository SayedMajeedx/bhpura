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
      business_settings: {
        Row: {
          address: string | null
          background_color: string
          business_name: string
          created_at: string
          currency: string
          default_tax_rate: number
          email: string | null
          font_family: string
          font_size: number
          font_url: string | null
          footer_note: string | null
          logo_height: number
          logo_size: number
          logo_url: string | null
          logo_width: number
          logo_x: number
          logo_y: number
          next_invoice_number: number
          phone: string | null
          primary_color: string
          text_color: string
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          background_color?: string
          business_name?: string
          created_at?: string
          currency?: string
          default_tax_rate?: number
          email?: string | null
          font_family?: string
          font_size?: number
          font_url?: string | null
          footer_note?: string | null
          logo_height?: number
          logo_size?: number
          logo_url?: string | null
          logo_width?: number
          logo_x?: number
          logo_y?: number
          next_invoice_number?: number
          phone?: string | null
          primary_color?: string
          text_color?: string
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          background_color?: string
          business_name?: string
          created_at?: string
          currency?: string
          default_tax_rate?: number
          email?: string | null
          font_family?: string
          font_size?: number
          font_url?: string | null
          footer_note?: string | null
          logo_height?: number
          logo_size?: number
          logo_url?: string | null
          logo_width?: number
          logo_x?: number
          logo_y?: number
          next_invoice_number?: number
          phone?: string | null
          primary_color?: string
          text_color?: string
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
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
        Relationships: []
      }
      customization_options: {
        Row: {
          created_at: string
          id: string
          name: string
          price_delta: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price_delta?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price_delta?: number
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
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
          channel?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          customization_total: number
          customizations: Json
          description: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          customization_total?: number
          customizations?: Json
          description: string
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          customization_total?: number
          customizations?: Json
          description?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
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
          created_at: string
          currency: string
          customer_id: string | null
          discount: number
          id: string
          invoice_number: number
          notes: string | null
          order_date: string
          payment_method: string | null
          shipping: number
          shipping_address_id: string | null
          status: string
          stock_deducted: boolean
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount?: number
          id?: string
          invoice_number: number
          notes?: string | null
          order_date?: string
          payment_method?: string | null
          shipping?: number
          shipping_address_id?: string | null
          status?: string
          stock_deducted?: boolean
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount?: number
          id?: string
          invoice_number?: number
          notes?: string | null
          order_date?: string
          payment_method?: string | null
          shipping?: number
          shipping_address_id?: string | null
          status?: string
          stock_deducted?: boolean
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          updated_at: string
          user_id: string
        }
        Insert: {
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
          updated_at?: string
          user_id: string
        }
        Update: {
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
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
