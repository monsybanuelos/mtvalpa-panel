import type { Role } from "./auth-edge";

export function roleLabel(role: Role): string {
  return role === "admin" ? "Admin" : "Ventas";
}
