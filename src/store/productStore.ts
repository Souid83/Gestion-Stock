import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ProductWithStock } from '../types/supabase';
import type { Database } from '../types/supabase-generated';

type Product = ProductWithStock;

type ProductInsert = Database['public']['Tables']['products']['Insert'];

interface ProductStore {
  products: ProductWithStock[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<ProductWithStock[] | null>;
  addProduct: (product: ProductInsert) => Promise<ProductWithStock | null>;
  addSerialChild: (product: ProductInsert) => Promise<ProductWithStock | null>;
  addProducts: (products: ProductInsert[]) => Promise<void>;
  updateProduct: (id: string, updates: Partial<ProductWithStock>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stocks:stock_produit (
            quantite,
            stock:stocks (
              name
            )
          ),
          category:product_categories(
            type,
            brand,
            model
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data as any[]) || [];

      // Regrouper les identifiants de parent pour une récupération en batch
      // Supporte à la fois l'ancien modèle (parent_id) et le nouveau modèle miroirs (mirror_of)
      const parentIds = Array.from(
        new Set(
          rows
            .map((p: any) => p.parent_id ?? (p as any).mirror_of)
            .filter((v: any) => !!v)
        )
      );

      let parentsById: Record<string, any> = {};
      if (parentIds.length > 0) {
        const { data: parents } = await supabase
          .from('products')
          .select(`
            id,
            stock_total,
            stocks:stock_produit (
              quantite,
              stock:stocks (
                name
              )
            )
          `)
          .in('id', parentIds as any);

        (parents || []).forEach((pp: any) => {
          parentsById[pp.id] = pp;
        });
      }

      // Si produit enfant (miroir via mirror_of ou enfant via parent_id) → hérite du stock et stock_total du parent
      const productsWithStocks = rows.map((p: any) => {
        const pid = p.parent_id ?? (p as any).mirror_of;
        if (pid) {
          const parent = parentsById[pid];
          return {
            ...p,
            stocks: parent?.stocks ?? p.stocks,
            stock_total: parent?.stock_total ?? p.stock_total,
          };
        }
        return p;
      }) as ProductWithStock[];

      set({ products: productsWithStocks, isLoading: false });
      return productsWithStocks;
    } catch (error) {
      console.error('Error in fetchProducts:', error);
      
      // Don't show user-facing error for AbortError (benign cancellation)
      if (error instanceof Error && error.name === 'AbortError') {
        set({ isLoading: false });
      } else {
        set({ 
          error: error instanceof Error ? error.message : 'An error occurred while fetching products',
          isLoading: false 
        });
      }
      return null;
    }
  },

