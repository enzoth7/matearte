import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CatalogCollectionId } from "@/types/catalog";

const assets = "/assets/matearte/home-v2";

const collections: ReadonlyArray<{
  id: CatalogCollectionId;
  nameKey: "collectionEstribo" | "collectionUruguay" | "collectionAlfonsina";
  descriptionKey: "collectionEstriboBody" | "collectionUruguayBody" | "collectionAlfonsinaBody";
  image: string;
  imagePosition: string;
}> = [
  {
    id: "estribo",
    nameKey: "collectionEstribo",
    descriptionKey: "collectionEstriboBody",
    image: "collection-estribo-estancia.png",
    imagePosition: "center center",
  },
  {
    id: "uruguay",
    nameKey: "collectionUruguay",
    descriptionKey: "collectionUruguayBody",
    image: "collection-uruguay-estancia.png",
    imagePosition: "center center",
  },
  {
    id: "alfonsina",
    nameKey: "collectionAlfonsina",
    descriptionKey: "collectionAlfonsinaBody",
    image: "collection-alfonsina-campo.png",
    imagePosition: "center center",
  },
];

export async function HomeFeaturedProducts() {
  const t = await getTranslations("home");

  return (
    <section className="home-section home-scroll-band home-featured-section" aria-labelledby="home-featured-title">
      <div className="home-shell">
        <div className="home-featured-header">
          <h2 id="home-featured-title" className="home-featured-title">{t("featuredTitle")}</h2>
        </div>

        <div className="home-featured-track" aria-label={t("featuredTitle")}>
          {collections.map((collection) => (
            <article key={collection.id} className="home-featured-card">
              <Link
                className="home-featured-card-link"
                href={{ pathname: "/catalogo", query: { coleccion: collection.id } }}
                aria-label={t("viewCollectionAria", { collection: t(collection.nameKey) })}
              >
                <div className="home-featured-media">
                  <Image
                    src={`${assets}/${collection.image}`}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 82vw, (max-width: 1023px) 48vw, 33vw"
                    className="home-featured-image"
                    style={{ objectPosition: collection.imagePosition }}
                  />
                  <span className="home-featured-grain" aria-hidden="true" />
                  <span className="home-featured-scrim" aria-hidden="true" />
                  <div className="home-featured-meta">
                    <h3 className="home-featured-card-title">{t(collection.nameKey)}</h3>
                    <p className="home-featured-card-description">{t(collection.descriptionKey)}</p>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
