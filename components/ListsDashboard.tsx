"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { ShoppingList } from "@/lib/types";

type ListFilter = "current" | "archived" | "all";

function getTodayInputDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export default function ListsDashboard({ userId }: { userId: string }) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [newListName, setNewListName] = useState("");
  const [newListDate, setNewListDate] = useState(getTodayInputDate());
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [filter, setFilter] = useState<ListFilter>("current");
  const [archivedMonth, setArchivedMonth] = useState("all");
  const [allMonth, setAllMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLists() {
    setLoading(true);
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("*")
      .order("month_start", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (!isMissingMonthColumns(error.code)) {
        setErrorMessage(`Não foi possível carregar suas listas: ${error.message}`);
        setLoading(false);
        return;
      }

      const fallbackResult = await supabase
        .from("shopping_lists")
        .select("*")
        .order("created_at", { ascending: false });

      if (fallbackResult.error) {
        setErrorMessage(`Não foi possível carregar suas listas: ${fallbackResult.error.message}`);
      } else {
        setLists(normalizeLegacyLists(fallbackResult.data ?? [], userId));
        setErrorMessage(null);
      }
    } else {
      setLists(applyLocalArchivedState((data ?? []) as ShoppingList[], userId));
      setErrorMessage(null);
    }
    setLoading(false);
  }

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name || !newListDate) return;
    const monthStart = `${newListDate.slice(0, 7)}-01`;
    const createdAt = `${newListDate}T12:00:00`;

    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ name, user_id: userId, created_at: createdAt, month_start: monthStart, status: "active" })
      .select()
      .single();

    if (error) {
      if (!isMissingMonthColumns(error.code)) {
        setErrorMessage(`Não foi possível criar a lista: ${error.message}`);
        return;
      }

      const legacyResult = await supabase
        .from("shopping_lists")
        .insert({ name, user_id: userId, created_at: createdAt })
        .select()
        .single();

      if (legacyResult.error || !legacyResult.data) {
        setErrorMessage(`Não foi possível criar a lista: ${legacyResult.error?.message ?? "erro desconhecido"}`);
        return;
      }

      const legacyList = { ...normalizeLegacyList(legacyResult.data), month_start: monthStart };
      saveLocalListMonth(userId, legacyList.id, legacyList.month_start);
      setLists((current) => [legacyList, ...current]);
      setNewListName("");
      setNewListDate(getTodayInputDate());
      return;
    }

    setLists((current) => [data as ShoppingList, ...current]);
    setNewListName("");
    setNewListDate(getTodayInputDate());
  }

  async function handleDeleteList(id: string) {
    const confirmed = window.confirm("Excluir esta lista e todos os itens?");
    if (!confirmed) return;

    const { error } = await supabase.from("shopping_lists").delete().eq("id", id);
    if (error) {
      setErrorMessage("Não foi possível excluir a lista.");
      return;
    }
    setLists((current) => current.filter((list) => list.id !== id));
  }

  function startEditingList(list: ShoppingList) {
    setEditingListId(list.id);
    setEditingListName(list.name);
  }

  function cancelEditingList() {
    setEditingListId(null);
    setEditingListName("");
  }

  async function handleRenameList(id: string) {
    const name = editingListName.trim();
    if (!name) return;

    const { error } = await supabase
      .from("shopping_lists")
      .update({ name })
      .eq("id", id);

    if (error) {
      setErrorMessage(`Não foi possível alterar o nome da lista: ${error.message}`);
      return;
    }

    setLists((current) =>
      current.map((list) => (list.id === id ? { ...list, name } : list))
    );
    cancelEditingList();
  }

  async function handleRestoreList(list: ShoppingList) {
    const { error } = await supabase
      .from("shopping_lists")
      .update({ status: "active", month_start: getCurrentMonthStart() })
      .eq("id", list.id);

    if (error && !isMissingMonthColumns(error.code)) {
      setErrorMessage(`Não foi possível desarquivar a lista: ${error.message}`);
      return;
    }

    removeLocalArchivedList(userId, list.id);
    saveLocalListMonth(userId, list.id, getCurrentMonthStart());

    setLists((current) =>
      current.map((currentList) =>
        currentList.id === list.id
          ? { ...currentList, status: "active", month_start: getCurrentMonthStart() }
          : currentList
      )
    );
  }

  async function handleCloseMonth(list: ShoppingList) {
    const confirmed = window.confirm(
      "Fechar esta lista e criar uma nova para o próximo mês? Os itens não concluídos serão copiados."
    );
    if (!confirmed) return;

    const nextMonth = getNextMonthStart(list.month_start);
    const { data: createdList, error: createError } = await supabase
      .from("shopping_lists")
      .insert({
        name: `${list.name} - ${formatMonth(nextMonth)}`,
        user_id: userId,
        month_start: nextMonth,
        status: "active",
        is_rollover: true,
      })
      .select()
      .single();

    let newList: ShoppingList | null = createdList as ShoppingList | null;
    if (createError || !newList) {
      if (!isMissingMonthColumns(createError?.code)) {
        setErrorMessage(`Não foi possível criar a lista do próximo mês: ${createError?.message ?? "erro desconhecido"}`);
        return;
      }

      const legacyResult = await supabase
        .from("shopping_lists")
        .insert({ name: `${list.name} - ${formatMonth(nextMonth)}`, user_id: userId })
        .select()
        .single();

      if (legacyResult.error || !legacyResult.data) {
        setErrorMessage(`Não foi possível criar a lista do próximo mês: ${legacyResult.error?.message ?? "erro desconhecido"}`);
        return;
      }

      newList = {
        ...normalizeLegacyList(legacyResult.data),
        month_start: nextMonth,
        is_rollover: true,
      };
      saveLocalListMonth(userId, newList.id, nextMonth);
    }

    const { error: archiveError } = await supabase
      .from("shopping_lists")
      .update({ status: "archived" })
      .eq("id", list.id);

    if (archiveError && !isMissingMonthColumns(archiveError.code)) {
      await supabase.from("shopping_lists").delete().eq("id", newList.id);
      setErrorMessage(`Não foi possível arquivar a lista anterior: ${archiveError.message}`);
      return;
    }

    saveLocalArchivedList(userId, list.id);

    setLists((current) => [
      { ...list, status: "archived" },
      newList,
      ...current.filter((currentList) => currentList.id !== list.id && currentList.id !== newList.id),
    ]);
  }

  const currentMonth = getCurrentMonthStart();
  const archivedMonths = Array.from(
    new Set(
      lists
        .filter(
          (list) =>
            list.status === "archived" &&
            !list.is_rollover &&
            !isGeneratedRolloverName(list.name)
        )
        .map((list) => list.month_start)
    )
  ).sort((firstMonth, secondMonth) => secondMonth.localeCompare(firstMonth));
  const allMonths = Array.from(
    new Set(
      lists
        .filter((list) => !list.is_rollover && !isGeneratedRolloverName(list.name))
        .map((list) => list.month_start)
    )
  ).sort((firstMonth, secondMonth) => secondMonth.localeCompare(firstMonth));
  const visibleLists = lists.filter((list) => {
    if (list.is_rollover || isGeneratedRolloverName(list.name)) return false;
    if (filter === "archived") {
      return list.status === "archived" && (archivedMonth === "all" || list.month_start === archivedMonth);
    }
    if (filter === "all") return allMonth === "all" || list.month_start === allMonth;
    return list.status === "active" && list.month_start === currentMonth;
  });
  const listsByMonth = visibleLists.reduce<Record<string, ShoppingList[]>>((groups, list) => {
    (groups[list.month_start] ??= []).push(list);
    return groups;
  }, {});
  const visibleMonths = Object.keys(listsByMonth).sort((firstMonth, secondMonth) =>
    secondMonth.localeCompare(firstMonth)
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Painel de compras</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">Organize seu mercado</h1>
        <p className="mt-1 text-sm text-neutral-500">Crie uma lista, acompanhe os gastos e mantenha cada mês no lugar.</p>
      </div>
      <form onSubmit={handleCreateList} className="rounded-lg border border-brand-100 border-l-4 border-l-brand-500 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-neutral-800">Nova compra</div>
        <div className="flex flex-wrap items-end gap-2">
        <input
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          placeholder="Nova lista (ex: Compras da semana)"
          className="min-w-[12rem] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <label className="text-xs font-medium text-neutral-500">
          Data da compra
          <input
            type="date"
            value={newListDate}
            onChange={(event) => setNewListDate(event.target.value)}
            className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm font-normal text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          Criar lista
        </button>
        </div>
      </form>

      {errorMessage && (
        <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtro de listas">
        {(["current", "archived", "all"] as ListFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-md px-3 py-2 text-sm ${
              filter === option ? "bg-brand-500 font-medium text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {option === "current" ? "Mês atual" : option === "archived" ? "Arquivadas" : "Todas"}
          </button>
        ))}
      </div>

      {filter === "archived" && (
        <label className="mt-3 block max-w-xs text-sm font-medium text-neutral-600" htmlFor="archived-month">
          Mês das listas arquivadas
          <select
            id="archived-month"
            value={archivedMonth}
            onChange={(event) => setArchivedMonth(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">Todos os meses</option>
            {archivedMonths.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </label>
      )}

      {filter === "all" && (
        <label className="mt-3 block max-w-xs text-sm font-medium text-neutral-600" htmlFor="all-month">
          Mês das listas
          <select
            id="all-month"
            value={allMonth}
            onChange={(event) => setAllMonth(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">Todos os meses</option>
            {allMonths.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        <li className="border-b border-neutral-200 bg-brand-50 px-4 py-3">
          <Link
            href="/lists/comparativos"
            className="block text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Comparativo de preços
            <span className="mt-1 block text-xs font-normal text-brand-600">
              Compare os preços dos produtos entre suas compras
            </span>
          </Link>
        </li>
        {loading && (
          <li className="px-4 py-6 text-sm text-neutral-500">Carregando listas...</li>
        )}

        {!loading && visibleLists.length === 0 && (
          <li className="px-4 py-6 text-sm text-neutral-500">
            Nenhuma lista encontrada neste filtro.
          </li>
        )}

        {filter === "all"
          ? visibleMonths.map((month) => (
              <li key={month} className="list-none">
                <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {formatMonth(month)}
                </h2>
                <ul className="divide-y divide-neutral-200">
                  {listsByMonth[month].map((list) => renderList(list))}
                </ul>
              </li>
            ))
          : visibleLists.map((list) => renderList(list))}
      </ul>
    </div>
  );

  function renderList(list: ShoppingList) {
    return (
      <li key={list.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
              {editingListId === list.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={editingListName}
                    onChange={(event) => setEditingListName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleRenameList(list.id);
                      if (event.key === "Escape") cancelEditingList();
                    }}
                    className="w-56 rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    aria-label={`Novo nome de ${list.name}`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleRenameList(list.id)}
                    className="text-xs text-brand-600 hover:text-brand-800"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingList}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <Link
                  href={`/lists/${list.id}`}
                  className="text-sm font-medium text-neutral-900 hover:text-brand-600"
                >
                  {list.name}
                </Link>
              )}
              <p className="mt-1 text-xs text-neutral-400">{formatMonth(list.month_start)}</p>
            </div>
            <div className="flex items-center gap-3">
              {editingListId !== list.id && (
                <button
                  type="button"
                  onClick={() => startEditingList(list)}
                  className="text-xs text-brand-600 hover:text-brand-800"
                >
                  Editar nome
                </button>
              )}
              {list.status === "active" ? (
                <button
                  onClick={() => handleCloseMonth(list)}
                  className="text-xs text-brand-600 hover:text-brand-800"
                >
                  Fechar mês
                </button>
              ) : (
                <button
                  onClick={() => handleRestoreList(list)}
                  className="text-xs text-brand-600 hover:text-brand-800"
                >
                  Desarquivar
                </button>
              )}
              <button
                onClick={() => handleDeleteList(list.id)}
                className="text-xs text-neutral-400 hover:text-red-600"
              >
                Excluir
              </button>
            </div>
      </li>
    );
  }
}

function isMissingMonthColumns(code?: string) {
  return code === "42703" || code === "PGRST204" || code === "PGRST205";
}

function isGeneratedRolloverName(name: string) {
  return / - (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de \d{4}$/i.test(
    name
  );
}

function normalizeLegacyList(
  list: Omit<ShoppingList, "month_start" | "status">,
  archivedIds = new Set<string>()
): ShoppingList {
  return {
    ...list,
    month_start: getCurrentMonthStart(),
    status: archivedIds.has(list.id) ? "archived" : "active",
    is_rollover: false,
  };
}

function normalizeLegacyLists(lists: Array<Omit<ShoppingList, "month_start" | "status">>, userId: string) {
  const archivedIds = readLocalArchivedLists(userId);
  const monthMap = readLocalListMonths(userId);
  return lists.map((list) => ({
    ...normalizeLegacyList(list, archivedIds),
    month_start: monthMap[list.id] ?? getCurrentMonthStart(),
  }));
}

function applyLocalArchivedState(lists: ShoppingList[], userId: string) {
  const archivedIds = readLocalArchivedLists(userId);
  return lists.map((list) =>
    archivedIds.has(list.id) && list.status !== "active"
      ? { ...list, status: "archived" as const }
      : list
  );
}

function readLocalArchivedLists(userId: string) {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(`archived-lists:${userId}`) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function saveLocalArchivedList(userId: string, listId: string) {
  const archivedIds = readLocalArchivedLists(userId);
  archivedIds.add(listId);
  localStorage.setItem(`archived-lists:${userId}`, JSON.stringify([...archivedIds]));
}

function removeLocalArchivedList(userId: string, listId: string) {
  const archivedIds = readLocalArchivedLists(userId);
  archivedIds.delete(listId);
  localStorage.setItem(`archived-lists:${userId}`, JSON.stringify([...archivedIds]));
}

function readLocalListMonths(userId: string) {
  try {
    return JSON.parse(localStorage.getItem(`list-months:${userId}`) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function saveLocalListMonth(userId: string, listId: string, monthStart: string) {
  localStorage.setItem(
    `list-months:${userId}`,
    JSON.stringify({ ...readLocalListMonths(userId), [listId]: monthStart })
  );
}

function getCurrentMonthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function getNextMonthStart(monthStart: string) {
  const date = new Date(`${monthStart}T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatMonth(monthStart: string) {
  return new Date(`${monthStart}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}
