import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProductGallery } from "@/components/ProductGallery";
import { VariantPanel } from "@/components/VariantPanel";
import { CommercePurchasePanel } from "@/components/CommercePurchasePanel";
import { getProduct, products } from "@/data/catalog";
import { absoluteUrl } from "@/lib/metadata";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.summary,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: { images: [{ url: product.images[0].src, width: product.images[0].width, height: product.images[0].height, alt: product.images[0].alt }] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary,
    image: product.images.map((image) => absoluteUrl(image.src)),
    category: product.category,
    material: product.materials.join(", "),
    url: absoluteUrl(`/producto/${product.slug}`),
  };
  return (
    <main id="contenido" className="pb-24 pt-8 md:pb-36 md:pt-12">
      <JsonLd data={schema} />
      <div className="container-shell">
        <div className="mb-6 text-xs font-semibold tracking-[0.12em] uppercase text-black/55">
          <Link href="/catalogo" className="text-link">Catálogo</Link> / <Link href={`/catalogo/${product.category}`} className="text-link capitalize">{product.category}</Link>
        </div>
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7"><ProductGallery images={product.images} /></div>
          <div className="lg:sticky lg:top-32 lg:col-span-4 lg:col-start-9">
            <p className="eyebrow text-[var(--leather)]">{product.eyebrow}</p>
            <h1 className="display-md mt-6">{product.name}</h1>
            <p className="mt-6 text-lg leading-8 text-black/68">{product.summary}</p>
            <p className="mt-5 text-sm leading-7 text-black/58">{product.description}</p>
            <div className="my-7 flex flex-wrap gap-2">{product.materials.map((material) => <span key={material} className="border border-black/20 px-3 py-1.5 text-xs font-medium">{material}</span>)}</div>
            <VariantPanel variants={product.variants} />
            <CommercePurchasePanel slug={product.slug} />
            <Link className="button-secondary mt-6 w-full" href="/personalizados">Conocer personalización</Link>
            <p className="legal-note mt-6">Imagen de referencia del catálogo público. Terminaciones y disponibilidad deben validarse antes de comprar.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
