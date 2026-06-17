export type CategoryId = "entrees" | "plats" | "desserts" | "boissons";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: CategoryId;
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  entrees: "Entrées",
  plats: "Plats",
  desserts: "Desserts",
  boissons: "Boissons",
};

export const MENU_ITEMS: MenuItem[] = [
  { id: "salade", name: "Salade verte", price: 6.5, category: "entrees" },
  { id: "soupe", name: "Soupe du jour", price: 5.9, category: "entrees" },
  { id: "terrine", name: "Terrine maison", price: 8.5, category: "entrees" },
  { id: "burger", name: "Burger du chef", price: 15.9, category: "plats" },
  { id: "poisson", name: "Filet de lieu noir", price: 18.5, category: "plats" },
  { id: "pasta", name: "Pâtes carbonara", price: 14.0, category: "plats" },
  { id: "steak", name: "Steak frites", price: 22.0, category: "plats" },
  { id: "tarte", name: "Tarte citron", price: 7.5, category: "desserts" },
  { id: "glace", name: "Coupe glacée", price: 6.0, category: "desserts" },
  { id: "cafe", name: "Café", price: 2.2, category: "boissons" },
  { id: "vin", name: "Verre de vin", price: 4.5, category: "boissons" },
  { id: "eau", name: "Eau 50 cl", price: 2.0, category: "boissons" },
];
