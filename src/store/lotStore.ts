import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Lot, LotInsert, LotUpdate, LotComponent, LotComponentInsert, LotWithComponents, LotFormData } from '../types/lots';

interface LotStore {
  lots: LotWithComponents[];
  isLoading: boolean;
  error: string | null;
  
  // CRUD operations
  fetchLots: () => Promise<LotWithComponents[]>;
  getLotById: (id: string) => Promise<LotWithComponents | null>;
  createLot: (lotData: LotFormData) => Promise<Lot | null>;
  updateLot: (id: string, updates: LotUpdate) => Promise<Lot | null>;
  deleteLot: (id: string) => Promise<void>;
  
  // Lot operations
  calculateLotStock: (components: Array<{ product_id: string; quantity: number }>) => Promise<number>;
  calculateLotPrices: (components: Array<{ product_id: string; quantity: number }>, marginHT: number, vatType: 'normal' | 'margin') => Promise<{ purchasePriceHT: number; sellingPriceHT: number; sellingPriceTTC: number }>;
  
  // CSV import
  importLotsFromCSV: (csvData: string) => Promise<{ success: boolean; errors: string[] }>;
  
  // Clear error
  clearError: () => void;
}

export const useLotStore = create<LotStore>((set, get) => ({
  lots: [],
  isLoading: false,
  error: null,

  fetchLots: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching lots...');
      const { data, error } = await supabase
        .from('lots_with_components')
        .select('*');

      if (error) throw error;
      
      // Base lots from view
      const lots = (data as any[] || []) as LotWithComponents[];

      // Enrich with stock_alert and location directly from lots table
      if (lots.length > 0) {
        const ids = lots.map((l: any) => l.id).filter(Boolean);
        if (ids.length > 0) {
          const { data: baseLots, error: baseErr } = await supabase
            .from('lots')
            .select('id, stock_alert, location')
            .in('id', ids as any);
          if (!baseErr && Array.isArray(baseLots)) {
            const extras = Object.fromEntries(
              (baseLots as any[]).map((r: any) => [r.id, { stock_alert: r.stock_alert, location: r.location }])
            );
            for (const l of lots as any[]) {
              const extra = extras[l.id];
              if (extra) {
                // Only override if view didn’t provide them (or to ensure freshness)
                l.stock_alert = extra.stock_alert;
                l.location = extra.location;
              }
            }
          }
        }
      }

      console.log(`Fetched ${lots.length} lots (enriched)`);
      set({ lots, isLoading: false });
      return lots;
    } catch (error) {
      console.error('Error fetching lots:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching lots',
        isLoading: false 
      });
      return [];
    }
  },

  getLotById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Fetching lot with ID: ${id}`);
      const { data, error } = await supabase
        .from('lots_with_components')
        .select('*')
        .eq('id', id as any)
        .single();

      if (error) throw error;
      
      let lot = data as any as LotWithComponents;

      // Enrich single lot with stock_alert and location from base table
      const { data: baseLot, error: baseErr } = await supabase
        .from('lots')
        .select('id, stock_alert, location')
        .eq('id', id as any)
        .single();
      if (!baseErr && baseLot) {
        (lot as any).stock_alert = (baseLot as any).stock_alert;
        (lot as any).location = (baseLot as any).location;
      }

      console.log('Lot fetched successfully (enriched):', lot);
      set({ isLoading: false });
      return lot;
    } catch (error) {
      console.error(`Error fetching lot with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while fetching lot with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  createLot: async (lotData: LotFormData) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Creating new lot:', lotData);
      
      // Calculate base purchase price (0€ margin), then derive prices from percents
      const base = await get().calculateLotPrices(
        lotData.components,
        0,
        lotData.vat_type
      );
      const proMarginHT = base.purchasePriceHT * ((lotData.margin_pro_percent ?? 0) / 100);
      const retailMarginHT = base.purchasePriceHT * ((lotData.margin_retail_percent ?? 0) / 100);
      const retailPrices = await get().calculateLotPrices(
        lotData.components,
        retailMarginHT,
        lotData.vat_type
      );
      
      // Calculate stock
      const stock = await get().calculateLotStock(lotData.components);
      
      // Create the lot (try with dual margin columns; fallback if schema not migrated yet)
      let lotResult: any = null;
      let lotError: any = null;
      try {
        const insertPayload: any = {
          name: lotData.name,
          sku: lotData.sku,
          type: lotData.type,
          quantity_per_lot: lotData.quantity_per_lot,
          purchase_price_ht: base.purchasePriceHT,
          selling_price_ht: retailPrices.sellingPriceHT,
          selling_price_ttc: retailPrices.sellingPriceTTC,
          stock: stock,
          stock_alert: lotData.stock_alert,
          location: lotData.location,
          vat_type: lotData.vat_type,
          // Persist dual margin percents for independent pro/retail display
          margin_pro_percent: lotData.margin_pro_percent ?? null,
          margin_retail_percent: lotData.margin_retail_percent ?? null
        };
        const resp = await supabase
          .from('lots')
          .insert([insertPayload] as any)
          .select()
          .single();
        lotResult = resp.data;
        lotError = resp.error;

        // If the DB hasn't been migrated yet (missing columns), retry without them
        if (lotError && (lotError.code === 'PGRST204' || /margin_(pro|retail)_percent/i.test(lotError.message || ''))) {
          console.warn("Margin percent columns not found in schema; retrying insert without them.");
          const fallbackPayload = { ...insertPayload };
          delete (fallbackPayload as any).margin_pro_percent;
          delete (fallbackPayload as any).margin_retail_percent;
          const fallback = await supabase
            .from('lots')
            .insert([fallbackPayload] as any)
            .select()
            .single();
          lotResult = fallback.data;
          lotError = fallback.error;
        }
      } catch (e: any) {
        lotError = e;
      }

      if (lotError) throw lotError;
      
      const newLot = lotResult as Lot;
      
      // Create lot components
      if (lotData.components.length > 0) {
        const { error: componentsError } = await supabase
          .from('lot_components')
          .insert(
            lotData.components.map(component => ({
              lot_id: newLot.id,
              product_id: component.product_id,
              quantity: component.quantity,
              depots_utilises: component.depots_utilises
            })) as any
          );
          
        if (componentsError) throw componentsError;
      }
      
      // Refresh lots list
      await get().fetchLots();
      
      console.log('Lot created successfully:', newLot);
      set({ isLoading: false });
      return newLot;
    } catch (error) {
      console.error('Error creating lot:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while creating the lot',
        isLoading: false 
      });
      return null;
    }
  },

  updateLot: async (id: string, updates: LotUpdate) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating lot with ID ${id}:`, updates);
      // Update lot (retry without dual margin columns if schema isn't migrated yet)
      let updateResp = await supabase
        .from('lots')
        .update(updates as any)
        .eq('id', id as any)
        .select()
        .single();

      if (updateResp.error && (updateResp.error.code === 'PGRST204' || /margin_(pro|retail)_percent/i.test(updateResp.error.message || ''))) {
        console.warn("Margin percent columns not found in schema; retrying update without them.");
        const sanitized: any = { ...updates };
        delete sanitized.margin_pro_percent;
        delete sanitized.margin_retail_percent;
        updateResp = await supabase
          .from('lots')
          .update(sanitized)
          .eq('id', id as any)
          .select()
          .single();
      }

      if (updateResp.error) throw updateResp.error;
      
      const updatedLot = updateResp.data as Lot;
      
      // Refresh lots list
      await get().fetchLots();
      
      console.log('Lot updated successfully:', updatedLot);
      set({ isLoading: false });
      return updatedLot;
    } catch (error) {
      console.error(`Error updating lot with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating lot with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteLot: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting lot with ID: ${id}`);
      const { error } = await supabase
        .from('lots')
        .delete()
        .eq('id', id as any);

      if (error) throw error;
      
      // Refresh lots list
      await get().fetchLots();
      
      console.log(`Lot with ID ${id} deleted successfully`);
      set({ isLoading: false });
    } catch (error) {
      console.error(`Error deleting lot with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting lot with ID ${id}`,
        isLoading: false 
      });
    }
  },

  calculateLotStock: async (components: Array<{ product_id: string; quantity: number }>) => {
    try {
      console.log('Calculating lot stock for components:', components);
      
      if (components.length === 0) return 0;
      
      // Get stock for each component
      const { data: products, error } = await supabase
        .from('products')
        .select('id, stock')
        .in('id', components.map(c => c.product_id) as any);
        
      if (error) throw error;
      const productsAny = (products as any[]) || [];
      
      // Calculate minimum possible lots
      let minStock = Infinity;
      
      for (const component of components) {
        const product = productsAny.find((p: any) => p.id === component.product_id);
        if (product) {
          const possibleLots = Math.floor(product.stock / component.quantity);
          minStock = Math.min(minStock, possibleLots);
        }
      }
      
      const result = minStock === Infinity ? 0 : minStock;
      console.log('Calculated lot stock:', result);
      return result;
    } catch (error) {
      console.error('Error calculating lot stock:', error);
      return 0;
    }
  },

  calculateLotPrices: async (components: Array<{ product_id: string; quantity: number }>, marginHT: number, vatType: 'normal' | 'margin') => {
    try {
      console.log('Calculating lot prices for components:', components, 'margin:', marginHT, 'vatType:', vatType);
      
      if (components.length === 0) {
        return { purchasePriceHT: 0, sellingPriceHT: 0, sellingPriceTTC: 0 };
      }
      
      // Get purchase prices for each component
      const { data: products, error } = await supabase
        .from('products')
        .select('id, purchase_price_with_fees')
        .in('id', components.map(c => c.product_id) as any);
        
      if (error) throw error;
      const productsAny = (products as any[]) || [];
      
      // Calculate total purchase price
      let totalPurchasePrice = 0;
      
      for (const component of components) {
        const product = productsAny.find((p: any) => p.id === component.product_id);
        if (product && product.purchase_price_with_fees) {
          totalPurchasePrice += product.purchase_price_with_fees * component.quantity;
        }
      }
      
      // Calculate selling prices based on VAT type
      let sellingPriceHT: number;
      let sellingPriceTTC: number;
      
      if (vatType === 'margin') {
        // TVA sur marge: Prix TTC = Prix achat + (marge HT * 1.2)
        sellingPriceTTC = totalPurchasePrice + (marginHT * 1.2);
        sellingPriceHT = totalPurchasePrice + marginHT;
      } else {
        // TVA normale: Prix HT = Prix achat + marge, Prix TTC = Prix HT * 1.2
        sellingPriceHT = totalPurchasePrice + marginHT;
        sellingPriceTTC = sellingPriceHT * 1.2;
      }
      
      const result = {
        purchasePriceHT: totalPurchasePrice,
        sellingPriceHT,
        sellingPriceTTC
      };
      
      console.log('Calculated lot prices:', result);
      return result;
    } catch (error) {
      console.error('Error calculating lot prices:', error);
      return { purchasePriceHT: 0, sellingPriceHT: 0, sellingPriceTTC: 0 };
    }
  },

  importLotsFromCSV: async (csvData: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Importing lots from CSV');
      
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Validate headers
      const requiredHeaders = ['sku_parent', 'quantite_par_lot', 'marge'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
      }
      
      const skuParentIndex = headers.indexOf('sku_parent');
      const quantityIndex = headers.indexOf('quantite_par_lot');
      const marginIndex = headers.indexOf('marge');
      const skuLotIndex = headers.indexOf('sku_lot');
      const nomLotIndex = headers.indexOf('nom_lot');
      
      const errors: string[] = [];
      let successCount = 0;
      
      // Process each line (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        const skuParent = values[skuParentIndex]?.trim();
        const quantityStr = values[quantityIndex]?.trim();
        const marginStr = values[marginIndex]?.trim();
        const skuLot = skuLotIndex >= 0 ? values[skuLotIndex]?.trim() : '';
        const nomLot = nomLotIndex >= 0 ? values[nomLotIndex]?.trim() : '';
        
        if (!skuParent || !quantityStr || !marginStr) {
          errors.push(`Line ${i+1}: Missing required fields`);
          continue;
        }
        
        const quantity = parseInt(quantityStr);
        const margin = parseFloat(marginStr);
        
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`Line ${i+1}: Invalid quantity "${quantityStr}"`);
          continue;
        }
        
        if (isNaN(margin) || margin < 0) {
          errors.push(`Line ${i+1}: Invalid margin "${marginStr}"`);
          continue;
        }
        
        // Look up parent product by SKU
        const { data: parentProduct, error: productError } = await supabase
          .from('products')
          .select('id, name, sku, purchase_price_with_fees, stock, is_parent, serial_number, mirror_of')
          .eq('sku', skuParent as any)
          .single();
          
        if (productError || !parentProduct) {
          errors.push(`Line ${i+1}: Product with SKU "${skuParent}" not found`);
          continue;
        }
        
        // Validate product is eligible for lots (prix d'achat unique)
        if (parentProduct.serial_number || parentProduct.mirror_of || !parentProduct.is_parent) {
          errors.push(`Line ${i+1}: Product "${skuParent}" is not eligible for lots (must be single purchase price product)`);
          continue;
        }
        
        // Generate SKU and name if not provided
        const finalSku = skuLot || `LOT${quantity}-${parentProduct.sku}`;
        const finalName = nomLot || `Lot de ${quantity} ${parentProduct.name}`;
        
        // Check if SKU already exists
        const { data: existingLot } = await supabase
          .from('lots')
          .select('id')
          .eq('sku', finalSku as any)
          .single();
          
        if (existingLot) {
          errors.push(`Line ${i+1}: SKU "${finalSku}" already exists`);
          continue;
        }
        
        // Calculate prices (CSV 'marge' is now a retail percent) and stock
        const base = await get().calculateLotPrices(
          [{ product_id: parentProduct.id, quantity }],
          0,
          'normal'
        );
        const retailMarginHT = base.purchasePriceHT * (margin / 100);
        const prices = await get().calculateLotPrices(
          [{ product_id: parentProduct.id, quantity }],
          retailMarginHT,
          'normal'
        );

        const stock = await get().calculateLotStock(
          [{ product_id: parentProduct.id, quantity }]
        );
        
        // Create the lot
        let newLot: any = null;
        let createError: any = null;
        try {
          const insertPayload: any = {
            name: finalName,
            sku: finalSku,
            type: 'simple',
            quantity_per_lot: quantity,
            purchase_price_ht: base.purchasePriceHT,
            selling_price_ht: prices.sellingPriceHT,
            selling_price_ttc: prices.sellingPriceTTC,
            stock: stock,
            stock_alert: 0,
            location: '',
            vat_type: 'normal',
            // Persist CSV 'marge' as retail percent; pro left null so UI can fallback to retail
            margin_pro_percent: null,
            margin_retail_percent: margin
          };
          const resp = await supabase
            .from('lots')
            .insert([insertPayload] as any)
            .select()
            .single();
          newLot = resp.data;
          createError = resp.error;

          // Fallback if columns not present (DB not migrated yet)
          if (createError && (createError.code === 'PGRST204' || /margin_(pro|retail)_percent/i.test(createError.message || ''))) {
            console.warn('Margin percent columns not found in schema; retrying CSV insert without them.');
            const fallbackPayload = { ...insertPayload };
            delete (fallbackPayload as any).margin_pro_percent;
            delete (fallbackPayload as any).margin_retail_percent;
            const fallback = await supabase
              .from('lots')
              .insert([fallbackPayload] as any)
              .select()
              .single();
            newLot = fallback.data;
            createError = fallback.error;
          }
        } catch (e: any) {
          createError = e;
        }

        if (createError) throw createError;
        
        // Create lot component
        // Cast IDs explicitly to satisfy strict Supabase TS generics and avoid never[] on empty arrays
        const lotId: string = (newLot as any)?.id as string;
        const parentId: string = (parentProduct as any)?.id as string;
        const { error: componentError } = await supabase
          .from('lot_components')
          .insert([{
            lot_id: lotId,
            product_id: parentId,
            quantity: quantity,
            depots_utilises: [] as string[]
          }] as any);
          
        if (componentError) throw componentError;
        
        successCount++;
      }
      
      // Refresh lots list
      await get().fetchLots();
      
      set({ isLoading: false });
      console.log(`Imported ${successCount} lots with ${errors.length} errors`);
      return { 
        success: errors.length === 0, 
        errors 
      };
    } catch (error) {
      console.error('Error importing lots from CSV:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while importing lots from CSV',
        isLoading: false 
      });
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  },

  clearError: () => set({ error: null })
}));
