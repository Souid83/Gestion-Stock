# Cahier des Charges pour Développement d'un Système de Gestion de Stock et Produits

## 1. Objectif Général de l'Application

L'application est un système de gestion de stock et de produits conçu pour aider les utilisateurs à suivre leurs inventaires, gérer les informations produits, calculer les prix et les marges, et analyser la rentabilité sur différentes places de marché. Elle s'interface avec une base de données Supabase pour la persistance des données et l'authentification.

## 2. Technologies Clés (Frontend)

*   React 18+
*   Vite (build tool)
*   TypeScript
*   Tailwind CSS (pour le style)
*   Zustand (pour la gestion d'état globale)
*   React Router (à clarifier son utilisation exacte par rapport à la navigation par état actuelle)
*   Supabase Client JS (pour les interactions backend)
*   Lucide React (icônes)
*   `Fuse.js` (recherche floue)
*   Recharts (graphiques pour le tableau de bord)
*   Framer Motion (animations)
*   ESLint (linting)

## 3. Structure Générale de l'Application (Frontend)

L'application est une Single Page Application (SPA) avec les sections principales suivantes, accessibles via une barre de navigation latérale :

*   Tableau de Bord Principal
*   Gestion des Produits (avec sous-sections)
*   Gestion Multi-Stock
*   Gestion des Catégories
*   Gestion des Variantes
*   Gestion des Formats d'Expédition
*   Simulateur Marketplace
*   (Implicitement : Commandes, Clients, Notifications, Paramètres - ces sections existent dans la navigation de `App.tsx` mais leurs pages dédiées n'ont pas été explorées en détail, supposant des fonctionnalités CRUD standard si elles doivent être recodées).
*   **Nouvelles sections à prévoir (basées sur les fonctionnalités ajoutées ci-dessous) :**
    *   Gestion des E-mails / Configuration SMTP
    *   Facturation et Gestion des Clients (incluant Devis, Commandes, Factures, Avoirs et Réglages Facture)
    *   Logiques Avancées de Stock (Lots, Miroirs)
    *   Gestion des Livraisons
    *   Statistiques Avancées
    *   Configuration IA (si interface dédiée)
    *   Administration des Rôles et Permissions (si interface dédiée)

## 4. Fonctionnalités Métier Détaillées

### 4.1. Authentification et Gestion des Rôles

*   Utilisation de Supabase Auth pour l'authentification des utilisateurs.
*   Configuration de la session et des cookies pour persistance (`localStorage` et cookie `sb-auth-token` `HttpOnly`, `Secure`, `SameSite=None`).
*   **Rôles :** Administrateur et Utilisateur standard initialement.
    *   La logique actuelle dans `src/lib/supabase.ts` pour `isAdmin` et `getUserRole` est permissive et doit être **renforcée pour la production**. Un administrateur devrait être explicitement défini dans la table `admin_users` ou via le nouveau système de rôles.
    *   Une fonction `setupFirstAdmin` permet de désigner le premier utilisateur enregistré comme administrateur.
*   Certaines fonctionnalités (ajout/modification de produits, gestion des stocks, catégories, variantes, formats d'expédition, configuration du simulateur) sont restreintes aux administrateurs dans la version actuelle.
    *   *Voir section 4.16 pour l'extension des droits et rôles avec des rôles prédéfinis et une gestion fine des permissions.*

### 4.2. Tableau de Bord Principal (`App.tsx`, `useSalesStore`)

*   **Objectif :** Fournir un aperçu des performances et des métriques clés.
*   **Affichage :**
    *   Commandes totales.
    *   Nombre de produits synchronisés.
    *   Chiffre d'Affaires (CA) Mensuel.
    *   Bénéfice Mensuel Estimé.
    *   Objectif global de Marge Brute Mensuelle.
    *   Objectifs journaliers, hebdomadaires, mensuels (en €).
    *   Encaissements journaliers, hebdomadaires, mensuels (en €).
    *   Indicateurs "Reste à faire" (en €) pour atteindre les objectifs journaliers, hebdomadaires, mensuels.
*   **Source des Données :** Les métriques sont récupérées via `useSalesStore` qui appelle la table `sales_metrics` et `product_stats` de Supabase. Ces tables sont probablement alimentées par des processus backend (triggers, fonctions Supabase) qui agrègent les données de ventes et de produits.
*   **Visualisation :** Utilisation de `Recharts` pour des graphiques (non détaillé dans le code exploré, mais supposé).

### 4.3. Gestion des Catégories (`CategoryManagement.tsx`, `useCategoryStore`)

*   **Objectif :** Définir et gérer les catégories de produits.
*   **Structure d'une Catégorie :** `id` (uuid), `type` (string, ex: "SMARTPHONE"), `brand` (string, ex: "APPLE"), `model` (string, ex: "IPHONE 14"). Les valeurs `type`, `brand`, `model` sont stockées en MAJUSCULES.
*   **Fonctionnalités (Admin) :**
    *   Ajouter une nouvelle catégorie (vérifie l'unicité de la combinaison type/marque/modèle avant insertion).
    *   Lister les catégories existantes (triées par type, puis marque, puis modèle).
    *   Supprimer une ou plusieurs catégories (sélection multiple et confirmation).
    *   **Import CSV :**
        *   Télécharger un modèle CSV (`Type,Brand,Model`).
        *   Importer un fichier CSV pour ajouter des catégories en masse. La fonction d'ajout gère la déduplication.
*   **Source des Données :** Table `product_categories` dans Supabase.

### 4.4. Gestion des Variantes (`VariantManagement.tsx`, `useVariantStore`)

*   **Objectif :** Définir et gérer les attributs de variantes de produits (ex: couleur, grade, capacité).
*   **Structure d'une Variante :** `id` (uuid), `color` (string), `grade` (string), `capacity` (string). Les valeurs sont stockées en MAJUSCULES.
*   **Fonctionnalités (Admin) :**
    *   Ajouter une nouvelle variante (vérifie l'unicité de la combinaison couleur/grade/capacité avant insertion).
    *   Lister les variantes existantes (triées par couleur, puis grade, puis capacité).
    *   Supprimer une ou plusieurs variantes (sélection multiple et confirmation).
    *   **Import CSV :**
        *   Télécharger un modèle CSV (`Color,Grade,Capacity`).
        *   Importer un fichier CSV pour ajouter des variantes en masse. La fonction d'ajout gère la déduplication.
*   **Source des Données :** Table `product_variants` dans Supabase.

### 4.5. Gestion des Produits (`useProductStore`, et formulaires associés)

L'application distingue deux principaux types de "produits" dans sa logique :
*   **Produits Parents/Modèles :** Définissent les caractéristiques générales d'un type de produit (ex: "iPhone 14 Pro Max 256GB Noir Grade A"). Ils ont un SKU de base, une description, des dimensions, des images, et sont associés à une catégorie et à une ou plusieurs variantes. Ils n'ont pas de numéro de série propre, ni de prix d'achat/vente ou de stock individuel à ce niveau. `is_parent = true`.
*   **Produits Unitaires avec Numéro de Série :** Représentent une instance physique unique d'un produit parent/modèle (ex: un iPhone spécifique avec son propre numéro de série). Ils héritent des informations du parent mais ont en plus un numéro de série, un prix d'achat spécifique, des prix de vente, un lieu de stock, un niveau de batterie, etc. `is_parent = false`, `parent_id` pointe vers le produit parent.
*   (Voir aussi section 4.10 pour les Produits en Lot/Kits et Produits Miroir)

#### 4.5.1. Création d'un Produit Parent/Modèle (`ProductMultiplePriceForm.tsx`)

*   **Objectif :** Créer un "modèle" de produit qui peut ensuite avoir plusieurs instances avec numéros de série.
*   **Flux de Création (Admin) :**
    1.  L'utilisateur accède via `App.tsx` -> "Ajouter un produit" -> `ProductTypeSelection.tsx` (choix du type de flux) -> `ProductPAMForm.tsx` -> "Prix d'achat multiple sans numéro de série".
    2.  **Sélection de Catégorie :** Choisir Type, Marque, Modèle. Le nom du produit est automatiquement suggéré.
    3.  **Sélection de Variante(s) :** Choisir Couleur, Grade, Capacité.
        *   *Correctif nécessaire : l'UI actuelle ne permet la saisie que d'UNE variante, mais la structure de données (`product.variants` est un JSON, et `selectedVariants` un tableau) et la logique de soumission suggèrent que plusieurs combinaisons de variantes devraient être associables à un produit parent.*
    4.  **Saisie des Informations Produit :**
        *   Nom du produit (modifiable, pré-rempli par la catégorie).
        *   SKU (base SKU, ex: "IPH14PM256B").
        *   EAN.
        *   Poids (grammes).
        *   Dimensions (largeur, hauteur, profondeur en cm).
        *   Description.
    5.  **Gestion des Images :** Ajouter/supprimer des URLs d'images via `ImageManager`.
    6.  **Enregistrement :**
        *   Les données sont sauvegardées dans la table `products` avec `is_parent = true`.
        *   La catégorie sélectionnée est ajoutée/récupérée via `categoryStore`.
        *   Les variantes sélectionnées sont stockées dans la colonne `products.variants` (type JSON).
        *   Les URLs des images sont stockées dans `products.images` (array de string).
*   **Champs Clés Stockés (pour produit parent) :** `name`, `sku`, `ean`, `description`, `category_id`, `variants` (JSON), `images` (array), `weight_grams`, `dimensions`, `is_parent` (true).

#### 4.5.2. Création/Modification d'un Produit Unitaire avec Numéro de Série (`ProductSerialForm.tsx`)

*   **Objectif :** Enregistrer une instance spécifique d'un produit avec son numéro de série, ses coûts et ses prix.
*   **Flux de Création (Admin) :**
    1.  Accès via `App.tsx` -> "Ajouter un produit" -> `ProductTypeSelection.tsx` -> `ProductPAMForm.tsx` -> "Prix d'achat multiple avec numéro de série".
    2.  **Étape 1 : Sélection du Produit Parent/Modèle**
        *   Sélectionner Catégorie (Type, Marque, Modèle).
        *   Sélectionner Variante (Couleur, Grade, Capacité).
        *   Le composant `ProductSelectionWindow` s'ouvre, listant les produits parents (`is_parent = true`) correspondant aux critères.
        *   L'utilisateur sélectionne un produit parent. L'ID de ce parent est stocké en `sessionStorage` (`parentProductId`).
    3.  **Étape 2 : Saisie des Détails de l'Unité**
        *   Le nom et le SKU du produit parent sont affichés (non modifiables).
        *   **Type de TVA :** Choisir "TVA normale" ou "TVA sur marge". Le reste du formulaire s'affiche après ce choix.
        *   **Champs Spécifiques à l'Unité :**
            *   Numéro de série (requis, max 15 char).
            *   Lieu de Stock (sélection parmi les stocks définis, requis).
            *   Pourcentage de batterie (0-100, requis).
            *   Sticker de garantie (Présent/Absent, requis).
            *   Prix d'achat avec frais (€, requis).
            *   Prix d'achat brut (€, requis).
            *   Fournisseur (texte, requis).
            *   Notes (optionnel).
        *   **Calculateur de Prix de Vente Magasin (dynamique) :**
            *   Basé sur le Prix d'achat avec frais et le Type de TVA.
            *   Permet de saisir soit le Prix de Vente (HT si TVA normale, TTC si TVA sur marge), soit la Marge %, soit la Marge numéraire (TTC si TVA normale, Nette si TVA sur marge). Les autres champs se recalculent automatiquement.
            *   Utilise les fonctions de `MarginCalculator.tsx`.
            *   *Vérifier la logique de calcul du HT à partir du TTC en cas de TVA normale (devrait être TTC / 1.2).*
        *   **Calculateur de Prix de Vente Pro (dynamique) :** Identique au prix magasin, mais pour les professionnels.
    4.  **Enregistrement :**
        *   Les données sont sauvegardées dans la table `products` avec `is_parent = false` et `parent_id` pointant vers le produit parent sélectionné.
        *   Le SKU final est `SKU_PARENT-NUMERO_SERIE`.
        *   Stock initial de l'unité = 1.
        *   Si TVA sur marge, les marges (retail et pro) sont enregistrées/mises à jour dans la table `serial_product_margin_last`.
        *   Le `parentProductId` est retiré de `sessionStorage`.
*   **Mode Édition :**
    *   Accessible si `editSerialProductId` est dans `sessionStorage` (via `ProductPAMForm`) ou si `productId` est passé en `location.state` (potentiellement depuis la liste des produits).
    *   Pré-remplit le formulaire avec les données du produit à éditer.
    *   Permet de modifier les informations de l'unité.

#### 4.5.3. Liste des Produits et Recherche (`Products.tsx`, `ProductList.tsx`, `ProductSearch.tsx`)

*   **Objectif :** Afficher tous les produits (parents, unitaires, lots, miroirs), permettre la recherche, le filtrage et l'export.
*   **Affichage :**
    *   Utilise `ProductList` pour afficher les produits. Le détail des colonnes affichées dans la liste n'est pas explicite dans `Products.tsx` mais `ProductList` doit les gérer. On peut supposer à minima : SKU, Nom, Catégorie, Stock total, Prix.
    *   Les produits sont récupérés via `useProductStore` (depuis la vue `products_with_stock`).
*   **Recherche (`ProductSearch`, `Fuse.js`) :**
    *   Recherche floue sur : Nom, SKU, EAN, Description, Emplacement, Catégorie (Type, Marque, Modèle).
    *   Poids différents pour les champs de recherche.
    *   **Filtres :** Boutons de filtre pour afficher uniquement les produits "Lot" ou les produits "Miroir".
*   **Export CSV :**
    *   Exporter tous les produits.
    *   Exporter les produits à réapprovisionner (stock <= alerte stock).
    *   Exporter les résultats de la recherche actuelle.
    *   Le CSV contient des champs détaillés (SKU, Nom, Catégorie, Prix d'achat, Prix de vente, Stock, Dimensions, etc.).
*   **Page "Stock des produits" (`ProductStock.tsx`) :** Actuellement marquée "en cours de développement". Pourrait être une vue plus détaillée des stocks par produit.

### 4.6. Gestion Multi-Stock (`StockManagement.tsx`)

*   **Objectif :** Définir et gérer une hiérarchie de lieux de stockage et la répartition des produits.
*   **Structures de Données :**
    *   **`StockGroup` :** Groupe de stocks (ex: "ENTREPÔT", "BOUTIQUE"). Peut être `synchronizable`.
        *   Champs Supabase : `id` (uuid), `name` (string, MAJUSCULES), `synchronizable` (boolean).
    *   **`Stock` :** Lieu de stock spécifique appartenant à un groupe (ex: "RACK A1").
        *   Champs Supabase : `id` (uuid), `name` (string, MAJUSCULES), `group_id` (fk vers `stock_groups`).
    *   **`ProductStock` :** Quantité d'un produit (`product_id`) dans un lieu de stock (`stock_id`).
        *   Champs Supabase : `id` (uuid), `product_id` (fk), `stock_id` (fk), `quantity` (number). *(Cette table est utilisée pour le stock multi-lieux. La colonne `products.stock_id` et `products.stock` sert pour le stock principal/unitaire).*
*   **Fonctionnalités (Admin) :**
    *   **Groupes de Stock :** CRUD complet (Ajouter, Lister, Modifier, Supprimer avec confirmation).
    *   **Stocks :** CRUD complet (Ajouter, Lister, Modifier, Supprimer avec confirmation).
    *   **Visualisation des `ProductStocks` :** Liste des produits avec leur SKU, nom du stock, et quantité.
    *   **Import CSV de Stocks (lieux de stockage) :**
        *   Télécharger un modèle CSV (`name,group_name`).
        *   Importer un fichier CSV pour ajouter de nouveaux lieux de stock. Le groupe de stock est récupéré par nom (ou doit exister).
*   **Source des Données :** Tables `stock_groups`, `stocks`, `product_stocks` dans Supabase.

### 4.7. Gestion des Formats d'Expédition (`ShippingBoxes.tsx`)

*   **Objectif :** Gérer une liste de formats de colis d'expédition.
*   **Structure d'un `ShippingBox` :** `id` (uuid), `name` (string), `width_cm`, `height_cm`, `depth_cm` (numbers).
*   **Fonctionnalités (Admin) :**
    *   Ajouter un nouveau format de colis (nom, dimensions).
    *   Lister les formats existants.
    *   (Pas de modification/suppression dans l'UI actuelle).
*   **Source des Données :** Table `shipping_boxes` dans Supabase. Un produit peut être associé à un `shipping_box_id` (table `products`).

### 4.8. Simulateur Marketplace (`MarketplaceSimulator.tsx`)

*   **Objectif :** Aider à déterminer les prix de vente optimaux sur différentes places de marché en calculant la rentabilité.
*   **Fonctionnalités (Admin pour la configuration, Utilisateur pour la simulation) :**
    *   **Gestion des Marketplaces :**
        *   Utiliser des marketplaces prédéfinies (Amazon FBA, Amazon, eBay, Acheaper) avec leurs frais par défaut.
        *   Ajouter des marketplaces personnalisées (nom, icône URL ou upload).
        *   Configurer les paramètres pour chaque marketplace (via un modal) : Frais d'expédition (€), Frais fixes (€), Commission (%), TVA (%), Estimation de perte (%).
    *   **Simulation de Prix :**
        *   Affiche un tableau : lignes = produits de l'utilisateur, colonnes = marketplaces.
        *   L'utilisateur saisit le prix de vente TTC souhaité pour chaque produit sur chaque marketplace.
        *   Le simulateur calcule et affiche dynamiquement :
            *   La Marge Nette (€).
            *   Le Pourcentage de Marge (%).
        *   Les calculs tiennent compte du prix d'achat du produit (`purchase_price_with_fees`), de son type de TVA (`vat_type` pour calcul correct de la marge nette), et des frais de la marketplace.
        *   Les marges sont colorées (vert/rouge).
    *   **Import/Export CSV des Prix :**
        *   Télécharger un modèle CSV avec les produits et les marketplaces actuelles.
        *   Importer un fichier CSV pour mettre à jour les prix saisis. Si le CSV contient des colonnes de marketplace inconnues, celles-ci sont ajoutées comme nouvelles marketplaces personnalisées avec des frais par défaut.
*   **Source des Données :**
    *   Produits : `useProductStore`.
    *   Marketplaces : État local du composant (`marketplaces`), initialisé avec des valeurs en dur et modifiable. Pas de persistance en base de données pour la configuration des marketplaces (sauf si l'agent codeur décide de l'ajouter).
    *   Prix saisis : État local du composant (`productPrices`). Pas de persistance en base de données (simulation purement côté client).

### 4.9. 📧 Gestion des E-mails Transactionnels

*   **Objectif :** Permettre l'envoi par e-mail de documents générés (factures, devis, commandes) directement depuis l'interface via un SMTP configuré.
*   **Fonctionnalités à mettre en place :**
    *   **Configuration SMTP (Admin uniquement) :**
        *   Page dédiée dans les paramètres pour configurer les paramètres SMTP (hôte, port, authentification, SSL/TLS). Utiliser un vrai SMTP (pas de service tiers type SendGrid imposé).
        *   Possibilité de configurer plusieurs adresses e-mails d'expédition (ex : support@votresite.com, facturation@votresite.com).
        *   Stockage sécurisé des paramètres en base de données (ex: table `mail_settings`).
        *   Fonction de test des paramètres SMTP avant sauvegarde.
    *   **Modèles d'E-mail :**
        *   Zone de texte dans les réglages pour enregistrer des modèles d'e-mail personnalisables (ex: pour envoi de facture, devis, etc.).
        *   Petit assistant IA pour aider à la rédaction des modèles ou des e-mails ponctuels (ex: bouton "Suggérer un mail", voir section IA 4.13).
    *   **Envoi de Documents :**
        *   Interface de composition d'e-mail accessible depuis les documents concernés (factures, devis, commandes).
        *   Pré-remplissage du destinataire, de l'objet et du corps du message (utilisant les modèles).
        *   Génération et attachement automatique du document PDF.
    *   **Pas d'historique des envois d'e-mails nécessaire dans cette version.**

### 4.10. 🧱🧩 Logiques Avancées de Stock et Produits Spéciaux

#### 4.10.1. Gestion des Produits en Lot (Kits/Bundles)

*   **Objectif :** Permettre la création et la gestion de produits composés de plusieurs autres produits existants (lots ou kits).
*   **Fonctionnalités à mettre en place :**
    *   **Création d'un Produit "Lot" :**
        *   Interface pour définir un nouveau produit de type "Lot".
        *   Association de produits composants existants et de leur quantité respective dans le lot.
        *   Le produit "Lot" aura ses propres informations (SKU, nom, description, prix de vente) mais son coût d'achat sera calculé à partir des composants.
        *   **Contrainte :** Pas de lot imbriqué dans un autre lot.
    *   **Gestion des Stocks des Lots :**
        *   Le stock d'un produit "Lot" est calculé dynamiquement en fonction du stock disponible de ses composants.
        *   Stock disponible du lot = nombre maximal de lots pouvant être assemblés.
    *   **Décrémentation Automatique et Synchronisée des Composants :**
        *   Lors de la "création" ou de l'assemblage d'un lot (action manuelle ou implicite lors d'une vente), les stocks des produits composants sont décrémentés.
        *   Lors de la vente d'un produit "Lot", les stocks des composants sont déduits.
        *   Lors de la vente d'un composant faisant partie d'un lot, le stock disponible des lots concernés est impacté. La synchronisation doit garantir qu'il n'y ait jamais d'erreur de stock.
        *   Gestion des "désassemblages" de lots pour réintégrer les composants en stock.
    *   **Affichage et Identification :**
        *   Dans le listing des produits (voir 4.5.3), un bouton "Consulter la composition du lot" sera visible pour les produits de type "Lot".
    *   **Traçabilité :**
        *   Historique des mouvements de stock liés à l'assemblage/désassemblage et à la vente de lots.

#### 4.10.2. Gestion des Produits Miroir

*   **Objectif :** Gérer des produits qui sont des "miroirs" d'autres produits, partageant la majorité des informations et le stock, mais avec des identifiants (SKU, nom) distincts.
*   **Fonctionnalités à mettre en place :**
    *   **Définition et Liaison :**
        *   Interface pour créer un produit "miroir" à partir d'un produit "source" existant.
        *   **Synchronisation des Champs :** Tous les champs (prix, TVA, marges, images, descriptions, catégorie, variantes, etc.) doivent être synchronisés entre le produit source et ses miroirs, **SAUF le SKU et le Nom du produit** qui doivent être uniques pour chaque miroir.
    *   **Gestion des Stocks Partagés et Dynamiques :**
        *   Le stock est partagé entre le produit source et tous ses miroirs.
        *   Une vente effectuée depuis n'importe quel produit miroir (ou le source) décrémente le stock global partagé, affectant ainsi la disponibilité de tous les produits liés.
    *   **Affichage :**
        *   Indication claire dans les listes de produits et les fiches produits (voir 4.5.3) qu'un produit est un miroir et lien vers son produit source (et vice-versa).
    *   **Logique de Synchronisation Centralisée :**
        *   Un mécanisme de synchronisation automatique et robuste (backend ou hook global) doit être implémenté pour assurer la cohérence des données et des stocks entre les produits liés.
    *   **Cas d'usage :** Utile pour gérer le même produit physique listé différemment (ex: SKU/nom différent) sur plusieurs marketplaces ou sous différentes références internes, tout en maintenant une base d'information et un stock communs.

### 4.11. 📤 Intégration Avancée des Marketplaces (Synchronisation Réelle)

*   **Objectif :** Aller au-delà du simulateur pour permettre une synchronisation réelle des produits, stocks, et commandes avec des plateformes e-commerce externes.
*   **Fonctionnalités à mettre en place :**
    *   **Configuration des Connexions API :**
        *   Interface sécurisée pour ajouter et configurer les accès API pour différentes marketplaces (Amazon MWS/SP-API, eBay API, etc.).
        *   Stockage sécurisé des clés API.
    *   **Synchronisation des Produits :**
        *   Publication de produits depuis l'application vers les marketplaces.
        *   Mise à jour des informations produits (prix, description, images) sur les marketplaces.
        *   Liaison des produits existants sur les marketplaces avec les produits de l'application.
    *   **Synchronisation des Stocks :**
        *   Mise à jour automatique des niveaux de stock sur les marketplaces en fonction du stock disponible dans l'application (prenant en compte les lots et miroirs).
        *   Prise en compte des réservations de stock.
    *   **Gestion des Commandes Marketplace :**
        *   Importation des commandes depuis les marketplaces.
        *   Attribution des commandes à un canal de vente spécifique.
        *   Mise à jour du statut des commandes (ex: expédié, avec numéro de suivi).
    *   **Historique et Logs :**
        *   Journalisation détaillée des opérations de synchronisation (succès, erreurs, données échangées).
        *   Tableau de bord pour surveiller l'état des synchronisations.

### 4.12. 📄 Facturation et Gestion des Clients

*   **Objectif :** Gérer une base de données clients centralisée et fournir un système complet de gestion du cycle de vente, de la création de devis à la facturation et au suivi des paiements, avec des documents professionnels et configurables.

#### 4.12.1. 👥 Gestion des Clients

*   **Fonctionnalités à mettre en place :**
    *   **Table `customers` à créer/utiliser.**
    *   **Données à gérer par client :**
        *   Nom (société ou particulier).
        *   Adresse e-mail principale.
        *   Numéro de téléphone.
        *   Groupe client (Pro / Particulier) - sélection.
        *   Zone géographique (texte libre ou sélection prédéfinie).
        *   Adresses multiples (facturation, livraison principale).
        *   Conditions de paiement par défaut.
        *   Historique des transactions (devis, commandes, factures).
        *   Notes internes.
    *   **Adresses Secondaires :**
        *   Lors de la création d'une facture/commande, possibilité d'utiliser l'adresse de livraison principale du client ou de saisir/sélectionner une adresse de livraison secondaire spécifique pour ce document.
    *   **Filtres et Affichage :**
        *   Dans la liste des clients, possibilité de filtrer et d'afficher par groupe client (Pro/Particulier) et par zone géographique.

#### 4.12.2. Module de Facturation (Devis, Commandes, Factures, Avoirs)

*   **Fonctionnalités à mettre en place :**
    *   **Sélection Client :** Le client doit être sélectionné depuis sa fiche (voir 4.12.1) pour toute création de document.
    *   **Structure des Documents (Devis, Commandes, Factures, Avoirs) :**
        *   Champs classiques (numéro, date, client, lignes d'articles, totaux HT/TVA/TTC, etc.).
        *   Logo de l'entreprise configurable par l'admin.
        *   Texte légal en pied de page configurable.
        *   Conditions Générales de Vente (CGV) configurables.
        *   RIB de l'entreprise configurable.
        *   Toutes ces configurations (logo, textes, CGV, RIB) seront gérées dans un onglet dédié "Réglages Facture".
    *   **Génération PDF :**
        *   Pour tous les documents (devis, commandes, factures, avoirs).
        *   Basée sur un modèle de base (référence : FAMag278052.pdf), à améliorer avec une mise en page moderne, responsive et professionnelle.
    *   **Gestion des Devis :**
        *   Création de devis : sélection client, ajout de produits/services, prix, remises, TVA, conditions, date de validité.
        *   Suivi des statuts des devis (brouillon, envoyé, accepté, refusé).
        *   Un devis accepté peut être transformé en commande ou directement en facture.
    *   **Gestion des Commandes :**
        *   Transformation d'un devis accepté en commande.
        *   Création manuelle de commandes.
        *   Suivi des statuts des commandes (en attente, en préparation, expédiée, livrée, annulée).
        *   Lien avec la gestion des stocks pour la réservation/décrémentation des produits.
    *   **Gestion des Factures :**
        *   Transformation d'une commande ou d'un devis en facture.
        *   Création de factures directes.
        *   Numérotation automatique et non modifiable des factures.
        *   Gestion des différents taux de TVA.
    *   **Gestion des Avoirs :**
        *   Création d'avoirs partiels ou complets, générés à partir d’une facture existante.
        *   Numérotation automatique des avoirs.
        *   Lien vers les produits/lignes de la facture concernée.
        *   Impact sur le chiffre d'affaires et la TVA.
        *   La suppression directe d'une facture est une opération restreinte (voir permissions du rôle Administrateur, section 4.16). Pour les autres utilisateurs habilités, toute annulation ou correction de facture doit s'effectuer par la création d'un avoir.
    *   **Envoi des Documents :**
        *   Par e-mail (utilisant la configuration SMTP et les modèles définis en section 4.9).
        *   Destinataire principal : adresse e-mail de la fiche client.
        *   Possibilité d'ajouter une autre adresse e-mail au moment de l'envoi.
    *   **Import CSV d'Articles :**
        *   Possibilité d’importer une liste d’articles (SKU, quantité, prix optionnel) via un fichier CSV pour pré-remplir un devis ou une facture automatiquement.
    *   **Suivi des Paiements :**
        *   Enregistrement des paiements reçus (partiels ou complets) pour les factures.
        *   Association des paiements aux factures.
        *   Suivi des statuts de paiement (non payée, partiellement payée, payée, en retard).
        *   Gestion des relances pour impayés (potentiellement assistée par l'IA, voir section 4.13).

### 4.13. 🤖 Intégration d'une IA Assistante

*   **Objectif :** Intégrer des fonctionnalités basées sur l'intelligence artificielle pour assister l'utilisateur dans diverses tâches.
*   **Fonctionnalités à mettre en place (exemples) :**
    *   **Génération de Contenu :**
        *   Aide à la rédaction/amélioration des descriptions de produits (basée sur nom, catégorie, caractéristiques).
        *   Suggestion de mots-clés pour le SEO des fiches produits.
    *   **Optimisation et Recommandation :**
        *   Proposition de seuils d'alerte de stock basés sur l'historique des ventes et les délais de réapprovisionnement.
        *   Suggestion de marges ou de prix de vente en fonction des coûts, du marché (si données disponibles) et des objectifs de rentabilité.
    *   **Automatisation de la Communication :**
        *   Aide à la rédaction d'e-mails types (ex: relance pour devis non répondus, confirmation de commande, demande d'avis client), utilisant le système d'envoi d'e-mails (section 4.9).
        *   Pré-rédaction d'e-mails de relance pour les factures impayées.
    *   **Interface Utilisateur :**
        *   Intégration discrète dans les formulaires et interfaces existantes (ex: bouton "Suggérer avec l'IA").
        *   Optionnel : une interface conversationnelle (chatbot) pour des requêtes plus complexes ou des analyses.
    *   **Configuration :**
        *   Nécessitera probablement une connexion à une API d'IA (ex: OpenAI, modèles open-source hébergés).
        *   Gestion des clés API et potentiellement des coûts associés.

### 4.14. 📈 Module de Statistiques Avancées

*   **Objectif :** Fournir des outils d'analyse et de reporting détaillés pour aider à la prise de décision.
*   **Fonctionnalités à mettre en place :**
    *   **Tableaux de Bord Personnalisables :**
        *   Permettre à l'utilisateur de choisir les indicateurs et graphiques à afficher sur son tableau de bord statistique dédié.
    *   **📊 Statistiques par Produit :**
        *   Volume des ventes par produit.
        *   Chiffre d'Affaires (CA) généré par produit.
        *   Marge brute totale et marge moyenne par produit.
        *   Taux de rotation des stocks par produit.
        *   **Statistiques des Lots :** Les statistiques des produits "Lot" doivent être affichées séparément de celles de leurs composants individuels.
    *   **📦 Statistiques par Catégorie / Marque / Modèle :**
        *   Classement des meilleures ventes par type de produit, marque, et modèle.
        *   Analyse de la rentabilité par famille de produits.
    *   **🌍 Statistiques par Marketplace / Canal de Vente :**
        *   Répartition du CA par marketplace et autres canaux.
        *   Calcul du bénéfice net par canal.
        *   Suivi de la performance des canaux dans le temps.
    *   **📆 Statistiques Temporelles :**
        *   Visualisation des données clés (ventes, CA, marges, etc.) agrégées **par jour, semaine, mois, et année**.
        *   Comparaison entre différentes périodes.
        *   Possibilité de définir des **périodes d'analyse personnalisées** à l'aide d'un sélecteur de dates.
    *   **📉 Analyse des Stocks et Suivi des Alertes / Ruptures :**
        *   Valeur du stock, rotation, produits à faible rotation, surstock.
        *   Suivi des alertes de stock et historique des ruptures.
    *   **🧾 Statistiques Financières (issues du module de Facturation) :**
        *   CA facturé, avoirs émis, encours clients.
    *   **Suivi Détaillé des Marges :**
        *   Comparaison marges réalisées vs estimées, évolution des marges.
    *   **Analyses Complémentaires :**
        *   Statistiques par type de TVA, performance par client/groupe client.
    *   **Rapports et Visualisations :**
        *   Graphiques interactifs et variés, tableaux de données dynamiques avec filtres et tris.
    *   **📤 Exports de Données :**
        *   Possibilité d'exporter les données affichées dans les tableaux et les données sources des graphiques **uniquement au format CSV**.
        *   Les filtres et tris appliqués devront être reflétés dans les exports.

### 4.15. 📦 Gestion des Livraisons et Expéditions

*   **Objectif :** Suivre le processus d'expédition des commandes et faciliter la gestion des livraisons.
*   **Fonctionnalités à mettre en place :**
    *   **Préparation des Expéditions :**
        *   Interface pour regrouper les produits d'une commande à expédier.
        *   Suggestion du format de colis d'expédition (basé sur les dimensions/poids des produits et les `ShippingBoxes` configurés).
    *   **Suivi des Colis :**
        *   Enregistrement des informations d'expédition : transporteur, numéro de suivi, date d'expédition, coût d'expédition.
        *   Mise à jour du statut de la livraison (potentiellement via API transporteur si disponible, ou manuellement).
        *   Lien entre la commande, son statut, et les informations de suivi.
    *   **Génération d'Étiquettes / Documents d'Expédition :**
        *   Génération de bons de livraison.
        *   Optionnel : Intégration avec des services de transporteurs pour générer des étiquettes d'expédition (ex: Colissimo, Mondial Relay).
        *   Export des données d'expédition dans un format compatible avec les logiciels des transporteurs.
    *   **Notifications :**
        *   Possibilité d'envoyer des notifications au client avec les informations de suivi (utilisant le système d'envoi d'e-mails, section 4.9).

### 4.16. 🔐 Sécurité et Droits d'Accès Avancés

*   **Objectif :** Renforcer la sécurité de l'application et permettre une gestion fine des permissions utilisateurs via des rôles prédéfinis et une interface d'administration dédiée.
*   **Fonctionnalités à mettre en place :**
    *   **Gestion des Rôles Prédéfinis et Personnalisables :**
        *   **Rôles Prédéfinis :**
            *   **Admin :** Accès complet à toutes les fonctionnalités, y compris la configuration globale (SMTP, IA, Marketplaces, Réglages Facture), la gestion des utilisateurs et des rôles, la suppression de factures.
            *   **Magasin :** Consultation du stock (sans voir les prix d’achat), création de factures et devis uniquement. Tout le reste des fonctionnalités en lecture seule ou non accessible. Ne peut pas supprimer de facture (doit faire un avoir).
            *   **Préparateur :** Accès uniquement aux commandes à expédier et aux fonctionnalités liées à la préparation et au suivi des expéditions.
        *   Possibilité de créer des rôles personnalisés supplémentaires si nécessaire à l'avenir.
    *   **Interface d'Administration des Droits d'Accès (Indispensable) :**
        *   Accessible uniquement par le rôle "Admin".
        *   Interface claire pour assigner un ou plusieurs rôles aux utilisateurs.
        *   Pour chaque rôle (y compris les prédéfinis, dont les permissions de base sont fixes mais peuvent être affinées), une grille de permissions avec des cases à cocher par fonctionnalité majeure/sensible de l'application (ex: voir prix d'achat, modifier produit, créer client, accéder aux statistiques X, etc.). Cela permet de visualiser et potentiellement d'ajuster finement les droits si la structure des rôles personnalisés est activée.
    *   **Attribution des Rôles :**
        *   Interface pour assigner un ou plusieurs rôles aux utilisateurs.
    *   **Journalisation des Actions (Audit Log) :**
        *   Enregistrement de toutes les actions critiques effectuées dans le système (ex: création/modification/suppression de produit, modification de stock, génération de facture, changement de configuration, modification de droits).
        *   Détails à logger : utilisateur, action, date/heure, données concernées (avant/après si pertinent).
        *   Interface pour consulter et filtrer les logs d'audit (accessible aux administrateurs).
    *   **Authentification à Deux Facteurs (2FA) :**
        *   Option pour les utilisateurs d'activer la 2FA pour leur compte (via TOTP - ex: Google Authenticator, Authy).
        *   Gestion des codes de récupération.
    *   **Politiques de Sécurité :**
        *   Renforcement des politiques de mot de passe.
        *   Gestion des sessions (expiration, déconnexion à distance).

## 5. Structure de la Base de Données Supabase (Tables Principales et Relations)

(Basé sur `src/types/supabase.ts` et l'utilisation dans le code. **Cette section devra être mise à jour pour refléter les nouvelles fonctionnalités.**)

*   `admin_users` (`id` (user_id), `is_admin`) - *Potentiellement remplacé/complété par `user_roles`.*
*   `product_categories` (`id`, `type`, `brand`, `model`)
*   `product_variants` (`id`, `color`, `grade`, `capacity`)
*   `products`
    *   PK: `id` (uuid)
    *   FK: `category_id` -> `product_categories.id`
    *   FK: `parent_id` -> `products.id` (auto-référence pour produits unitaires)
    *   FK: `stock_id` -> `stocks.id` (lieu de stock principal/unitaire)
    *   FK: `shipping_box_id` -> `shipping_boxes.id`
    *   Colonnes : `name`, `sku`, `ean`, `description`, `variants` (json), `images` (text[]), `weight_grams`, `width_cm`, `height_cm`, `depth_cm`, `is_parent`, `serial_number`, `purchase_price_with_fees`, `raw_purchase_price`, `retail_price`, `pro_price`, `vat_type`, `stock` (quantité pour ce produit/cette ligne), `stock_alert`, `supplier`, `product_note`, `battery_level`, `warranty_sticker`, etc.
    *   *Nouvelles colonnes possibles : `product_type` ('simple', 'bundle', 'mirror'), `source_product_id` (fk vers `products.id` pour miroirs).*
*   `product_images` (`id`, `product_id` -> `products.id`, `url`) - *Alternative à `products.images`? À clarifier.*
*   `stock_groups` (`id`, `name`, `synchronizable`)
*   `stocks` (`id`, `name`, `group_id` -> `stock_groups.id`)
*   `product_stocks` (jonction) (`id`, `product_id` -> `products.id`, `stock_id` -> `stocks.id`, `quantity`)
*   `shipping_boxes` (`id`, `name`, `width_cm`, `height_cm`, `depth_cm`)
*   `sales_metrics` (`id`, `metric_type`, `period`, `revenue`, `target`, `estimated_profit`, `sales_count`, `product_name`)
*   `product_stats` (vue/table) (`synced_products`, `total_orders`)
*   `serial_product_margin_last` (`serial_product_id` (pk, fk->`products.id`), `marge_percent`, `marge_numeraire`, `pro_marge_percent`, `pro_marge_numeraire`)
*   **Nouvelles tables à prévoir (liste non exhaustive, à affiner) :**
    *   `app_settings` (pour logo, texte légal, CGV, RIB, etc. - `key`, `value`)
    *   `mail_settings` (`id`, `email_address_identifier` (ex: 'facturation'), `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password_encrypted`, `smtp_secure_type`)
    *   `email_templates` (`id`, `name`, `subject`, `body`)
    *   `product_bundle_components` (`bundle_product_id` -> `products.id`, `component_product_id` -> `products.id`, `quantity`)
    *   `marketplace_connections` (`id`, `marketplace_name`, `api_key_encrypted`, `api_secret_encrypted`, `config_details_json`)
    *   `marketplace_sync_logs` (`id`, `connection_id`, `timestamp`, `operation_type`, `status`, `message`)
    *   `customers` (`id`, `name`, `email`, `phone`, `customer_group` ('pro', 'particulier'), `geographic_zone`, `default_billing_address_id`, `default_shipping_address_id`, `payment_terms_id`)
    *   `customer_addresses` (`id`, `customer_id`, `type` ('billing', 'shipping'), `street`, `city`, `zip_code`, `country`)
    *   `quotes` (`id`, `customer_id`, `quote_number`, `date_issued`, `date_expiry`, `status`, `total_amount`, `shipping_address_json`, `billing_address_json`)
    *   `quote_items` (`id`, `quote_id`, `product_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `total_price`)
    *   `orders` (`id`, `customer_id`, `order_number`, `date_placed`, `status`, `total_amount`, `quote_id`, `shipping_address_json`, `billing_address_json`)
    *   `order_items` (`id`, `order_id`, `product_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `total_price`)
    *   `invoices` (`id`, `customer_id`, `invoice_number`, `date_issued`, `date_due`, `status`, `total_amount`, `order_id`, `shipping_address_json`, `billing_address_json`)
    *   `invoice_items` (`id`, `invoice_id`, `product_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `total_price`)
    *   `credit_notes` (`id`, `customer_id`, `credit_note_number`, `date_issued`, `invoice_id` (fk vers facture d'origine), `reason`, `total_amount`)
    *   `credit_note_items` (`id`, `credit_note_id`, `product_id` ou `original_invoice_item_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `total_price`)
    *   `payments` (`id`, `invoice_id`, `date_paid`, `amount`, `payment_method`, `reference`)
    *   `shipments` (`id`, `order_id`, `carrier_name`, `tracking_number`, `date_shipped`, `shipping_cost`, `status`)
    *   `roles` (`id`, `name` (ex: 'admin', 'magasin', 'preparateur'), `description`)
    *   `permissions` (`id`, `name` (ex: 'product.create', 'invoice.delete'), `description`)
    *   `role_permissions` (`role_id` -> `roles.id`, `permission_id` -> `permissions.id`)
    *   `user_roles` (`user_id` -> `users.id` (de Supabase Auth), `role_id` -> `roles.id`)
    *   `audit_logs` (`id`, `user_id`, `timestamp`, `action_type`, `entity_affected`, `entity_id`, `details_json`)

**Vues Supabase Probables (déduites de l'utilisation) :**

*   `products_with_stock` : Utilisée par `productStore.fetchProducts()`. Joint probablement `products` avec des informations agrégées de stock (peut-être depuis `product_stocks` ou `products.stock`) et potentiellement des détails de catégorie. Le type `ProductWithStock` inclut `shared_quantity`. Devra gérer les stocks de lots et miroirs.
*   *Nouvelles vues possibles : `detailed_sales_report`, `stock_valuation_report`, `customer_activity_report`, etc.*

**Fonctions Supabase (définies dans la DB) :**
*   `is_admin()` - *Remplacé par `check_user_permission`.*
*   *Nouvelles fonctions possibles : `calculate_bundle_stock(bundle_product_id)`, `generate_invoice_number()`, `check_user_permission(user_id, permission_name)`, `get_product_effective_stock(product_id)` (gère simples, lots, miroirs).*

## 6. Points d'Attention et Clarifications Nécessaires

*   **Routage :** Clarifier l'utilisation de `react-router-dom` par rapport au système de navigation basé sur `useState` et `(window as any).__setCurrentPage` dans `App.tsx`. S'agit-il d'un système hérité ou complémentaire ?
*   **`react-hook-form` :** Son utilisation n'est pas évidente dans les formulaires principaux analysés. Est-il utilisé ailleurs ou son intégration est-elle partielle/prévue ?
*   **`ProductMultiplePriceForm` - Variantes Multiples :** L'UI actuelle pour la sélection des variantes dans ce formulaire ne permet qu'une seule combinaison, alors que la structure des données et la logique de soumission suggèrent la possibilité d'en associer plusieurs à un produit parent. Ceci doit être aligné.
*   **Cohérence `addProduct` Store vs `ProductSerialForm` :** `ProductSerialForm` effectue des appels directs à Supabase pour l'insertion/mise à jour, tandis que `ProductMultiplePriceForm` utilise `useProductStore.addProduct`. Standardiser si possible, ou justifier la différence.
*   **Logique de Calcul de Prix (TVA Normale) :** Dans `ProductSerialForm`, lors de la modification du champ TTC pour un produit en TVA normale, le calcul du HT résultant semble incorrect. Revoir `ht = (purchase + input)` où `input` est le TTC. Devrait être `ht = ttc / 1.2`.
*   **Table `product_images` vs `products.images` :** La table `products` a une colonne `images` (array de string). Il existe aussi une table `product_images` avec une relation FK vers `products`. Clarifier quelle est la source de vérité ou si les deux coexistent pour des raisons spécifiques. Le code front utilise `products.images`.
*   **Rôle de `products.stock` vs `product_stocks` :** `products.stock` semble être le stock principal ou le stock d'une unité série. `product_stocks` gère le stock multi-lieux. Clarifier comment ils interagissent, en particulier pour les produits parents, lots et miroirs. La vue `products_with_stock` et son champ `shared_quantity` sont clés ici.
*   **Gestion des Rôles en Production :** La logique actuelle `isAdmin` est trop permissive pour la production et doit être basée strictement sur le nouveau système de rôles/permissions (voir 4.16).
*   **Persistance des Données du Simulateur Marketplace :** Actuellement, la configuration des marketplaces personnalisées et les prix saisis dans le simulateur sont en état local React et non persistés. Déterminer si une persistance (en base ou `localStorage`) est souhaitée.
*   **Fonctionnalités "Implicites" :** Les sections "Commandes", "Clients", "Notifications", "Paramètres" sont présentes dans la navigation de `App.tsx`. Elles sont maintenant largement couvertes par les nouvelles fonctionnalités (ex: 4.12 pour Commandes/Clients, 4.9 pour Notifications/Emails). Les "Paramètres" devront être étendus pour inclure la configuration SMTP, API Marketplaces, IA, Réglages Facture, etc.
*   **Processus Backend :** La table `sales_metrics` et `product_stats` sont probablement alimentées par des processus backend (triggers, fonctions Supabase). Bien que non directement dans le périmètre du recodage front, leur existence et leur mode de fonctionnement supposé doivent être pris en compte. De nouveaux triggers/fonctions seront nécessaires pour les nouvelles fonctionnalités (ex: mise à jour stock lot/miroir, calculs statistiques avancées, synchronisation centralisée des miroirs).
*   **Modèles PDF :** Les exigences de personnalisation (logo, textes, CGV, RIB) et d'amélioration du modèle de base (cf. FAMag278052.pdf) sont définies (voir 4.12). La complexité de la mise en œuvre d'une mise en page "moderne, responsive, professionnelle" reste un point à évaluer.
*   **API IA :** Choix de la technologie IA et gestion des coûts associés.
*   **API Marketplaces/Transporteurs :** Complexité et maintenance des intégrations API tierces.

## 7. Structure du Code Souhaitée

*   Suivre la structure de dossiers existante (`pages`, `components`, `store`, `hooks`, `lib`, `types`).
*   Utiliser TypeScript pour tout le code.
*   Maintenir la séparation des préoccupations (UI dans les composants/pages, logique métier dans les stores/hooks, appels API via les stores ou services dédiés).
*   Écrire un code clair, maintenable et bien commenté (pour les parties non triviales).
*   Assurer la gestion des états de chargement (`isLoading`) et des erreurs (`error`) de manière cohérente dans les stores et les afficher de manière appropriée dans l'UI.

Ce cahier des charges devrait fournir à un agent codeur une base solide pour comprendre l'application existante et la recoder, tout en mettant en évidence les domaines nécessitant une clarification ou une amélioration.