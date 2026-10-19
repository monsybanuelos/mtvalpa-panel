import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";
import { getSession } from "@/lib/auth";
import { nextAccStockNo, nextStockNo } from "@/lib/queries";
import { todayISO } from "@/lib/format";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "CeluMB — MB Celulares",
  description:
    "Inventario por No. de stock, ventas e ingresos, crédito y cobranza para MB Celulares.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  const hdrs = await headers();
  const path = hdrs.get("x-celumb-path") || "";
  const isShare = path.startsWith("/compartir");
  const showAppChrome = Boolean(session) && !isShare;
  const suggestedStockNo = showAppChrome ? await nextStockNo() : "MBC01";
  const suggestedAccStockNo = showAppChrome ? await nextAccStockNo() : "ACC001";
  const today = todayISO();

  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          {showAppChrome && session && (
            <Nav
              suggestedStockNo={suggestedStockNo}
              suggestedAccStockNo={suggestedAccStockNo}
              today={today}
              user={session}
            />
          )}
          <main
            className={
              isShare ? "flex-1" : showAppChrome ? "shell flex-1" : "flex-1"
            }
          >
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
