"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";

const AdquisicionForm = dynamic(() =>
  import("@/components/AdquisicionForm").then((m) => m.AdquisicionForm),
);
import type { SessionUser } from "@/lib/auth";
import { roleLabel } from "@/lib/auth-client";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/inventario", label: "Inventario" },
  { href: "/ventas", label: "Ventas" },
  { href: "/credito", label: "Crédito" },
];

type Props = {
  suggestedStockNo: string;
  suggestedAccStockNo?: string;
  today: string;
  user: SessionUser;
};

export function Nav({
  suggestedStockNo,
  suggestedAccStockNo = "ACC001",
  today,
  user,
}: Props) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";
  const visibleLinks = isAdmin
    ? links
    : links.filter((l) => l.href === "/inventario");

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link
          href={isAdmin ? "/" : "/inventario"}
          className="brand-mark"
          aria-label={isAdmin ? "CeluMB inicio" : "CeluMB inventario"}
        >
          <span className="brand-mark__glyph" aria-hidden>
            ◈
          </span>
          <span>
            <span className="brand-mark__text">CeluMB</span>
            <span className="brand-mark__sub">MB Celulares</span>
          </span>
        </Link>
        <div className="site-header__actions">
          <nav className="site-nav" aria-label="Principal">
            {visibleLinks.map((l) => {
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    active ? "site-nav__link is-active" : "site-nav__link"
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {isAdmin && (
            <AdquisicionForm
              suggestedStockNo={suggestedStockNo}
              suggestedAccStockNo={suggestedAccStockNo}
              today={today}
              variant="nav"
            />
          )}
          <div className="nav-user">
            <span className="nav-user__role">{roleLabel(user.role)}</span>
            <span className="nav-user__name">{user.username}</span>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost-nav">
                Salir
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
