import Link from "next/link";
import { redirect } from "next/navigation";
import { EditPhonePage } from "@/components/EditPhonePage";
import { getSession } from "@/lib/auth";
import { getPhoneByStockNo } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ stockNo: string }> };

export default async function InventarioEditPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/inventario");

  const { stockNo } = await params;
  const phone = await getPhoneByStockNo(decodeURIComponent(stockNo));
  if (!phone) {
    return (
      <section className="section" style={{ marginTop: 0 }}>
        <Link href="/inventario" className="btn btn-solid edit-phone-page__back">
          Regresar
        </Link>
        <h1 className="section__title">Equipo no encontrado</h1>
        <p className="section__lede">
          No hay un celular con el número {decodeURIComponent(stockNo)}.
        </p>
      </section>
    );
  }

  return (
    <section className="section" style={{ marginTop: 0 }}>
      <EditPhonePage
        phone={phone}
        googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || ""}
      />
    </section>
  );
}
