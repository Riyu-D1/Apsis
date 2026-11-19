import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ORBITAL // FOCUS",
    short_name: "ORBITAL",
    description:
      "A deep-work flight deck — live NASA telemetry, mission timers, and a boarding pass for every session.",
    start_url: "/",
    display: "standalone",
    background_color: "#050507",
    theme_color: "#050507",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