  addSerialChild: async (product: ProductInsert) => {
    set({ isLoading: true, error: null });
    try {
      // Insert as a serialized child as-is: do not traverse to root parent, do not copy parent fields,
      // ensure is_parent is false and serial_number remains intact.
      const payload: any = { ...product, is_parent: false };

      const { data, error } = await supabase
        .from('products')
        .insert([payload as any])
        .select(`
          *,
          category:product_categories(
            type,
            brand,
            model
          )
        `)
        .single();

      if (error) throw error;

      const products = get().products;
      set({ products: [data as unknown as ProductWithStock, ...products], isLoading: false });
      return data as unknown as ProductWithStock;
    } catch (error) {
      console.error('Error in addSerialChild:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding the serial child product',
        isLoading: false 
      });
      return null;
    }
  },

  addProduct: async (product: ProductInsert) => {
    set({ isLoading: true, error: null });
    try {
      // If a serial number is provided, treat as a serialized child and delegate to addSerialChild
      const serial = (product as any).serial_number;
      if (serial && String(serial).trim() !== '') {
        return await get().addSerialChild({ ...product, is_parent: false } as ProductInsert);
      }
      let insertPayload: any = { ...product };

      // Si parent_id est fourni → création d'un miroir (nouveau modèle: utiliser mirror_of)
      if (product.parent_id) {
        // Récupérer le parent initial
        const { data: initialParent, error: parentErr } = await supabase
          .from('products')
          .select('*')
          .eq('id', product.parent_id as any)
          .single();
        if (parentErr || !initialParent) {
          throw parentErr || new Error('Parent product not found');
        }

        // Résoudre le parent racine (interdit miroir de miroir)
        let root: any = initialParent as unknown as any;
        while (root && root.parent_id) {
          const { data: next } = await supabase
            .from('products')
            .select('*')
            .eq('id', root.parent_id as any)
            .single();
          const nextAny = next as unknown as any;
          if (!nextAny) break;
          root = nextAny;
        }

        // Construire le payload: copier le parent sauf sku/name, forcer serial_number NULL
        insertPayload = {
          name: product.name,
          sku: product.sku,
          description: root.description,
          purchase_price_with_fees: root.purchase_price_with_fees,
          raw_purchase_price: root.raw_purchase_price,
          retail_price: root.retail_price,
          pro_price: root.pro_price,
          weight_grams: root.weight_grams,
          ean: root.ean,
          stock_alert: root.stock_alert,
          location: root.location,
          vat_type: root.vat_type,
          margin_percent: root.margin_percent,
          margin_value: root.margin_value,
          pro_margin_percent: root.pro_margin_percent,
          pro_margin_value: root.pro_margin_value,
          width_cm: root.width_cm,
          height_cm: root.height_cm,
          depth_cm: root.depth_cm,
          category_id: root.category_id,
          images: root.images,
          variants: root.variants,
          shipping_box_id: root.shipping_box_id,
          mirror_of: root.id,
          serial_number: null
        };
      }

      const { data, error } = await supabase
        .from('products')
        .insert([insertPayload as any])
        .select(`
          *,
          category:product_categories(
            type,
            brand,
            model
          )
        `)
        .single();

      if (error) throw error;

      const products = get().products;
      set({ products: [data as unknown as ProductWithStock, ...products], isLoading: false });
      return data as unknown as ProductWithStock;
    } catch (error) {
      console.error('Error in addProduct:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding the product',
        isLoading: false 
      });
      return null;
    }
  },

  addProducts: async (products: ProductInsert[]) => {
    set({ isLoading: true, error: null });
    try {
      for (const p of products) {
        // Réutiliser la logique stricte de addProduct pour chaque item
        await get().addProduct(p);
      }
      await get().fetchProducts();
      set({ isLoading: false });
    } catch (error) {
      console.error('Error in addProducts:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding products',
        isLoading: false 
      });
    }
  },

  updateProduct: async (id: string, updates: Partial<Product>) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Updating product:', id, updates);

      // Charger le produit pour savoir si c'est un enfant
      const { data: existing, error: loadErr } = await supabase
        .from('products')
        .select('id,parent_id,mirror_of')
        .eq('id', id as any)
        .single();
      if (loadErr || !existing) throw loadErr || new Error('Product not found');

      const existingAny = existing as unknown as any;

      // Nettoyage parent_id vide
      const filteredUpdates: any = {};
      if (updates.parent_id !== undefined && updates.parent_id === '') {
        // ignore suppression forcée via chaîne vide
      }

      if (existingAny.parent_id || (existingAny as any).mirror_of) {
        // Enfant miroir: autoriser name, description, category_id ; SKU immuable
        if (typeof updates.name === 'string') {
          filteredUpdates.name = updates.name;
        }
        if (typeof updates.description === 'string') {
          filteredUpdates.description = updates.description;
        }
        if (updates.category_id !== undefined) {
          filteredUpdates.category_id = updates.category_id as any;
        }
        // Note: ignorer toute tentative de modification du SKU enfant
      } else {
        // Parent: mise à jour libre selon updates
        Object.assign(filteredUpdates, updates);
      }

      const { data, error } = await supabase
        .from('products')
        .update(filteredUpdates as any)
        .eq('id', id as any)
        .select(`
          *,
          category:product_categories(
            type,
            brand,
            model
          )
        `)
        .single();

      if (error) throw error;

      // Recharger depuis la base pour récupérer la répartition des stocks correcte
      // et ré-appliquer l'héritage de stock pour les miroirs (même logique que fetchProducts)
      await get().fetchProducts();
      set({ isLoading: false });

      console.log('Product updated successfully');
    } catch (error) {
      console.error('Error in updateProduct:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while updating the product',
        isLoading: false 
      });
    }
  },

  deleteProduct: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // Supprimer d'abord les produits miroirs qui ont ce produit comme parent
      const { error: deleteMirrorsError } = await supabase
        .from('products')
        .delete()
        .eq('parent_id', id as any);

      if (deleteMirrorsError) {
        console.error('Error deleting mirror products:', deleteMirrorsError);
      }
      
      // Supprimer le produit principal
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id as any);

      if (error) throw error;
      
      const products = get().products.filter(product => product.id !== id);
      set({ products, isLoading: false });
    } catch (error) {
      console.error('Error in deleteProduct:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while deleting the product',
        isLoading: false 
      });
    }
  },
}));
