"use client";

export function PrintButtonClient() {
  return (
    <button
      type="button"
      className="btn btn-solid"
      onClick={() => window.print()}
    >
      Imprimir / PDF
    </button>
  );
}
