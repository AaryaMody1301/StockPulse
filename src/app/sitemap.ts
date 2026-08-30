import type { MetadataRoute } from "next";
import { absoluteAppUrl } from "@/lib/app-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/news", "/compare", "/watchlist", "/portfolio", "/research"];
  return routes.map((path) => ({
    url: absoluteAppUrl(path),
    changeFrequency: path === "/" || path === "/news" ? "hourly" : "daily",
    priority: path === "/" ? 1 : path === "/research" ? 0.9 : 0.7,
  }));
}
