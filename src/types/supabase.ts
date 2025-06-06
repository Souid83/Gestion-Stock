export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          is_admin: boolean | null
        }
        Insert: {
          created_at?: string | null
          id: string
          is_admin?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
        }
        Relationships: []
      }
      interface_bolt: {
        Row: {
          code: string
          created_at: string | null
          id: string
          version: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          version: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          version?: string
        }
        Relationships: []
      }
      interface_files: {
        Row: {
          content: string
          created_at: string | null
          id: string
          name: string
          path: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          name: string
          path: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          path?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          brand: string
          created_at: string | null
          id: string
          model: string
          type: string
          updated_at: string | null
        }
        Insert: {
          brand: string
          created_at?: string | null
          id?: string
          model: string
          type: string
          updated_at?: string | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          id?: string
          model?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stats: {
        Row: {
          created_at: string | null
          id: string
          synced_products: number
          total_orders: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          synced_products?: number
          total_orders?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          synced_products?: number
          total_orders?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      product_stocks: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number | null
          stock_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          stock_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          stock_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          capacity: string
          color: string
          created_at: string | null
          grade: string
          id: string
          updated_at: string | null
        }
        Insert: {
          capacity: string
          color: string
          created_at?: string | null
          grade: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          capacity?: string
          color?: string
          created_at?: string | null
          grade?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          battery_level: number | null
          battery_percentage: number | null
          category_brand: string | null
          category_id: string | null
          category_model: string | null
          category_type: string | null
          created_at: string | null
          depth_cm: number | null
          description: string | null
          ean: string | null
          height_cm: number | null
          id: string
          images: string[] | null
          imei: string | null
          is_parent: boolean | null
          location: string | null
          name: string
          parent_id: string | null
          pro_margin: number | null
          pro_margin_net: number | null
          pro_price: number
          pro_price_ht: number | null
          pro_price_ttc: number | null
          product_note: string | null
          purchase_price: number | null
          purchase_price_2: number | null
          purchase_price_with_fees: number
          raw_purchase_price: number | null
          retail_margin: number | null
          retail_margin_net: number | null
          retail_price: number
          retail_price_ht: number | null
          retail_price_ttc: number | null
          selected_stock: string | null
          serial_number: string | null
          shipping_box_id: string | null
          sku: string
          stock: number
          stock_alert: number | null
          stock_id: string | null
          stock_total: number | null
          supplier: string | null
          total_stock: number | null
          updated_at: string | null
          variants: Json | null
          vat_type: string | null
          warranty_sticker: string | null
          weight_grams: number
          width_cm: number | null
        }
        Insert: {
          battery_level?: number | null
          battery_percentage?: number | null
          category_brand?: string | null
          category_id?: string | null
          category_model?: string | null
          category_type?: string | null
          created_at?: string | null
          depth_cm?: number | null
          description?: string | null
          ean?: string | null
          height_cm?: number | null
          id?: string
          images?: string[] | null
          imei?: string | null
          is_parent?: boolean | null
          location?: string | null
          name: string
          parent_id?: string | null
          pro_margin?: number | null
          pro_margin_net?: number | null
          pro_price?: number
          pro_price_ht?: number | null
          pro_price_ttc?: number | null
          product_note?: string | null
          purchase_price?: number | null
          purchase_price_2?: number | null
          purchase_price_with_fees?: number
          raw_purchase_price?: number | null
          retail_margin?: number | null
          retail_margin_net?: number | null
          retail_price?: number
          retail_price_ht?: number | null
          retail_price_ttc?: number | null
          selected_stock?: string | null
          serial_number?: string | null
          shipping_box_id?: string | null
          sku: string
          stock?: number
          stock_alert?: number | null
          stock_id?: string | null
          stock_total?: number | null
          supplier?: string | null
          total_stock?: number | null
          updated_at?: string | null
          variants?: Json | null
          vat_type?: string | null
          warranty_sticker?: string | null
          weight_grams?: number
          width_cm?: number | null
        }
        Update: {
          battery_level?: number | null
          battery_percentage?: number | null
          category_brand?: string | null
          category_id?: string | null
          category_model?: string | null
          category_type?: string | null
          created_at?: string | null
          depth_cm?: number | null
          description?: string | null
          ean?: string | null
          height_cm?: number | null
          id?: string
          images?: string[] | null
          imei?: string | null
          is_parent?: boolean | null
          location?: string | null
          name?: string
          parent_id?: string | null
          pro_margin?: number | null
          pro_margin_net?: number | null
          pro_price?: number
          pro_price_ht?: number | null
          pro_price_ttc?: number | null
          product_note?: string | null
          purchase_price?: number | null
          purchase_price_2?: number | null
          purchase_price_with_fees?: number
          raw_purchase_price?: number | null
          retail_margin?: number | null
          retail_margin_net?: number | null
          retail_price?: number
          retail_price_ht?: number | null
          retail_price_ttc?: number | null
          selected_stock?: string | null
          serial_number?: string | null
          shipping_box_id?: string | null
          sku?: string
          stock?: number
          stock_alert?: number | null
          stock_id?: string | null
          stock_total?: number | null
          supplier?: string | null
          total_stock?: number | null
          updated_at?: string | null
          variants?: Json | null
          vat_type?: string | null
          warranty_sticker?: string | null
          weight_grams?: number
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shipping_box_id_fkey"
            columns: ["shipping_box_id"]
            isOneToOne: false
            referencedRelation: "shipping_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_metrics: {
        Row: {
          created_at: string | null
          estimated_profit: number
          id: number
          metric_type: string
          period: string
          product_name: string
          revenue: number
          sales_count: number
          target: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_profit?: number
          id?: number
          metric_type: string
          period: string
          product_name: string
          revenue?: number
          sales_count?: number
          target?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_profit?: number
          id?: number
          metric_type?: string
          period?: string
          product_name?: string
          revenue?: number
          sales_count?: number
          target?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      serial_product_margin_history: {
        Row: {
          id: number
          marge_numeraire: number
          marge_percent: number
          modified_at: string | null
          modified_by: string | null
          serial_product_id: string
        }
        Insert: {
          id?: number
          marge_numeraire: number
          marge_percent: number
          modified_at?: string | null
          modified_by?: string | null
          serial_product_id: string
        }
        Update: {
          id?: number
          marge_numeraire?: number
          marge_percent?: number
          modified_at?: string | null
          modified_by?: string | null
          serial_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_serial_product"
            columns: ["serial_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      serial_product_margin_last: {
        Row: {
          marge_numeraire: number | null
          marge_percent: number | null
          modified_at: string | null
          pro_marge_numeraire: number | null
          pro_marge_percent: number | null
          serial_product_id: string
        }
        Insert: {
          marge_numeraire?: number | null
          marge_percent?: number | null
          modified_at?: string | null
          pro_marge_numeraire?: number | null
          pro_marge_percent?: number | null
          serial_product_id: string
        }
        Update: {
          marge_numeraire?: number | null
          marge_percent?: number | null
          modified_at?: string | null
          pro_marge_numeraire?: number | null
          pro_marge_percent?: number | null
          serial_product_id?: string
        }
        Relationships: []
      }
      serial_products: {
        Row: {
          battery_level: number
          created_at: string | null
          id: string
          product_id: string | null
          product_note: string | null
          serial_number: string
          supplier: string
          updated_at: string | null
        }
        Insert: {
          battery_level: number
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_note?: string | null
          serial_number: string
          supplier: string
          updated_at?: string | null
        }
        Update: {
          battery_level?: number
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_note?: string | null
          serial_number?: string
          supplier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serial_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_boxes: {
        Row: {
          created_at: string | null
          depth_cm: number
          height_cm: number
          id: string
          name: string
          updated_at: string | null
          width_cm: number
        }
        Insert: {
          created_at?: string | null
          depth_cm: number
          height_cm: number
          id?: string
          name: string
          updated_at?: string | null
          width_cm: number
        }
        Update: {
          created_at?: string | null
          depth_cm?: number
          height_cm?: number
          id?: string
          name?: string
          updated_at?: string | null
          width_cm?: number
        }
        Relationships: []
      }
      stock_groups: {
        Row: {
          created_at: string | null
          id: string
          name: string
          synchronizable: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          synchronizable?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          synchronizable?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_locations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_produit: {
        Row: {
          created_at: string | null
          id: string
          produit_id: string | null
          quantite: number | null
          stock_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          produit_id?: string | null
          quantite?: number | null
          stock_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          produit_id?: string | null
          quantite?: number | null
          stock_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_produit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_produit_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          created_at: string | null
          group_id: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stocks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "stock_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// --- Types personnalisés pour le système de stock partagé ---

// Table shared_stocks
export type SharedStock = {
  id: string
  quantity: number
  updated_at: string
}

// Vue products_with_stock
export type ProductWithStock = Tables<'products'> & {
  shared_quantity: number
}

// Ajout du champ shared_stock_id à Product (pour usage direct)
export type Product = Tables<'products'> & {
  shared_stock_id?: string | null
}
