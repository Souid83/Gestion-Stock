-- Ajout des champs de marge pour produits à prix unique
alter table products
  add column if not exists margin_percent numeric,
  add column if not exists margin_value numeric,
  add column if not exists pro_margin_percent numeric,
  add column if not exists pro_margin_value numeric;
