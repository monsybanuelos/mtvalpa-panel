import { useCloudDb } from "./cloud-env";
import { daysBetween } from "./format";
import type { Phone } from "./db";
import * as local from "./db";
import * as cloud from "./db-cloud";

export async function getDashboardStats() {
  if (useCloudDb()) return cloud.getDashboardStats();
  return local.getDashboardStats();
}

export async function listPhones(filter?: "disponible" | "vendido" | "all") {
  if (useCloudDb()) return cloud.listPhones(filter);
  return local.listPhones(filter);
}

export async function listAvailablePhones() {
  if (useCloudDb()) return cloud.listAvailablePhones();
  return local.listAvailablePhones();
}

export async function listSales() {
  if (useCloudDb()) return cloud.listSales();
  return local.listSales();
}

export async function incomeByChannel() {
  if (useCloudDb()) return cloud.incomeByChannel();
  return local.incomeByChannel();
}

export async function listCreditAccounts() {
  if (useCloudDb()) return cloud.listCreditAccounts();
  return local.listCreditAccounts();
}

export async function listCollections(limit = 40) {
  if (useCloudDb()) return cloud.listCollections(limit);
  return local.listCollections(limit);
}

export async function listLedger(limit = 40) {
  if (useCloudDb()) return cloud.listLedger(limit);
  return local.listLedger(limit);
}

export async function listSupplierCredits() {
  if (useCloudDb()) return cloud.listSupplierCredits();
  return local.listSupplierCredits();
}

export async function listAccessories() {
  if (useCloudDb()) return cloud.listAccessories();
  return local.listAccessories();
}

export async function nextStockNo() {
  if (useCloudDb()) return cloud.nextStockNo();
  return local.nextStockNo();
}

export async function nextAccStockNo() {
  if (useCloudDb()) return cloud.nextAccStockNo();
  return local.nextAccStockNo();
}

export async function listLowish(): Promise<(Phone & { days: number })[]> {
  const phones = await listPhones("disponible");
  return phones
    .map((p) => ({ ...p, days: daysBetween(p.acquired_at) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 8);
}
