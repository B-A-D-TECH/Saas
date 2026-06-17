export type ProductStatus = "actif" | "inactif";

export type ProductCategoryDto = {
  id: string;
  name: string;
  slug: string;
  position: number;
};

export type ProductDto = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string | null;
  status: ProductStatus;
  photoUrl: string | null;
  available: boolean;
};

