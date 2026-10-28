import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meu Treino", short_name: "Meu Treino", description: "Programa local-first de musculação e cardio em 12 semanas.",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait", background_color: "#F8FAFC", theme_color: "#16A34A", lang: "pt-BR", categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Iniciar treino", short_name: "Treinar", url: "/treinar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Registrar peso", short_name: "Peso", url: "/evolucao", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
