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
      products: {
        Row: {
          id: string
          name: string
          sku: string
          price?: number | null
          stock?: number | null
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
          parent_id?: string | null
          serial_number?: string | null
          purchase_price_with_fees?: number | null
          raw_purchase_price?: number | null
          retail_price?: number | null
          pro_price?: number | null
          battery_level?: number | null
          warranty_sticker?: string | null
          supplier?: string | null
          stock_id?: string | null
          product_note?: string | null
          vat_type?: string | null
          stock_alert?: number | null
          location?: string | null
          images?: string[] | null
          width_cm?: number | null
          height_cm?: number | null
          depth_cm?: number | null
          shipping_box_id?: string | null
          shared_stock_id?: string | null
          stock_total?: number | null
          margin_percent?: number | null
          margin_value?: number | null
          pro_margin_percent?: number | null
          pro_margin_value?: number | null
          // Mirror system fields
          mirror_of?: string | null
          product_type?: 'PAU' | 'PAM' | null
        }
        Insert: {
          id?: string
          name: string
          sku: string
          price?: number | null
          stock?: number | null
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
          parent_id?: string | null
          serial_number?: string | null
          purchase_price_with_fees?: number | null
          raw_purchase_price?: number | null
          retail_price?: number | null
          pro_price?: number | null
          battery_level?: number | null
          warranty_sticker?: string | null
          supplier?: string | null
          stock_id?: string | null
          product_note?: string | null
          vat_type?: string | null
          stock_alert?: number | null
          location?: string | null
          images?: string[] | null
          width_cm?: number | null
          height_cm?: number | null
          depth_cm?: number | null
          shipping_box_id?: string | null
          shared_stock_id?: string | null
          stock_total?: number | null
          margin_percent?: number | null
          margin_value?: number | null
          pro_margin_percent?: number | null
          pro_margin_value?: number | null
          // Mirror system fields
          mirror_of?: string | null
          product_type?: 'PAU' | 'PAM' | null
        }
        Update: {
          id?: string
          name?: string
          sku?: string
          price?: number | null
          stock?: number | null
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
          parent_id?: string | null
          serial_number?: string | null
          purchase_price_with_fees?: number | null
          raw_purchase_price?: number | null
          retail_price?: number | null
          pro_price?: number | null
          battery_level?: number | null
          warranty_sticker?: string | null
          supplier?: string | null
          stock_id?: string | null
          product_note?: string | null
          vat_type?: string | null
          stock_alert?: number | null
          location?: string | null
          images?: string[] | null
          width_cm?: number | null
          height_cm?: number | null
          depth_cm?: number | null
          shipping_box_id?: string | null
          shared_stock_id?: string | null
          stock_total?: number | null
          margin_percent?: number | null
          margin_value?: number | null
          pro_margin_percent?: number | null
          pro_margin_value?: number | null
          // Mirror system fields
          mirror_of?: string | null
          product_type?: 'PAU' | 'PAM' | null
        }
      }
      shared_stocks: {
        Row: {
          id: string
          quantity: number
          updated_at?: string | null
        }
        Insert: {
          id?: string
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          quantity?: number
          updated_at?: string | null
        }
      }
      stocks: {
        Row: {
          id: string
          name: string
          created_at?: string | null
          updated_at?: string | null
          group_id?: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string | null
          updated_at?: string | null
          group_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string | null
          updated_at?: string | null
          group_id?: string | null
        }
      }
      stock_produit: {
        Row: {
          id: string
          produit_id?: string | null
          stock_id?: string | null
          quantite?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Insert: {
          id?: string
          produit_id?: string | null
          stock_id?: string | null
          quantite?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          produit_id?: string | null
          stock_id?: string | null
          quantite?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      stock_groups: {
        Row: {
          id: string
          name: string
          synchronizable?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Insert: {
          id?: string
          name: string
          synchronizable?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          synchronizable?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      clear_products_with_stock: {
        Row: {
          id: string
          name: string
          sku: string
          price?: number | null
          stock?: number | null
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
          parent_id?: string | null
          serial_number?: string | null
          purchase_price_with_fees?: number | null
          raw_purchase_price?: number | null
          retail_price?: number | null
          pro_price?: number | null
          battery_level?: number | null
          warranty_sticker?: string | null
          supplier?: string | null
          stock_id?: string | null
          product_note?: string | null
          vat_type?: string | null
          stock_alert?: number | null
          location?: string | null
          images?: string[] | null
          width_cm?: number | null
          height_cm?: number | null
          depth_cm?: number | null
          shipping_box_id?: string | null
          shared_stock_id?: string | null
          stock_total?: number | null
          margin_percent?: number | null
          margin_value?: number | null
          pro_margin_percent?: number | null
          pro_margin_value?: number | null
          // Mirror system fields
          mirror_of?: string | null
          product_type?: 'PAU' | 'PAM' | null
          shared_quantity?: number | null
          mirror_type?: string | null
          mirror_parent_id?: string | null
          mirror_parent_name?: string | null
          mirror_parent_sku?: string | null
          mirror_children_count?: number | null
          stocks?: Json | null
        }
      }
    }
    Functions: {
      can_have_mirrors: {
        Args: {
          product_id: string
        }
        Returns: boolean
      }
    }
  }
}
