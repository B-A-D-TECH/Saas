# Module Produits (blackboxai)

Ce document liste l’intégration du module Produits/Catégories :

- Sidebar : ajout de l’entrée **Produits** dans `src/components/Navbar.tsx`.
- Pages : routes React Router ajoutées dans `src/App.tsx` :
  - `/products`
  - `/products/new`
  - `/products/:id/edit`
  - `/categories`
- UI : pages frontend créées dans `src/components/`.

Backend (à compléter dans `server/routes.ts` + `server/schema.sql`) :
- CRUD PostgreSQL pour produits
- CRUD PostgreSQL pour catégories

