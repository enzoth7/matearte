"use client";

import { useEffect } from "react";
import { clearLocalCart, localMergeKey, readLocalCart } from "@/lib/browser-cart";

export function CartMerger() {
  useEffect(() => {
    const items = readLocalCart(); if (!items.length) return;
    fetch("/api/session", { cache: "no-store" }).then((response) => response.json()).then(async (session) => {
      if (!session.authenticated) return;
      const response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mergeKey: localMergeKey(), items }) });
      if (response.ok) clearLocalCart();
    }).catch(() => undefined);
  }, []);
  return null;
}
