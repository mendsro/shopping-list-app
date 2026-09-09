import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lista de Compras",
  description: "Organize suas compras de mercado em listas colaborativas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
