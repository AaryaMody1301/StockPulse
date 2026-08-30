"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Newspaper,
  Briefcase,
  BarChart3,
  GitCompareArrows,
  NotebookTabs,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "Markets", icon: BarChart3 },
  { href: "/research", label: "Research", icon: NotebookTabs },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/watchlist", label: "Watchlist", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-14 z-50 border-b bg-background p-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
