"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  Newspaper,
  Briefcase,
  BarChart3,
  GitCompareArrows,
  NotebookTabs,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Markets", icon: BarChart3 },
  { href: "/research", label: "Research", icon: NotebookTabs },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/watchlist", label: "Watchlist", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
              isActive
                ? "bg-accent text-foreground"
                : "text-foreground/60 hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
