import { redirect } from "next/navigation";
import { VentasStock } from "@/components/VentasStock";
import { getSession } from "@/lib/auth";
import { listSalesStock } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "admin") {
    const phones = await listSalesStock();
    return (
      <>
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section__head">
            <div>
              <h1 className="section__title">Inventario</h1>
              <p className="section__lede">
                Celulares. Descarga las fotos o genera la publicación para
                ventas.
              </p>
            </div>
          </div>
        </section>
        <section className="section">
          <VentasStock phones={phones} />
        </section>
      </>
    );
  }

  const { AdminInventario } = await import("./admin-inventario");
  return <AdminInventario />;
}
