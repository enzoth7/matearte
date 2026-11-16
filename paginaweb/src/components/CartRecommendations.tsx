"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { CartRecommendation } from "@/lib/cart-recommendations";
import type { Money } from "@/types/catalog";
import { getVariantColorBackground } from "@/lib/catalog-filters";
import styles from "./Cart.module.css";

export function CartRecommendations({ recommendations, adding, blocked, onAdd, format }: {
  recommendations: CartRecommendation[]; adding: string; blocked?: boolean; onAdd: (item: CartRecommendation) => void; format: (price: Money) => string;
}) {
  const t = useTranslations("cart");
  if (!recommendations.length) return null;
  return <section className={styles.related} aria-labelledby="cart-related-title">
    <h2 id="cart-related-title">{t("relatedTitle")}</h2>
    <div className={styles.rail} tabIndex={0} role="region" aria-label={t("relatedBrowse")} data-lenis-prevent>
      {recommendations.map(item => <article className={styles.recommendation} key={item.product.id}>
        <div className={styles.productPhoto}>
          <Image src={item.product.images.find(i => i.variantId === item.variant.id)?.src ?? item.product.images[0]?.src ?? "/assets/matearte/profile-orders-desktop/catalog-fallback.webp"} alt={item.product.name} fill sizes="(max-width: 767px) 266px, (max-width: 1199px) 30vw, 282px" unoptimized />
          {item.product.quickVariantId && <button type="button" className={styles.quickAdd} disabled={Boolean(adding) || blocked} aria-busy={adding === item.product.id} aria-label={t(adding === item.product.id ? "addingItem" : "addItem", { item: item.product.name })} onClick={() => onAdd(item)}>
            <Image src="/assets/matearte/cart-desktop/quick-add-cart.svg" alt="" width={24} height={24} aria-hidden="true" />
            <strong aria-hidden="true">{adding === item.product.id ? "…" : "+"}</strong>
          </button>}
        </div>
        <div className={styles.productCopy}><h3>{item.product.name}</h3><div>{format(item.variant.price!)}</div>
          {item.product.variants.some(v => v.color) && <ul className={styles.swatches} aria-label={t("availableColors")}>
            {item.product.variants.filter((v,index,all) => v.available === true && v.color && all.findIndex(other => other.color === v.color) === index).map(v => <li key={v.id} title={v.label} aria-label={v.label} style={{ background: getVariantColorBackground(v) }} />)}
          </ul>}
        </div>
        <Link className={styles.viewProduct} href={{ pathname: "/producto/[slug]", params: { slug: item.product.slug } }}>{t("viewProduct")}</Link>
      </article>)}
    </div>
  </section>;
}
