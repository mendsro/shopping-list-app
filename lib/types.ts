export type ShoppingList = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  month_start: string;
  status: "active" | "archived";
  is_rollover: boolean;
  budget_goal: number;
  cashback_percentage: number;
};

export type ListItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  is_checked: boolean;
  created_at: string;
  price: number;
  category: string;
};

// Tipagem do schema do banco, usada pelo cliente Supabase tipado.
export type Database = {
  public: {
    Tables: {
      shopping_lists: {
        Row: Record<string, unknown> & ShoppingList;
        Insert: Record<string, unknown> & Partial<Omit<ShoppingList, "id" | "created_at" | "updated_at">> & {
          user_id: string;
          name: string;
        };
        Update: Record<string, unknown> & Partial<Omit<ShoppingList, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      list_items: {
        Row: Record<string, unknown> & ListItem;
        Insert: Record<string, unknown> & Partial<Omit<ListItem, "id" | "created_at">> & {
          list_id: string;
          name: string;
        };
        Update: Record<string, unknown> & Partial<Omit<ListItem, "id" | "list_id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
