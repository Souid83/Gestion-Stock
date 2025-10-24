import { supabase } from '../lib/supabase';
import type { ProductWithStock } from '../types/supabase';

// Normalisation identique à la page Produits
const normalizeQuery = (s: string): string => {
  try {
    return (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  } catch {
    return (s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
};

/**
 * Recherche produits en reproduisant la logique de la page Produits (sans modifier le moteur existant).
 * - Filtre texte: tokens sur name, OR sku/ean (ilike), comme dans Products.tsx
 * - Charge un set plus large puis trie localement par pertinence (même scoring que la page)
 * - Retourne un top N (limit, défaut 20)
 */
export async function searchProductsLikeList(query: string, limit: number = 20): Promise<ProductWithStock[]> {
  const normalized = normalizeQuery(query || '');
  const tokens = normalized.split(' ').filter(Boolean).slice(0, 5);

  // Pas de recherche si peu de caractères
  if (normalized.length === 0) {
    return [];
  }

  // Base select identique: produits + stocks + catégorie
  let qb = supabase
    .from('products')
    .select(`
      *,
      stocks:stock_produit (
        quantite,
        stock:stocks ( name )
      ),
      category:product_categories!products_category_id_fkey (
        type, brand, model
      )
    `);

  // Filtre texte (même orGroup que Products.tsx)
  if (normalized.length >= 2) {
    if (tokens.length > 0) {
      const andName = tokens.map(t => `name.ilike.%${t}%`).join(',');
      const orGroup = `and(${andName}),sku.ilike.%${normalized}%,ean.ilike.%${normalized}%`;
      qb = (qb as any).or(orGroup);
    } else {
      qb = (qb as any).or(`sku.ilike.%${normalized}%,ean.ilike.%${normalized}%`);
    }
  } else {
    // 1 caractère: cherche uniquement en SKU/EAN comme la page
    qb = (qb as any).or(`sku.ilike.%${normalized}%,ean.ilike.%${normalized}%`);
  }

  // Charger plus de lignes pour trier localement comme la page (borne haute raisonnable)
  const FETCH_LIMIT = Math.min(200, Math.max(limit * 4, 50));
  const { data, error } = await (qb as any)
    .order('created_at', { ascending: false })
    .limit(FETCH_LIMIT);

  if (error || !Array.isArray(data)) {
    return [];
  }

  let results: any[] = data as any[];

  // Tri local par pertinence (reprend la logique de Products.tsx)
  if (normalized.length >= 2 && tokens.length > 0) {
    const scored = results.map((p: any) => {
      const nameNorm = normalizeQuery(p?.name || '');
      const words = nameNorm.split(/[^a-z0-9]+/).filter(Boolean);
      const wordSet = new Set(words);

      let base = 0;
      let bonus = 0;

      for (const t of tokens) {
        if (t.length <= 2) {
          const wordHit = wordSet.has(t);
          base += wordHit ? 1 : 0;
          bonus += wordHit ? 2 : 0;
        } else {
          const hit = nameNorm.includes(t);
          const wordHit = wordSet.has(t);
          base += hit ? 1 : 0;
          bonus += wordHit ? 1 : 0;
        }
      }

      // Bonus “iphone + modèle” adjacent
      let adjacencyBonus = 0;
      const hasIphone = wordSet.has('iphone');
      const modelToken = tokens.find(t => t === 'x' || /^\d{1,2}$/.test(t));
      if (hasIphone && modelToken) {
        const idxIphone = words.indexOf('iphone');
        const idxModel = words.indexOf(modelToken);
        if (idxIphone >= 0 && idxModel >= 0) {
          const distance = Math.abs(idxIphone - idxModel);
          if (distance === 1) {
            adjacencyBonus += 6;
          } else if (distance > 1) {
            adjacencyBonus -= Math.min(distance - 1, 3);
          }
        }
      }

      // Pénalité douce pour qualificatifs non demandés
      let qualPenalty = 0;
      const qualifiers = ['pro', 'max', 'promax', 'plus', 'mini', 'ultra'];
      for (const q of qualifiers) {
        if (wordSet.has(q) && !tokens.includes(q)) {
          qualPenalty += 1;
        }
      }

      // Bonus pour qualificatifs explicitement demandés
      const requestedQualifiers = qualifiers.filter(q => tokens.includes(q));
      let reqQualBonus = 0;
      for (const rq of requestedQualifiers) {
        if (wordSet.has(rq)) {
          reqQualBonus += (rq === 'max' ? 4 : 3);
        }
      }

      const score = base * 10 + bonus + adjacencyBonus - qualPenalty + reqQualBonus;
      const createdAtMs = Date.parse(p?.created_at || '') || 0;
      const hasMaxReq = tokens.includes('max') && wordSet.has('max');
      const hasProReq = tokens.includes('pro') && wordSet.has('pro');
      return { p, score, createdAtMs, hasMaxReq, hasProReq };
    });

    scored.sort((a, b) => {
      if (a.hasMaxReq !== b.hasMaxReq) return (b.hasMaxReq ? 1 : 0) - (a.hasMaxReq ? 1 : 0);
      if (a.hasProReq !== b.hasProReq) return (b.hasProReq ? 1 : 0) - (a.hasProReq ? 1 : 0);
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAtMs - a.createdAtMs;
    });

    results = scored.map(x => x.p);
  }

  // Top N
  return results.slice(0, limit) as ProductWithStock[];
}
