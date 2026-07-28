import { api } from "@/src/api/client";

export type InteractionEvent = "view" | "wishlist" | "review" | "shortlist_add" | "cart_add";

/**
 * Fire-and-forget interaction logger. Silently ignored if user is unauthenticated.
 */
export function logInteraction(product_id: string, event: InteractionEvent) {
  api("/interactions", { method: "POST", auth: true, body: { product_id, event } }).catch(() => {});
}
