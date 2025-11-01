# Modifications - Suivi Sous-Traitant

## Résumé des modifications

Les modifications suivantes ont été apportées pour afficher correctement les numéros de série, les prix de vente pro et les totaux dans l'onglet "Suivi sous-traitant" du tableau de bord.

## 1. Fonction Netlify `consignments-list.ts`

### Modifications apportées :

#### A. Enrichissement des données depuis `consignment_lines_view`
- Ajout de requêtes pour récupérer les informations produit complètes (serial_number, parent_id, parent_name, product_type)
- Récupération des derniers mouvements pour obtenir unit_price_ht, vat_rate et vat_regime
- Calcul du prix unitaire selon le régime de TVA :
  - **TVA MARGE** : Prix TTC = unit_price_ht + (unit_price_ht × vat_rate)
  - **TVA NORMALE** : Prix HT = unit_price_ht
- Calcul du prix total ligne = prix_unitaire × quantité
- Ajout de logs console pour le débogage

#### B. Enrichissement du fallback (reconstruction depuis consignments)
- Modification de la requête pour inclure serial_number, parent_id, product_type et parent_name
- Calcul des prix unitaires et totaux lignes dans la boucle de reconstruction
- Conservation du dernier mouvement pour obtenir les informations de TVA
- Ajout de logs console pour tracer les calculs

### Nouveaux champs retournés par l'API :
- `serial_number` : Numéro de série du produit (pour les PAM enfants)
- `parent_id` : ID du produit parent (null si pas un PAM enfant)
- `parent_name` : Nom du produit parent (pour affichage)
- `product_type` : Type de produit (pam, simple, etc.)
- `vat_regime` : Régime de TVA (NORMAL ou MARGE)
- `unit_price` : Prix unitaire calculé (TTC pour marge, HT pour normal)
- `total_line_price` : Prix total de la ligne (unit_price × quantité)

## 2. Composant `ConsignmentsSection.tsx`

### Modifications apportées :

#### A. Type DetailRow
- Ajout des nouveaux champs : serial_number, parent_id, parent_name, product_type, vat_regime, unit_price, total_line_price
- Suppression des anciens champs IMEI non utilisés

#### B. Fonction computeTotals
- Simplification du calcul : Total HT et Total TTC (HT + TVA normale + TVA marge)
- Ajout de logs console pour tracer les calculs ligne par ligne
- Suppression des calculs séparés ttcNormale et ttcMarge (remplacés par un seul ttc)

#### C. Bandeau KPI (totaux globaux)
- Réduction à 2 cartes : Total HT Global et Total TTC Global
- Suppression des cartes séparées pour TVA normale et TVA marge

#### D. Sous-totaux par stock
- Réduction à 2 cartes : Total HT et Total TTC
- Simplification de l'affichage

#### E. Tableau des articles
- **Nouvelles colonnes** :
  - "Numéro de série" (affiche serial_number ou "—")
  - "Prix unitaire" (affiche le prix avec indication (TTC) ou (HT) selon vat_regime)
  - "Prix total ligne" (affiche le prix total calculé)
- **Logique d'affichage du nom** :
  - Si parent_id existe : affiche parent_name
  - Sinon : affiche product_name
- **Alignement** : Prix unitaire et prix total alignés à droite
- Ajout de logs console pour chaque ligne affichée

## 3. Cas d'usage gérés

### Produits PAM enfants avec numéro de série
- Affiche le nom du parent dans la colonne "Nom"
- Affiche le serial_number dans la colonne "Numéro de série"
- Prix calculé selon le régime de TVA du mouvement

### Produits PAM parents sans numéro de série
- Affiche le nom du produit
- Affiche "—" dans la colonne "Numéro de série"

### Produits simples (non PAM)
- Affiche le nom du produit
- Affiche "—" dans la colonne "Numéro de série"
- Prix calculé selon le régime de TVA

## 4. Logs console ajoutés

Pour faciliter le débogage, les logs suivants ont été ajoutés :

### Backend (consignments-list.ts)
- Nombre de produits à enrichir
- Nombre de mouvements récupérés
- Détails de chaque article (SKU, serial, parent, vatRegime, prix)

### Frontend (ConsignmentsSection.tsx)
- Nombre de lignes pour le calcul des totaux
- Détails de chaque ligne (sku, montant_ht, tva_normal, tva_marge, ttc_ligne)
- Totaux calculés (ht, ttc)
- Totaux globaux finaux
- Détails d'affichage de chaque ligne (nom, serial, parent, prix)

## 5. Tests recommandés

1. **Vérifier l'affichage des numéros de série** :
   - Ouvrir le tableau de bord
   - Développer l'accordéon "Suivi sous-traitant"
   - Vérifier que les numéros de série s'affichent pour les produits PAM enfants

2. **Vérifier les prix unitaires** :
   - Vérifier que "(TTC)" s'affiche pour les produits en TVA marge
   - Vérifier que "(HT)" s'affiche pour les produits en TVA normale

3. **Vérifier les totaux** :
   - Vérifier que le Total HT s'affiche correctement
   - Vérifier que le Total TTC s'affiche correctement
   - Vérifier que les totaux par stock sont corrects
   - Comparer avec les données en base si possible

4. **Vérifier les logs console** :
   - Ouvrir la console du navigateur
   - Rechercher les logs `[consignments-list]` et `[ConsignmentsSection]`
   - Vérifier que les calculs sont corrects

5. **Vérifier les permissions RBAC** :
   - Tester avec un utilisateur MAGASIN (ne doit pas voir les prix)
   - Tester avec un utilisateur ADMIN (doit voir les prix)

## 6. Points d'attention

- Les prix unitaires sont calculés à partir du dernier mouvement (le plus récent)
- Si aucun mouvement n'existe, les prix seront à 0,00 €
- Les produits sans consignments mais présents dans stock_produit ne remontent pas de prix (normal, pas de mouvement de dépôt)
- Le responsive est assuré par overflow-x-auto sur le tableau

## 7. Fichiers modifiés

1. `/netlify/functions/consignments-list.ts` (enrichissement des données)
2. `/src/components/ConsignmentsSection.tsx` (affichage et calculs)

