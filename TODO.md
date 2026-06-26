# TODO

- [ ] Fix backend: suppression d’une catégorie (`DELETE /api/product-categories/:id`) doit aussi retirer/neutraliser les `menu_items` liés (option choisie: B).
- [ ] Mettre à jour l’API `/api/menu` pour ne plus mapper `NULL category_id` vers `plats` (éviter fallback qui fait “réapparaître” les produits).
- [ ] Mettre à jour le frontend POS si nécessaire pour gérer la catégorie “non catégorisée” (ou ignorer les items sans catégorie).
- [ ] Tester manuellement: créer 2 catégories, assigner des items, supprimer une catégorie et vérifier que la caisse ne l’affiche plus.

