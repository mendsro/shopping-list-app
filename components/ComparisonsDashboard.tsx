"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeProductName, productCatalog } from "@/lib/product-catalog";
import type { ListItem, ShoppingList } from "@/lib/types";

type ComparisonItem = Pick<ListItem, "name" | "category" | "price" | "quantity" | "created_at"> & {
  list_id: string;
};

type MonthlyBudgetGoal = {
  month_start: string;
  goal: number;
  purchases_count: number;
};

export default function ComparisonsDashboard() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<Record<string, number>>({});
  const [monthlyGoalInputs, setMonthlyGoalInputs] = useState<Record<string, string>>({});
  const [monthlyPurchaseCounts, setMonthlyPurchaseCounts] = useState<Record<string, number>>({});
  const [monthlyPurchaseCountInputs, setMonthlyPurchaseCountInputs] = useState<Record<string, string>>({});
  const [listFilter, setListFilter] = useState<"current" | "all">("current");
  const [allMonth, setAllMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchComparisonData();
  }, []);

  async function fetchComparisonData() {
    setLoading(true);
    setErrorMessage(null);
    const [listsResult, itemsResult, monthlyGoalsResult] = await Promise.all([
      supabase
        .from("shopping_lists")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("list_items")
        .select("name, category, price, quantity, created_at, list_id")
        .order("created_at", { ascending: true }),
      supabase.from("monthly_budget_goals").select("month_start, goal, purchases_count"),
    ]);

    if (listsResult.error || itemsResult.error) {
      setErrorMessage("Não foi possível carregar o comparativo de preços.");
    } else {
      setLists(normalizeComparisonLists((listsResult.data ?? []) as ShoppingList[]));
      setItems((itemsResult.data ?? []) as ComparisonItem[]);

      if (monthlyGoalsResult.error) {
        if (isMissingMonthlyGoalsTable(monthlyGoalsResult.error.code)) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const fallbackGoals: {
            goals: Record<string, number>;
            purchases: Record<string, number>;
          } = user
            ? readFallbackMonthlyGoals(user.id)
            : { goals: {}, purchases: {} };
          setMonthlyGoals(fallbackGoals.goals);
          setMonthlyGoalInputs(
            Object.fromEntries(
              Object.entries(fallbackGoals.goals).map(([monthStart, goal]) => [
                monthStart,
                goal > 0 ? String(goal) : "",
              ])
            )
          );
          setMonthlyPurchaseCounts(
            Object.fromEntries(
              Object.entries(fallbackGoals.purchases).map(([monthStart, count]) => [monthStart, count])
            )
          );
          setMonthlyPurchaseCountInputs(
            Object.fromEntries(
              Object.entries(fallbackGoals.purchases).map(([monthStart, count]) => [monthStart, String(count)])
            )
          );
        } else {
          setErrorMessage(`Não foi possível carregar as metas mensais: ${monthlyGoalsResult.error.message}`);
        }
      } else {
        const goals = (monthlyGoalsResult.data ?? []) as MonthlyBudgetGoal[];
        setMonthlyGoals(
          Object.fromEntries(goals.map((goal) => [goal.month_start, Number(goal.goal)]))
        );
        setMonthlyGoalInputs(
          Object.fromEntries(
            goals.map((goal) => [
              goal.month_start,
              Number(goal.goal) > 0 ? String(goal.goal) : "",
            ])
          )
        );
        setMonthlyPurchaseCounts(
          Object.fromEntries(
            goals.map((goal) => [goal.month_start, Math.max(1, Number(goal.purchases_count) || 1)])
          )
        );
        setMonthlyPurchaseCountInputs(
          Object.fromEntries(
            goals.map((goal) => [
              goal.month_start,
              String(Math.max(1, Number(goal.purchases_count) || 1)),
            ])
          )
        );
      }
    }
    setLoading(false);
  }

  async function handleSaveMonthlyGoal(monthStart: string) {
    const nextGoal = Number((monthlyGoalInputs[monthStart] ?? "").replace(",", "."));
    const nextPurchasesCount = Number(monthlyPurchaseCountInputs[monthStart] ?? "");
    if (!Number.isFinite(nextGoal) || nextGoal < 0 || !Number.isInteger(nextPurchasesCount) || nextPurchasesCount < 1) {
      setErrorMessage("Informe uma meta válida e um número inteiro de compras maior que zero.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage("Faça login para salvar a meta mensal.");
      return;
    }

    const { error } = await supabase.from("monthly_budget_goals").upsert(
      {
        user_id: user.id,
        month_start: monthStart,
        goal: nextGoal,
        purchases_count: nextPurchasesCount,
      },
      { onConflict: "user_id,month_start" }
    );

    if (error) {
      if (!isMissingMonthlyGoalsTable(error.code)) {
        setErrorMessage(`Não foi possível salvar a meta mensal: ${error.message}`);
        return;
      }

      const fallbackList = lists.find((list) => getMonthStart(list.created_at) === monthStart);
      if (!fallbackList) {
        setErrorMessage("Não foi possível encontrar uma lista para salvar a meta mensal.");
        return;
      }

      const fallbackResult = await supabase
        .from("shopping_lists")
        .update({ budget_goal: nextGoal })
        .eq("id", fallbackList.id);

      if (fallbackResult.error) {
        setErrorMessage(`Não foi possível salvar a meta mensal: ${fallbackResult.error.message}`);
        return;
      }

      setLists((current) =>
        current.map((list) =>
          list.id === fallbackList.id ? { ...list, budget_goal: nextGoal } : list
        )
      );
      writeFallbackMonthlyGoal(user.id, monthStart, nextGoal, nextPurchasesCount);
    }

    setErrorMessage(null);
    setMonthlyGoals((current) => ({ ...current, [monthStart]: nextGoal }));
    setMonthlyPurchaseCounts((current) => ({ ...current, [monthStart]: nextPurchasesCount }));
    setMonthlyGoalInputs((current) => ({
      ...current,
      [monthStart]: nextGoal > 0 ? String(nextGoal) : "",
    }));
    setMonthlyPurchaseCountInputs((current) => ({
      ...current,
      [monthStart]: String(nextPurchasesCount),
    }));
  }

  const catalogItems = productCatalog.map((product) => ({
    name: product.name,
    category: product.category,
  }));
  const currentMonth = getCurrentMonthStart();
  const availableMonths = Array.from(
    new Set(lists.filter((list) => !list.is_rollover && !isGeneratedRolloverName(list.name)).map((list) => list.month_start))
  ).sort((firstMonth, secondMonth) => secondMonth.localeCompare(firstMonth));
  const displayLists = [...lists]
    .filter((list) => {
      if (list.is_rollover || isGeneratedRolloverName(list.name)) return false;
      if (listFilter === "all") return allMonth === "all" || list.month_start === allMonth;
      return list.status === "active" && list.month_start === currentMonth;
    })
    .sort((firstList, secondList) => firstList.created_at.localeCompare(secondList.created_at));
  const displayListIds = new Set(displayLists.map((list) => list.id));
  const displayItems = items.filter((item) => displayListIds.has(item.list_id));
  const historicalItems = displayItems
    .filter(
      (item) => !catalogItems.some((product) => normalizeProductName(product.name) === normalizeProductName(item.name))
    )
    .map((item) => ({ name: item.name, category: item.category || "Outros" }));
  const comparisonProducts = [...catalogItems, ...historicalItems]
    .filter(
      (product, index, products) =>
        products.findIndex(
          (otherProduct) => normalizeProductName(otherProduct.name) === normalizeProductName(product.name)
        ) === index
    )
    .filter((product) =>
      displayItems.some(
        (item) =>
          normalizeProductName(item.name) === normalizeProductName(product.name) &&
          Number(item.price ?? 0) > 0
      )
    );
  const categories = Array.from(new Set(comparisonProducts.map((product) => product.category))).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
  const recentLists = [...displayLists]
    .sort((firstList, secondList) => secondList.created_at.localeCompare(firstList.created_at))
    .slice(0, 2)
    .reverse();
  const overallTotals = recentLists.map((list) => totalForList(list.id, displayItems));
  const overallChange = overallTotals.length === 2 ? overallTotals[1] - overallTotals[0] : null;
  const monthlyGroups = groupListsByMonth(displayLists);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/lists" className="text-sm text-neutral-500 hover:text-brand-600">
        ← Voltar para minhas listas
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-neutral-900">Comparativo de preços</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Histórico completo das listas; as variações usam somente as duas mais recentes.
      </p>

      {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}
      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Carregando histórico...</p>
      ) : displayLists.length === 0 ? (
        <p className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Nenhuma lista encontrada neste filtro.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro de listas do comparativo">
            {(["current", "all"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setListFilter(option)}
                className={`rounded-md px-3 py-2 text-sm ${
                  listFilter === option
                    ? "bg-brand-500 font-medium text-white"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {option === "current" ? "Mês atual" : "Todas"}
              </button>
            ))}
          </div>
          {listFilter === "all" && (
            <label className="block max-w-xs text-sm font-medium text-neutral-600" htmlFor="comparison-month">
              Mês das listas
              <select
                id="comparison-month"
                value={allMonth}
                onChange={(event) => setAllMonth(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">Todos os meses</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                Gasto por compra
              </h2>
              <div className="mt-3 divide-y divide-neutral-100">
                {displayLists.map((list) => {
                  const listTotal = totalForList(list.id, displayItems);
                  const isLatestComparison = recentLists.length === 2 && list.id === recentLists[1].id;

                  return (
                    <div key={list.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <Link
                          href={`/lists/${list.id}`}
                          className="font-medium text-neutral-800 hover:text-brand-600"
                        >
                          {list.name}
                        </Link>
                        <p className="text-xs text-neutral-400">{formatDate(list.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-neutral-900">{formatCurrency(listTotal)}</p>
                        {isLatestComparison && <ChangeLabel change={overallChange ?? 0} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                Gasto por mês
              </h2>
              <div className="mt-3 grid gap-4">
              {monthlyGroups.map(({ monthStart, lists: monthLists }) => {
                const monthTotal = monthLists.reduce(
                  (total, list) => total + totalForList(list.id, displayItems),
                  0
                );
                const monthlyGoal = monthlyGoals[monthStart];
                const monthlyBalance = (monthlyGoal ?? 0) - monthTotal;
                const hasMonthlyGoal = monthlyGoal !== undefined;
                const purchasesCount = monthlyPurchaseCounts[monthStart] ?? 1;
                const availablePerPurchase = hasMonthlyGoal
                  ? Math.max(monthlyBalance, 0) / purchasesCount
                  : 0;

                return (
                  <div key={monthStart} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <h3 className="font-semibold text-neutral-800">{formatMonth(monthStart)}</h3>
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleSaveMonthlyGoal(monthStart);
                      }}
                    >
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                        <label className="text-xs font-medium text-neutral-500" htmlFor={`goal-${monthStart}`}>
                          Meta do mês
                          <input
                            id={`goal-${monthStart}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={monthlyGoalInputs[monthStart] ?? ""}
                            onChange={(event) =>
                              setMonthlyGoalInputs((current) => ({
                                ...current,
                                [monthStart]: event.target.value,
                              }))
                            }
                            placeholder="Ex: 1.500,00"
                            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </label>
                        <label className="text-xs font-medium text-neutral-500" htmlFor={`purchases-${monthStart}`}>
                          Compras no mês
                          <input
                            id={`purchases-${monthStart}`}
                            type="number"
                            min="1"
                            step="1"
                            value={monthlyPurchaseCountInputs[monthStart] ?? ""}
                            onChange={(event) =>
                              setMonthlyPurchaseCountInputs((current) => ({
                                ...current,
                                [monthStart]: event.target.value,
                              }))
                            }
                            placeholder="Ex: 4"
                            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="self-end rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
                      >
                        Salvar
                      </button>
                    </form>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <SummaryMetric label="Gasto" value={formatCurrency(monthTotal)} />
                      <SummaryMetric
                        label={
                          !hasMonthlyGoal
                            ? "Meta não definida"
                            : monthlyBalance < 0
                              ? "Acima da meta"
                              : "Disponível para próximas compras"
                        }
                        value={
                          hasMonthlyGoal
                            ? formatCurrency(Math.abs(monthlyBalance))
                            : "Informe uma meta"
                        }
                        valueClassName={
                          !hasMonthlyGoal
                            ? "text-neutral-500"
                            : monthlyBalance < 0
                              ? "text-red-600"
                              : "text-emerald-700"
                        }
                      />
                    </div>
                    <div className="mt-3 border-t border-neutral-100 pt-3">
                      <SummaryMetric
                        label={`Disponível por compra/semana (${purchasesCount} compras)`}
                        value={hasMonthlyGoal ? formatCurrency(availablePerPurchase) : "Informe uma meta"}
                        valueClassName={hasMonthlyGoal ? "text-emerald-700" : "text-neutral-500"}
                      />
                    </div>
                  </div>
                );
                })}
              </div>
            </section>
          </div>
          {categories.map((category) => {
            const categoryProducts = comparisonProducts
              .filter((product) => product.category === category)
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

            return (
              <section key={category} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-brand-700">
                  {category}
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200 text-sm">
                    <thead className="bg-white text-left text-xs uppercase text-neutral-400">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 font-medium">Produto</th>
                        {displayLists.map((list) => (
                          <th key={list.id} className="whitespace-nowrap px-4 py-3 font-medium">
                            <Link
                              href={`/lists/${list.id}`}
                              className="block text-neutral-600 hover:text-brand-600"
                            >
                              {list.name}
                            </Link>
                            <span className="font-normal normal-case text-neutral-400">
                              {formatDate(list.created_at)}
                            </span>
                            <span className="mt-1 block font-medium normal-case text-brand-600">
                              Total: {formatCurrency(categoryTotal(category, list.id, displayItems))}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {categoryProducts.map((product) => (
                        <tr key={product.name}>
                          <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-neutral-800">
                            {product.name}
                          </th>
                          {displayLists.map((list) => {
                            const item = findListItem(product.name, list.id, displayItems);
                            const isLatestComparison =
                              recentLists.length === 2 && list.id === recentLists[1].id;
                            return (
                              <td key={list.id} className="whitespace-nowrap px-4 py-3 text-neutral-600">
                                <PriceCell
                                  productName={product.name}
                                  currentItem={item}
                                  previousLists={isLatestComparison ? recentLists.slice(0, 1) : []}
                                  items={displayItems}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {recentLists.length === 2 && (
                  <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                    <span className="font-medium text-neutral-700">Variação da categoria: </span>
                    <ChangeLabel
                      change={
                        categoryTotal(category, recentLists[1].id, displayItems) -
                        categoryTotal(category, recentLists[0].id, displayItems)
                      }
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function totalForList(listId: string, items: ComparisonItem[]) {
  return items
    .filter((item) => item.list_id === listId)
    .reduce((total, item) => total + Number(item.price ?? 0) * Number(item.quantity ?? 1), 0);
}

function isMissingMonthlyGoalsTable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function readFallbackMonthlyGoals(userId: string): {
  goals: Record<string, number>;
  purchases: Record<string, number>;
} {
  try {
    const stored = localStorage.getItem(`monthly-budget-goals:${userId}`);
    if (!stored) return { goals: {}, purchases: {} };
    return JSON.parse(stored) as {
      goals: Record<string, number>;
      purchases: Record<string, number>;
    };
  } catch {
    return { goals: {}, purchases: {} };
  }
}

function writeFallbackMonthlyGoal(
  userId: string,
  monthStart: string,
  goal: number,
  purchasesCount: number
) {
  const current = readFallbackMonthlyGoals(userId);
  localStorage.setItem(
    `monthly-budget-goals:${userId}`,
    JSON.stringify({
      goals: { ...current.goals, [monthStart]: goal },
      purchases: { ...current.purchases, [monthStart]: purchasesCount },
    })
  );
}

function groupListsByMonth(lists: ShoppingList[]) {
  const groups = new Map<string, ShoppingList[]>();
  lists.forEach((list) => {
    const monthStart = getMonthStart(list.created_at);
    groups.set(monthStart, [...(groups.get(monthStart) ?? []), list]);
  });

  return Array.from(groups, ([monthStart, monthLists]) => ({ monthStart, lists: monthLists }));
}

function normalizeComparisonLists(lists: ShoppingList[]) {
  return lists.map((list) => ({
    ...list,
    month_start: list.month_start || getMonthStart(list.created_at),
    status: list.status || "active",
    is_rollover: list.is_rollover || isGeneratedRolloverName(list.name),
  }));
}

function isGeneratedRolloverName(name: string) {
  return / - (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de \d{4}$/i.test(
    name
  );
}

function getCurrentMonthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function getMonthStart(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatMonth(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function findListItem(productName: string, listId: string, items: ComparisonItem[]) {
  return items
    .filter(
      (item) =>
        normalizeProductName(item.name) === normalizeProductName(productName) &&
        item.list_id === listId
    )
    .sort((firstItem, secondItem) => secondItem.created_at.localeCompare(firstItem.created_at))[0];
}

function categoryTotal(category: string, listId: string, items: ComparisonItem[]) {
  return items
    .filter((item) => (item.category || "Outros") === category && item.list_id === listId)
    .reduce((total, item) => total + Number(item.price ?? 0) * Number(item.quantity ?? 1), 0);
}

function PriceCell({
  productName,
  currentItem,
  previousLists,
  items,
}: {
  productName: string;
  currentItem?: ComparisonItem;
  previousLists: ShoppingList[];
  items: ComparisonItem[];
}) {
  if (!currentItem || Number(currentItem.price) <= 0) {
    return <span className="text-neutral-400">—</span>;
  }

  const previousItem = previousLists
    .map((list) => findListItem(productName, list.id, items))
    .reverse()
    .find((item) => item && Number(item.price) > 0);

  const currentPrice = Number(currentItem.price);
  if (!previousItem) return <span>{formatCurrency(currentPrice)}</span>;

  const previousPrice = Number(previousItem.price);
  const priceChange = currentPrice - previousPrice;
  const priceArrow = priceChange < 0 ? "↓" : priceChange > 0 ? "↑" : "→";
  const arrowClassName =
    priceChange < 0 ? "text-emerald-700" : priceChange > 0 ? "text-red-600" : "text-neutral-500";
  const changeDescription =
    priceChange < 0
      ? "Preço menor que a compra anterior"
      : priceChange > 0
        ? "Preço maior que a compra anterior"
        : "Preço igual à compra anterior";
  const changeLabel =
    priceChange < 0
      ? `${formatCurrency(Math.abs(priceChange))} mais barato`
      : priceChange > 0
        ? `${formatCurrency(priceChange)} mais caro`
        : "Mesmo preço";

  return (
    <span className="inline-flex items-center gap-2">
      {formatCurrency(currentPrice)}
      <span className={`text-base font-semibold ${arrowClassName}`} title={changeDescription}>
        {priceArrow}
      </span>
      <span className={`text-xs font-medium ${arrowClassName}`}>{changeLabel}</span>
    </span>
  );
}

function ChangeLabel({ change }: { change: number }) {
  if (change === 0) {
    return <span className="text-neutral-500">Igual ao anterior</span>;
  }

  const isHigher = change > 0;
  return (
    <span className={isHigher ? "text-red-600" : "text-emerald-700"}>
      {isHigher ? "Maior" : "Menor"} que a anterior em {formatCurrency(Math.abs(change))}
    </span>
  );
}

function SummaryMetric({
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase text-neutral-400">{label}</p>
      <p className={`mt-1 font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}