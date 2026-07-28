import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travel Bingo",
    short_name: "트래블빙고",
    description: "걷고, 발견하고, 빙고를 완성하는 여행 미션",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf6",
    theme_color: "#173a2c",
    orientation: "portrait",
    lang: "ko",
    categories: ["travel", "lifestyle", "games"],
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
