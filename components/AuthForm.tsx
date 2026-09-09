"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(traduzirErro(error.message));
      } else {
        router.push("/lists");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setErrorMessage(traduzirErro(error.message));
      } else {
        setInfoMessage(
          "Conta criada! Verifique seu e-mail para confirmar o cadastro."
        );
      }
    }

    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-neutral-900">
        {mode === "signin" ? "Entrar" : "Criar conta"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Gerencie suas listas de compras de mercado em um só lugar.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="voce@exemplo.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Mínimo de 6 caracteres"
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}
        {infoMessage && (
          <p className="text-sm text-brand-600">{infoMessage}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Carregando..."
            : mode === "signin"
              ? "Entrar"
              : "Criar conta"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setErrorMessage(null);
          setInfoMessage(null);
        }}
        className="mt-4 text-sm text-neutral-500 underline-offset-2 hover:text-brand-600 hover:underline"
      >
        {mode === "signin"
          ? "Não tem conta? Cadastre-se"
          : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}

function traduzirErro(mensagem: string) {
  if (mensagem.includes("Invalid login credentials")) {
    return "E-mail ou senha inválidos.";
  }
  if (mensagem.includes("User already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  return mensagem;
}
