"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { ListItem, ShoppingList } from "@/lib/types";
import { findProduct, normalizeProductName, productCatalog } from "@/lib/product-catalog";

export default function ListItems({ list }: { list: ShoppingList }) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Outros");
  const [categoryHistory, setCategoryHistory] = useState<Record<string, string>>({});
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [budgetGoal, setBudgetGoal] = useState(String(list.budget_goal ?? 0));
  const [budgetGoalInput, setBudgetGoalInput] = useState(
    list.budget_goal > 0 ? String(list.budget_goal) : ""
  );
  const [cashbackPercentage, setCashbackPercentage] = useState(
    String(list.cashback_percentage ?? 0)
  );
  const [cashbackPercentageInput, setCashbackPercentageInput] = useState(
    list.cashback_percentage > 0 ? String(list.cashback_percentage) : ""
  );
  const [listDate, setListDate] = useState(toDateInput(list.created_at));
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();

    // Atualiza a lista em tempo real quando outro dispositivo/usuário altera itens
    const channel = supabase
      .channel(`list_items_${list.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${list.id}` },
        () => fetchItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id]);

  async function fetchItems() {
    const { data, error } = await supabase
      .from("list_items")
      .select("*")
      .eq("list_id", list.id)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage("Não foi possível carregar os itens.");
    } else {
      setItems(data ?? []);
      const { data: history } = await supabase
        .from("list_items")
        .select("name, category")
        .neq("list_id", list.id);

      if (history) {
        setCategoryHistory(
          Object.fromEntries(
            history
              .filter((item) => item.category)
              .map((item) => [normalizeProductName(item.name), item.category])
          )
        );
      }
    }
    setLoading(false);
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const itemPrice = price.trim() === "" ? 0 : Number(price.replace(",", "."));
    if (!Number.isFinite(itemPrice) || itemPrice < 0) return;

    const { data, error } = await supabase
      .from("list_items")
      .insert({
        list_id: list.id,
        name: trimmedName,
        quantity,
        price: itemPrice,
        category,
      })
      .select()
      .single();

    if (error) {
      setErrorMessage("Não foi possível adicionar o item.");
      return;
    }

    if (data) {
      setItems((current) => [...current, data]);
    }
    setName("");
    setCategory("Outros");
    setQuantity(1);
    setPrice("");
  }

  async function handleSaveBudgetGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextBudgetGoal = Number(budgetGoalInput.replace(",", "."));
    const nextCashbackPercentage = Number(cashbackPercentageInput.replace(",", "."));
    const nextMonthStart = `${listDate.slice(0, 7)}-01`;
    const nextCreatedAt = `${listDate}T12:00:00`;
    if (
      !Number.isFinite(nextBudgetGoal) ||
      nextBudgetGoal < 0 ||
      !Number.isFinite(nextCashbackPercentage) ||
      nextCashbackPercentage < 0 ||
      nextCashbackPercentage > 100
    ) {
      return;
    }

    setSaveStatus("saving");
    let { error } = await supabase
      .from("shopping_lists")
      .update({
        budget_goal: nextBudgetGoal,
        cashback_percentage: nextCashbackPercentage,
        created_at: nextCreatedAt,
        month_start: nextMonthStart,
      })
      .eq("id", list.id);

    if (isMissingOptionalListColumn(error?.code)) {
      const fallback = await supabase
        .from("shopping_lists")
        .update({
          budget_goal: nextBudgetGoal,
          cashback_percentage: nextCashbackPercentage,
          created_at: nextCreatedAt,
        })
        .eq("id", list.id);
      error = fallback.error;
    }

    if (isMissingOptionalListColumn(error?.code)) {
      const fallback = await supabase
        .from("shopping_lists")
        .update({
          budget_goal: nextBudgetGoal,
          created_at: nextCreatedAt,
        })
        .eq("id", list.id);
      error = fallback.error;
    }

    if (isMissingOptionalListColumn(error?.code)) {
      const fallback = await supabase
        .from("shopping_lists")
        .update({ created_at: nextCreatedAt })
        .eq("id", list.id);
      error = fallback.error;
    }

    if (error) {
      setErrorMessage(
        isMissingOptionalListColumn(error.code)
          ? "A coluna de cashback ainda não existe no banco. Execute a migration 20260909_add_cashback_percentage.sql no Supabase."
          : "Não foi possível salvar as configurações da lista."
      );
      setSaveStatus("idle");
      return;
    }

    setBudgetGoal(String(nextBudgetGoal));
    setBudgetGoalInput(nextBudgetGoal > 0 ? String(nextBudgetGoal) : "");
    setCashbackPercentage(String(nextCashbackPercentage));
    setCashbackPercentageInput(nextCashbackPercentage > 0 ? String(nextCashbackPercentage) : "");
    setListDate(listDate);
    setSaveStatus("saved");
  }

  async function handleUpdatePrice(item: ListItem, value: string) {
    const nextPrice = Number(value.replace(",", "."));
    if (!Number.isFinite(nextPrice) || nextPrice < 0) return;

    setSaveStatus("saving");
    const { error } = await supabase
      .from("list_items")
      .update({ price: nextPrice })
      .eq("id", item.id);

    if (error) {
      setErrorMessage("Não foi possível atualizar o preço.");
      setSaveStatus("idle");
      return;
    }

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, price: nextPrice } : currentItem
      )
    );
    setSaveStatus("saved");
  }

  async function handleUpdateQuantity(item: ListItem, value: string) {
    const nextQuantity = Number(value);
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) return;

    setSaveStatus("saving");
    const { error } = await supabase
      .from("list_items")
      .update({ quantity: nextQuantity })
      .eq("id", item.id);

    if (error) {
      setErrorMessage("Não foi possível atualizar a quantidade.");
      setSaveStatus("idle");
      return;
    }

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, quantity: nextQuantity } : currentItem
      )
    );
    setSaveStatus("saved");
  }

  async function handleToggleChecked(item: ListItem) {
    const { error } = await supabase
      .from("list_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id);

    if (error) {
      setErrorMessage("Não foi possível atualizar o item.");
    }
  }

  async function handleRemoveItem(id: string) {
    const { error } = await supabase.from("list_items").delete().eq("id", id);
    if (error) {
      setErrorMessage("Não foi possível remover o item.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
  }

  const pendentes = sortItemsByCategoryAndName(items.filter((item) => !item.is_checked));
  const concluidos = sortItemsByCategoryAndName(items.filter((item) => item.is_checked));
  const total = items.reduce(
    (sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 1),
    0
  );
  const remainingBudget = Number(budgetGoal) - total;
  const cashbackTotal = total * Number(cashbackPercentage) / 100;
  const productSuggestions = name.trim()
    ? productCatalog
        .filter((product) => normalizeProductName(product.name).includes(normalizeProductName(name)))
        .slice(0, 8)
    : [];

  function handleProductNameChange(value: string) {
    setName(value);
    setCategory(findProduct(value)?.category ?? categoryHistory[normalizeProductName(value)] ?? "Outros");
    setShowProductSuggestions(value.trim().length > 0);
  }

  function selectProduct(productName: string) {
    const product = findProduct(productName);
    setName(product?.name ?? productName);
    setCategory(product?.category ?? categoryHistory[normalizeProductName(productName)] ?? "Outros");
    setShowProductSuggestions(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/lists" className="text-sm text-neutral-500 hover:text-brand-600">
        ← Voltar para minhas listas
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{list.name}</h1>

      <form onSubmit={handleSaveBudgetGoal} className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-medium text-neutral-700" htmlFor="budget-goal">
            Meta de gasto
            <input
              id="budget-goal"
              type="number"
              min="0"
              step="0.01"
              value={budgetGoalInput}
              onChange={(event) => setBudgetGoalInput(event.target.value)}
              placeholder="Ex: 500,00"
              className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="cashback-percentage">
            Cashback (%)
            <input
              id="cashback-percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={cashbackPercentageInput}
              onChange={(event) => setCashbackPercentageInput(event.target.value)}
              placeholder="Ex: 2,5"
              className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="list-date">
            Data da compra
            <input
              id="list-date"
              type="date"
              value={listDate}
              onChange={(event) => setListDate(event.target.value)}
              className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Salvar
          </button>
        </div>
        {saveStatus !== "idle" && (
          <p className="mt-2 text-xs text-neutral-500">
            {saveStatus === "saving" ? "Salvando..." : "Alterações salvas"}
          </p>
        )}
      </form>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total" value={formatCurrency(total)} />
        <SummaryCard label="Meta" value={formatCurrency(Number(budgetGoal))} />
        <SummaryCard
          label={`Cashback (${formatPercentage(Number(cashbackPercentage))})`}
          value={formatCurrency(cashbackTotal)}
          valueClassName="text-emerald-700"
        />
        <SummaryCard
          label={remainingBudget >= 0 ? "Restante" : "Acima da meta"}
          value={formatCurrency(Math.abs(remainingBudget))}
          valueClassName={remainingBudget >= 0 ? "text-emerald-700" : "text-red-600"}
        />
      </div>

      <form onSubmit={handleAddItem} className="relative mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <div className="col-span-2 min-w-0 flex-1 sm:min-w-[160px]">
          <input
            value={name}
            onChange={(e) => handleProductNameChange(e.target.value)}
            placeholder="Item (ex: Arroz)"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Produto"
            autoComplete="off"
          />
          {showProductSuggestions && productSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg sm:w-[calc(100%-14rem)]">
              {productSuggestions.map((product) => (
                <li key={product.name}>
                  <button
                    type="button"
                    onClick={() => selectProduct(product.name)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    <span>{product.name}</span>
                    <span className="ml-3 text-xs text-neutral-400">{product.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => {
            const nextQuantity = Number(e.target.value);
            if (Number.isFinite(nextQuantity) && nextQuantity >= 1) {
              setQuantity(Math.floor(nextQuantity));
            }
          }}
          aria-label="Quantidade"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-20"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-28"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Categoria"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-40"
        >
          {categoryOptions(categoryHistory).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="col-span-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 sm:col-span-1"
        >
          Adicionar
        </button>
      </form>

      {errorMessage && (
        <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Carregando itens...</p>
      ) : (
        <div className="mt-6 space-y-6">
          <ItemGroup
            title="Pendentes"
            items={pendentes}
            allItems={items}
            onToggle={handleToggleChecked}
            onRemove={handleRemoveItem}
            onUpdatePrice={handleUpdatePrice}
            onUpdateQuantity={handleUpdateQuantity}
          />
          <ItemGroup
            title="Concluídos"
            items={concluidos}
            allItems={items}
            onToggle={handleToggleChecked}
            onRemove={handleRemoveItem}
            onUpdatePrice={handleUpdatePrice}
            onUpdateQuantity={handleUpdateQuantity}
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-xs uppercase text-neutral-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isMissingOptionalListColumn(code?: string) {
  return code === "42703" || code === "PGRST204" || code === "PGRST205";
}

function formatPercentage(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function toDateInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function categoryOptions(categoryHistory: Record<string, string>) {
  return Array.from(
    new Set(["Outros", ...productCatalog.map((product) => product.category), ...Object.values(categoryHistory)])
  ).sort((firstCategory, secondCategory) =>
    firstCategory.localeCompare(secondCategory, "pt-BR", { sensitivity: "base" })
  );
}

function sortItemsByCategoryAndName(items: ListItem[]) {
  return [...items].sort((firstItem, secondItem) => {
    const categoryOrder = (firstItem.category || "Outros").localeCompare(
      secondItem.category || "Outros",
      "pt-BR",
      { sensitivity: "base" }
    );

    if (categoryOrder !== 0) return categoryOrder;

    return firstItem.name.localeCompare(secondItem.name, "pt-BR", {
      sensitivity: "base",
    });
  });
}

function ItemGroup({
  title,
  items,
  allItems,
  onToggle,
  onRemove,
  onUpdatePrice,
  onUpdateQuantity,
}: {
  title: string;
  items: ListItem[];
  allItems: ListItem[];
  onToggle: (item: ListItem) => void;
  onRemove: (id: string) => void;
  onUpdatePrice: (item: ListItem, value: string) => void;
  onUpdateQuantity: (item: ListItem, value: string) => void;
}) {
  if (items.length === 0) return null;

  const itemsByCategory = items.reduce<Record<string, ListItem[]>>((groups, item) => {
    const category = item.category || "Outros";
    groups[category] ??= [];
    groups[category].push(item);
    return groups;
  }, {});

  const categories = Object.keys(itemsByCategory).sort((firstCategory, secondCategory) =>
    firstCategory.localeCompare(secondCategory, "pt-BR", { sensitivity: "base" })
  );

  return (
    <section>
      <h2 className="text-xs font-medium uppercase text-neutral-400">{title}</h2>
      <div className="mt-2 space-y-3">
        {categories.map((category) => (
          <CategoryBox
            key={category}
            category={category}
            items={itemsByCategory[category]}
            allItems={allItems}
            onToggle={onToggle}
            onRemove={onRemove}
            onUpdatePrice={onUpdatePrice}
            onUpdateQuantity={onUpdateQuantity}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryBox({
  category,
  items,
  allItems,
  onToggle,
  onRemove,
  onUpdatePrice,
  onUpdateQuantity,
}: {
  category: string;
  items: ListItem[];
  allItems: ListItem[];
  onToggle: (item: ListItem) => void;
  onRemove: (id: string) => void;
  onUpdatePrice: (item: ListItem, value: string) => void;
  onUpdateQuantity: (item: ListItem, value: string) => void;
}) {
  const categoryItems = allItems.filter((item) => (item.category || "Outros") === category);
  const pricedItems = categoryItems.filter((item) => Number(item.price ?? 0) > 0);
  const categoryIsComplete = pricedItems.length === categoryItems.length;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        categoryIsComplete
          ? "border-emerald-200 bg-emerald-100"
          : "border-neutral-200 bg-white"
      }`}
    >
      <h3
        className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
          categoryIsComplete
            ? "border-emerald-200 text-emerald-800"
            : "border-neutral-100 text-brand-600"
        }`}
      >
        <span>{category} {pricedItems.length}/{categoryItems.length}</span>
        <span className="whitespace-nowrap text-[11px] font-medium normal-case text-neutral-600">
          Gasto: {formatCurrency(categoryItems.reduce((total, item) => total + itemTotal(item), 0))}
        </span>
      </h3>
      <ul className="divide-y divide-neutral-200">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
              Number(item.price ?? 0) > 0 ? "bg-emerald-50" : "bg-transparent"
            }`}
          >
            <label className="flex flex-1 items-center gap-3">
              <span
                className={`text-sm ${item.is_checked ? "text-neutral-400 line-through" : "text-neutral-900"}`}
              >
                {item.name}
                {item.quantity ? ` — ${item.quantity}` : ""}
                <span className="ml-2 text-xs text-neutral-500">
                  Total: {formatCurrency(Number(item.price ?? 0) * Number(item.quantity ?? 1))}
                </span>
              </span>
            </label>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
              <input
                type="number"
                min="1"
                step="1"
                defaultValue={item.quantity}
                onBlur={(event) => onUpdateQuantity(item, event.target.value)}
                aria-label={`Quantidade de ${item.name}`}
                className="w-16 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.price ?? 0}
                onBlur={(event) => onUpdatePrice(item, event.target.value)}
                aria-label={`Preço unitário de ${item.name}`}
                placeholder="Preço un."
                className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                onClick={() => onRemove(item.id)}
                className="text-xs text-neutral-400 hover:text-red-600"
              >
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function itemTotal(item: ListItem) {
  return Number(item.price ?? 0) * Number(item.quantity ?? 1);
}
