export type ProductCatalogEntry = {
  name: string;
  category: string;
};

export const productCatalog: ProductCatalogEntry[] = [
  { name: "Macarrão", category: "Almoço/Jantar" },
  { name: "Arroz", category: "Almoço/Jantar" },
  { name: "Azeite", category: "Almoço/Jantar" },
  { name: "Suco", category: "Bebidas" },
  { name: "Chá", category: "Bebidas" },
  { name: "Pão", category: "Café da manhã" },
  { name: "Queijo", category: "Café da manhã" },
  { name: "Iogurte 1", category: "Café da manhã" },
  { name: "Iogurte 2", category: "Café da manhã" },
  { name: "Iogurte 3", category: "Café da manhã" },
  { name: "Iogurte 4", category: "Café da manhã" },
  { name: "Iogurte 5", category: "Café da manhã" },
  { name: "Iogurte 6", category: "Café da manhã" },
  { name: "Iogurte 7", category: "Café da manhã" },
  { name: "Iogurte 8", category: "Café da manhã" },
  { name: "Iogurte 9", category: "Café da manhã" },
  { name: "Iogurte 10", category: "Café da manhã" },
  { name: "Café", category: "Café da manhã" },
  { name: "Requeijão", category: "Café da manhã" },
  { name: "Kiwi", category: "Café da manhã" },
  { name: "Água", category: "Café da manhã" },
  { name: "Morango", category: "Frutas/Legumes" },
  { name: "Tomate", category: "Frutas/Legumes" },
  { name: "Banana", category: "Frutas/Legumes" },
  { name: "Espinafre", category: "Frutas/Legumes" },
  { name: "Uva", category: "Frutas/Legumes" },
  { name: "Batata", category: "Frutas/Legumes" },
  { name: "Doce de leite", category: "Guloseimas" },
  { name: "Chocolate 1", category: "Guloseimas" },
  { name: "Chocolate 2", category: "Guloseimas" },
  { name: "Chocolate 3", category: "Guloseimas" },
  { name: "Chocolate 4", category: "Guloseimas" },
  { name: "Chocolate 5", category: "Guloseimas" },
  { name: "Chocolate 6", category: "Guloseimas" },
  { name: "Chocolate 7", category: "Guloseimas" },
  { name: "Chocolate 8", category: "Guloseimas" },
  { name: "Chocolate 9", category: "Guloseimas" },
  { name: "Chocolate 10", category: "Guloseimas" },
  { name: "Bolacha 1", category: "Guloseimas" },
  { name: "Bolacha 2", category: "Guloseimas" },
  { name: "Bolacha 3", category: "Guloseimas" },
  { name: "Bolacha 4", category: "Guloseimas" },
  { name: "Bolacha 5", category: "Guloseimas" },
  { name: "Bolacha 6", category: "Guloseimas" },
  { name: "Bolacha 7", category: "Guloseimas" },
  { name: "Bolacha 8", category: "Guloseimas" },
  { name: "Bolacha 9", category: "Guloseimas" },
  { name: "Bolacha 10", category: "Guloseimas" },
  { name: "Papel higiênico", category: "Higiene" },
  { name: "Absorvente", category: "Higiene" },
  { name: "Saco de lixo", category: "Higiene" },
  { name: "Lava tudo", category: "Higiene" },
  { name: "Luvas", category: "Higiene" },
  { name: "Detergente", category: "Higiene" },
  { name: "Sabão em pó", category: "Higiene" },
  { name: "Cif", category: "Higiene" },
  { name: "Desodorante", category: "Higiene" },
  { name: "Fio dental", category: "Higiene" },
  { name: "Molho de tomate", category: "Molhos/Temperos" },
  { name: "Páprica", category: "Molhos/Temperos" },
  { name: "Sal", category: "Molhos/Temperos" },
  { name: "Ketchup", category: "Molhos/Temperos" },
  { name: "Alho", category: "Molhos/Temperos" },
  { name: "Limão", category: "Molhos/Temperos" },
  { name: "Ovos", category: "Proteína" },
  { name: "Frango", category: "Proteína" },
  { name: "Carne moída", category: "Proteína" },
  { name: "Bife", category: "Proteína" },
  { name: "Camarão", category: "Proteína" },
  { name: "Porco", category: "Proteína" },
  { name: "Carne filé", category: "Proteína" },
  { name: "Carne mista", category: "Proteína" },
];

export function findProduct(name: string) {
  const normalizedName = normalizeProductName(name);
  return productCatalog.find((product) => normalizeProductName(product.name) === normalizedName);
}

export function normalizeProductName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}