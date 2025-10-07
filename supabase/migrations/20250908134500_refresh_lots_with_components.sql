/*
  Refresh the lots_with_components view so it includes newly added columns
  (e.g. margin_pro_percent, margin_retail_percent) from lots.
  Postgres views have a fixed column set; after ALTER TABLE lots ADD COLUMN ...,
  we must CREATE OR REPLACE the view to expose new columns in the view's row type.
*/

CREATE OR REPLACE VIEW lots_with_components AS
SELECT 
  l.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', lc.id,
        'product_id', lc.product_id,
        'quantity', lc.quantity,
        'depots_utilises', lc.depots_utilises,
        'product_name', p.name,
        'product_sku', p.sku,
        'product_stock', p.stock
      )
    ) FILTER (WHERE lc.id IS NOT NULL),
    '[]'::json
  ) as components
FROM lots l
LEFT JOIN lot_components lc ON l.id = lc.lot_id
LEFT JOIN products p ON lc.product_id = p.id
GROUP BY l.id;
