/**
 * Local lot types decoupled from generated Database typings.
 * This avoids compile errors when the generated schema doesn't include
 * custom tables/views like lots or lots_with_components.
 */

export interface Lot {
  id: string;
  name: string;
  sku: string;
  type: 'simple' | 'compose';
  quantity_per_lot: number;
  // Removed old margin_ht. Lots now store independent percent margins:
  margin_pro_percent: number | null;
  margin_retail_percent: number | null;
  purchase_price_ht: number;
  selling_price_ht: number;
  selling_price_ttc: number;
  stock: number;
  stock_alert: number | null;
  location: string | null;
  vat_type: 'normal' | 'margin';
  created_at?: string | null;
  updated_at?: string | null;
}

// Insert payload for creating a lot (server will compute some fields)
export type LotInsert = Omit<Lot, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

// Partial update payload
export type LotUpdate = Partial<Omit<Lot, 'id'>> & { id?: string };

// Lot component row
export interface LotComponent {
  id: string;
  lot_id: string;
  product_id: string;
  quantity: number;
  depots_utilises: string[]; // JSON array in DB
}

// Insert/update payloads for components
export type LotComponentInsert = Omit<LotComponent, 'id'>;
export type LotComponentUpdate = Partial<Omit<LotComponent, 'id'>> & { id?: string };

// Extended lot with joined components (shape used by lots_with_components view)
export interface LotWithComponents extends Lot {
  components?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    depots_utilises: string[];
    product_name: string;
    product_sku: string;
    product_stock: number;
  }>;
}

// Form data used by LotModal/create flow
export interface LotFormData {
  name: string;
  sku: string;
  type: 'simple' | 'compose';
  quantity_per_lot: number;
  stock_alert: number;
  location: string;
  vat_type: 'normal' | 'margin';
  margin_pro_percent: number;
  margin_retail_percent: number;
  components: Array<{
    product_id: string;
    quantity: number;
    depots_utilises: string[];
  }>;
}

// CSV import row schema
export interface LotCSVRow {
  sku_parent: string;
  quantite_par_lot: number;
  marge: number; // now interpreted as percent (retail)
  sku_lot?: string;
  nom_lot?: string;
}
