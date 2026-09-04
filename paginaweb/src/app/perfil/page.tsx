import { ArrowRight, Cake, CheckCircle, Clock, EnvelopeSimple, MapPin, Package, PencilSimple, Receipt, ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { VisualizerProfileButton } from "@/components/VisualizerProfileButton";
import { localizeCatalogSnapshotTitle } from "@/content/catalog-localization";
import { Link } from "@/i18n/navigation";
import { localizedAlternates } from "@/i18n/metadata";
import { localizeCanonicalPath } from "@/i18n/paths";
import { products } from "@/data/catalog";
import { countryName } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { isActiveOrder, isConfirmedOrder, orderStatusTone } from "@/lib/order-status";
import { requireUser } from "@/lib/supabase/server";
import type { Locale } from "@/types/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale() as Locale;
  const t = await getTranslations("profile");
  return { title: t("metadataTitle"), description: t("metadataDescription"), alternates: localizedAlternates(locale, "/perfil"), robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

type OrderItem = {
  id: string;
  item_type: "catalog" | "design";
  title: string;
  quantity: number;
  total_minor: number;
};

type CustomerOrder = {
  id: string;
  order_number: number;
  status: string;
  shipping_method: string;
  total_minor: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  order_items: OrderItem[] | null;
};

const languageTags: Record<Locale, string> = { es: "es-UY", en: "en", pt: "pt-BR" };
const date = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(languageTags[locale], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

const compactDate = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(languageTags[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

const birthdayDate = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(languageTags[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

const normalizedProductName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-UY");

function orderThumbnail(item?: OrderItem) {
  if (item?.item_type === "design") {
    return "/assets/matearte/01-marca/LogoOriginal.jpg";
  }

  const itemName = normalizedProductName(item?.title || "");
  const product = products.find((candidate) => itemName.includes(normalizedProductName(candidate.name)));
  return product?.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.png";
}

async function AccountAccessRequired({ authError }: { authError?: string }) {
  const t = await getTranslations("profile");
  const [guestTitleOne, guestTitleTwo] = t("guestTitle").split("|");
  return (
    <main id="contenido" className="profile-guest-page">
      <div className="profile-guest-desktop">
        <section className="profile-guest-editorial" aria-labelledby="profile-guest-title">
          <div className="profile-guest-visual">
            <Image
              className="profile-guest-visual-image"
              src="/assets/matearte/profile-guest-desktop/overlay.png"
              alt={t("guestAlt")}
              fill
              priority
              sizes="700px"
              quality={95}
            />
            <div className="profile-guest-visual-scrim" aria-hidden="true" />
            <div className="profile-guest-visual-copy">
              <h1 id="profile-guest-title">{guestTitleOne}<br />{guestTitleTwo}</h1>
              <p>{t("guestBody")}</p>
            </div>
          </div>

          <div className="profile-guest-access-column">
            <section className="profile-guest-login-card" aria-labelledby="profile-guest-login-title">
              <h2 id="profile-guest-login-title">{t("loginTitle")}</h2>
              <p className="profile-guest-login-intro">{t("loginIntro")}</p>
              <GoogleAuthButton variant="editorial" />
              <p className="profile-guest-login-note">{t("loginNote")}</p>
              {authError && <p role="alert" className="profile-guest-auth-error">{t("loginError")}</p>}
            </section>

            <section className="profile-guest-benefits" aria-labelledby="profile-guest-benefits-title">
              <h2 id="profile-guest-benefits-title">{t("benefitsTitle")}</h2>
              <ul>
                <li><Image src="/assets/matearte/profile-guest-desktop/point.svg" alt="" width={6} height={6} aria-hidden="true" /><span>{t("benefitOrders")}</span></li>
                <li><Image src="/assets/matearte/profile-guest-desktop/point.svg" alt="" width={6} height={6} aria-hidden="true" /><span>{t("benefitDesigns")}</span></li>
                <li><Image src="/assets/matearte/profile-guest-desktop/point.svg" alt="" width={6} height={6} aria-hidden="true" /><span>{t("benefitData")}</span></li>
              </ul>
            </section>
          </div>
        </section>
      </div>

      <div className="profile-guest-mobile">
        <section className="profile-guest-mobile-content" aria-labelledby="profile-guest-mobile-title">
          <div className="profile-guest-mobile-visual">
            <Image
              className="profile-guest-mobile-visual-image"
              src="/assets/matearte/profile-guest-desktop/overlay.png"
              alt={t("guestAlt")}
              width={444}
              height={250}
              priority
              sizes="(max-width: 1023px) 444px, 1px"
              quality={95}
            />
            <div className="profile-guest-mobile-visual-scrim" aria-hidden="true" />
            <div className="profile-guest-mobile-visual-copy">
              <h1 id="profile-guest-mobile-title">{guestTitleOne}<br />{guestTitleTwo}</h1>
              <p>{t("guestBodyMobile")}</p>
            </div>
          </div>

          <section className="profile-guest-mobile-login-card" aria-labelledby="profile-guest-mobile-login-title">
            <h2 id="profile-guest-mobile-login-title">{t("loginTitle")}</h2>
            <p className="profile-guest-mobile-login-intro">{t("loginIntro")}</p>
            <GoogleAuthButton variant="editorial" />
            <p className="profile-guest-mobile-login-note">{t("loginNote")}</p>
            {authError && <p role="alert" className="profile-guest-mobile-auth-error">{t("loginError")}</p>}
          </section>

          <section className="profile-guest-mobile-benefits" aria-labelledby="profile-guest-mobile-benefits-title">
            <h2 id="profile-guest-mobile-benefits-title">{t("benefitsTitle")}</h2>
            <ul>
              <li><Image src="/assets/matearte/profile-guest-desktop/point.svg" alt="" width={5} height={5} aria-hidden="true" /><span>{t("benefitOrders")}</span></li>
              <li><Image src="/assets/matearte/profile-guest-desktop/point.svg" alt="" width={5} height={5} aria-hidden="true" /><span>{t("benefitDesigns")}</span></li>
              <li><Image src="/assets/matearte/profile-guest-desktop/point.svg" alt="" width={5} height={5} aria-hidden="true" /><span>{t("benefitData")}</span></li>
            </ul>
          </section>
        </section>
      </div>
    </main>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const params = await searchParams;
  const locale = await getLocale() as Locale;
  const t = await getTranslations("profile");
  const orderT = await getTranslations("order");
  const orderStatusLabels: Record<string, string> = {
    pending_payment: orderT("statuses.pending_payment"), paid_pending_review: orderT("statuses.paid_pending_review"),
    ready_for_fulfillment: orderT("statuses.ready_for_fulfillment"), ready_for_production: orderT("statuses.ready_for_production"),
    payment_failed: orderT("statuses.payment_failed"), cancelled: orderT("statuses.cancelled"),
    refunded: orderT("statuses.refunded"), manual_review: orderT("statuses.manual_review"),
  };
  const { user, client } = await requireUser();
  if (!user) return <AccountAccessRequired authError={params.auth} />;

  const [{ data: profile }, { data, error }] = await Promise.all([
    client
      .from("customer_profiles")
      .select("full_name,birth_date,country_code,department,city,avatar_path,profile_completed_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("orders")
      .select("id,order_number,status,shipping_method,total_minor,currency,created_at,paid_at,order_items(id,item_type,title,quantity,total_minor)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!profile?.profile_completed_at) redirect(localizeCanonicalPath("/perfil/editar", locale));

  const orders = (data || []) as CustomerOrder[];
  const name = profile?.full_name || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "");
  const firstName = name.trim().split(/\s+/)[0] || t("fallbackName");
  const localizedCountry = countryName(profile?.country_code, locale);
  const location = [profile?.city, profile?.department, localizedCountry].filter(Boolean).join(", ");
  const activeCount = orders.filter((order) => isActiveOrder(order.status)).length;
  const confirmedCount = orders.filter((order) => isConfirmedOrder(order.status)).length;
  const avatarResult = profile?.avatar_path
    ? await client.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 60 * 60)
    : null;
  const avatarUrl = avatarResult?.data?.signedUrl || null;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("") || "MA";
  const hasNoOrders = !error && orders.length === 0;
  const hasOrders = !error && orders.length > 0;
  const itemTitle = (item: OrderItem) => item.item_type === "design" ? item.title : localizeCatalogSnapshotTitle(item.title, locale);

  return (
    <main id="contenido" className={`profile-account-page${hasNoOrders ? " profile-account-page-empty" : ""}${hasOrders ? " profile-account-page-orders" : ""}`}>
      {hasNoOrders && (
        <>
          <div className="profile-empty-desktop">
          <div className="profile-empty-shell">
            <section className="profile-empty-account-header" aria-labelledby="profile-empty-account-title">
              <div className="profile-empty-account-identity">
                <div className="profile-empty-account-avatar">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={t("avatarAlt", { name: name || firstName })} fill sizes="88px" className="object-cover" priority />
                  ) : (
                    <Image src="/assets/matearte/profile-empty-desktop/avatar.png" alt="" width={88} height={88} aria-hidden="true" />
                  )}
                </div>

                <div className="profile-empty-account-data">
                  <div className="profile-empty-account-title-row">
                    <h1 id="profile-empty-account-title">{t("greeting", { name: firstName })}</h1>
                    {profile?.country_code && (
                      <span
                        className={`profile-empty-country-flag flag:${profile.country_code}`}
                        role="img"
                        aria-label={t("flagLabel", { country: localizedCountry })}
                        title={localizedCountry}
                      />
                    )}
                  </div>

                  <div className="profile-empty-account-details">
                    <p><Image src="/assets/matearte/profile-empty-desktop/email.svg" alt="" width={18} height={18} aria-hidden="true" /><span>{user.email}</span></p>
                    {location && <p><Image src="/assets/matearte/profile-empty-desktop/location.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{location}</span></p>}
                    {profile?.birth_date && <p><Image src="/assets/matearte/profile-empty-desktop/birthday.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{birthdayDate(profile.birth_date, locale)}</span></p>}
                  </div>

                  <div className="profile-empty-account-actions">
                    <Link className="profile-empty-account-button" href="/perfil/editar">{t("editData")}</Link>
                    <div className="profile-empty-visualizer"><VisualizerProfileButton /></div>
                  </div>
                </div>
              </div>

              <dl className="profile-empty-account-metrics" aria-label={t("accountSummary")}>
                <div><dt>{t("orders")}</dt><dd>{orders.length}</dd></div>
                <div><dt>{t("inProgress")}</dt><dd>{activeCount}</dd></div>
                <div><dt>{t("delivered")}</dt><dd>{confirmedCount}</dd></div>
              </dl>
            </section>

            <section className="profile-empty-orders" aria-labelledby="profile-empty-orders-title">
              <h2 id="profile-empty-orders-title">{t("myOrders")}</h2>
              <div className="profile-empty-orders-card">
                <div className="profile-empty-orders-copy">
                  <h3>{t("emptyTitle").split("|")[0]}<br />{t("emptyTitle").split("|")[1]}</h3>
                  <p>{t("emptyBody")}</p>
                  <Link href="/catalogo">{t("catalog")}</Link>
                </div>
                <div className="profile-empty-orders-image">
                  <Image
                    src="/assets/matearte/home-v2/history.png"
                    alt={t("historyAlt")}
                    fill
                    sizes="420px"
                  />
                </div>
              </div>
            </section>
          </div>
          </div>

          <div className="profile-empty-mobile">
            <section className="profile-empty-mobile-account" aria-labelledby="profile-empty-mobile-account-title">
              <div className="profile-empty-mobile-avatar">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={t("avatarAlt", { name: name || firstName })} fill sizes="72px" className="object-cover" priority />
                ) : (
                  <Image src="/assets/matearte/profile-empty-desktop/avatar.png" alt="" width={72} height={72} aria-hidden="true" />
                )}
              </div>

              <div className="profile-empty-mobile-account-copy">
                <h1 id="profile-empty-mobile-account-title">{t("greeting", { name: firstName })}</h1>
                <div className="profile-empty-mobile-details">
                  <p><Image src="/assets/matearte/profile-empty-desktop/email.svg" alt="" width={18} height={18} aria-hidden="true" /><span>{user.email}</span></p>
                  {location && <p><Image src="/assets/matearte/profile-empty-desktop/location.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{location}</span></p>}
                  {profile?.birth_date && <p><Image src="/assets/matearte/profile-empty-desktop/birthday.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{birthdayDate(profile.birth_date, locale)}</span></p>}
                </div>
              </div>

              <div className="profile-empty-mobile-actions">
                <Link href="/perfil/editar">{t("editDataShort")}</Link>
                <div className="profile-empty-mobile-visualizer"><VisualizerProfileButton label={t("myDesigns")} /></div>
              </div>

              <dl className="profile-empty-mobile-metrics" aria-label={t("accountSummary")}>
                <div><dt>{t("orders")}</dt><dd>{orders.length}</dd></div>
                <div><dt>{t("inProgress")}</dt><dd>{activeCount}</dd></div>
                <div><dt>{t("delivered")}</dt><dd>{confirmedCount}</dd></div>
              </dl>
            </section>

            <section className="profile-empty-mobile-orders" aria-labelledby="profile-empty-mobile-orders-title">
              <h2 id="profile-empty-mobile-orders-title">{t("myOrders")}</h2>
              <div className="profile-empty-mobile-card">
                <div className="profile-empty-mobile-history-image">
                  <Image
                    src="/assets/matearte/home-v2/history.png"
                    alt={t("historyAlt")}
                    fill
                    sizes="(max-width: 1023px) calc(100vw - 96px), 1px"
                  />
                </div>
                <h3>{t("emptyTitle").split("|")[0]}<br />{t("emptyTitle").split("|")[1]}</h3>
                <p>{t("emptyBody")}</p>
                <Link href="/catalogo">{t("catalog")}</Link>
              </div>
            </section>
          </div>
        </>
      )}

      {hasOrders && (
        <>
        <div className="profile-orders-desktop">
          <div className="profile-orders-shell">
            <section className="profile-empty-account-header" aria-labelledby="profile-orders-account-title">
              <div className="profile-empty-account-identity">
                <div className="profile-empty-account-avatar">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={t("avatarAlt", { name: name || firstName })} fill sizes="88px" className="object-cover" priority />
                  ) : (
                    <Image src="/assets/matearte/profile-empty-desktop/avatar.png" alt="" width={88} height={88} aria-hidden="true" />
                  )}
                </div>

                <div className="profile-empty-account-data">
                  <div className="profile-empty-account-title-row">
                    <h1 id="profile-orders-account-title">{t("greeting", { name: firstName })}</h1>
                    {profile?.country_code && (
                      <span
                        className={`profile-empty-country-flag flag:${profile.country_code}`}
                        role="img"
                        aria-label={t("flagLabel", { country: localizedCountry })}
                        title={localizedCountry}
                      />
                    )}
                  </div>

                  <div className="profile-empty-account-details">
                    <p><Image src="/assets/matearte/profile-empty-desktop/email.svg" alt="" width={18} height={18} aria-hidden="true" /><span>{user.email}</span></p>
                    {location && <p><Image src="/assets/matearte/profile-empty-desktop/location.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{location}</span></p>}
                    {profile?.birth_date && <p><Image src="/assets/matearte/profile-empty-desktop/birthday.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{birthdayDate(profile.birth_date, locale)}</span></p>}
                  </div>

                  <div className="profile-empty-account-actions">
                    <Link className="profile-empty-account-button" href="/perfil/editar">{t("editData")}</Link>
                    <div className="profile-empty-visualizer"><VisualizerProfileButton /></div>
                  </div>
                </div>
              </div>

              <dl className="profile-empty-account-metrics" aria-label={t("accountSummary")}>
                <div><dt>{t("orders")}</dt><dd>{orders.length}</dd></div>
                <div><dt>{t("inProgress")}</dt><dd>{activeCount}</dd></div>
                <div><dt>{t("delivered")}</dt><dd>{confirmedCount}</dd></div>
              </dl>
            </section>

            <section className="profile-orders-history" aria-labelledby="profile-orders-title">
              <div className="profile-orders-heading">
                <h2 id="profile-orders-title">{t("myOrders")}</h2>
                <Link href="/catalogo">{t("continueShopping")}</Link>
              </div>

              <div className="profile-orders-list">
                {orders.map((order) => {
                  const items = order.order_items || [];
                  const firstItem = items[0];
                  const additionalItems = Math.max(0, items.length - 1);
                  const orderTitle = firstItem
                    ? `${firstItem.quantity > 1 ? `${firstItem.quantity} × ` : ""}${itemTitle(firstItem)}${additionalItems ? ` ${t("moreItems", { count: additionalItems })}` : ""}`
                    : t("orderNumber", { number: order.order_number });
                  const statusLabel = orderStatusLabels[order.status]
                    || order.status.replaceAll("_", " ");

                  return (
                    <article className="profile-order-card" key={order.id}>
                      <div className="profile-order-thumbnail">
                        <Image
                          src={orderThumbnail(firstItem)}
                          alt={firstItem?.item_type === "design" ? "MateArte" : firstItem ? itemTitle(firstItem) : t("orderNumber", { number: order.order_number })}
                          fill
                          sizes="138px"
                        />
                      </div>

                      <div className="profile-order-info">
                        <h3 title={orderTitle}>{orderTitle}</h3>
                        <time dateTime={order.created_at}>{date(order.created_at, locale)}</time>
                        <span className="profile-order-status" title={orderStatusLabels[order.status] || statusLabel}>{statusLabel}</span>
                      </div>

                      <p className="profile-order-total">
                        <span className="sr-only">{order.shipping_method === "international_coordination" ? `${t("subtotalNoShipping")}: ` : `${t("total")}: `}</span>
                        {formatMoney(order.total_minor)}
                      </p>

                      <Link
                        className="profile-order-detail"
                        href={{ pathname: "/pedidos/[id]", params: { id: order.id } }}
                        aria-label={t("viewDetailAria", { number: order.order_number })}
                      >
                        {t("viewDetail")}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="profile-orders-mobile">
          <section className="profile-empty-mobile-account" aria-labelledby="profile-orders-mobile-account-title">
            <div className="profile-empty-mobile-avatar">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={t("avatarAlt", { name: name || firstName })} fill sizes="72px" className="object-cover" priority />
              ) : (
                <Image src="/assets/matearte/profile-empty-desktop/avatar.png" alt="" width={72} height={72} aria-hidden="true" />
              )}
            </div>

            <div className="profile-empty-mobile-account-copy">
              <h1 id="profile-orders-mobile-account-title">{t("greeting", { name: firstName })}</h1>
              <div className="profile-empty-mobile-details">
                <p><Image src="/assets/matearte/profile-empty-desktop/email.svg" alt="" width={18} height={18} aria-hidden="true" /><span>{user.email}</span></p>
                {location && <p><Image src="/assets/matearte/profile-empty-desktop/location.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{location}</span></p>}
                {profile?.birth_date && <p><Image src="/assets/matearte/profile-empty-desktop/birthday.svg" alt="" width={19} height={19} aria-hidden="true" /><span>{birthdayDate(profile.birth_date, locale)}</span></p>}
              </div>
            </div>

            <div className="profile-empty-mobile-actions">
              <Link href="/perfil/editar">{t("editDataShort")}</Link>
              <div className="profile-empty-mobile-visualizer"><VisualizerProfileButton label={t("myDesigns")} /></div>
            </div>

            <dl className="profile-empty-mobile-metrics" aria-label={t("accountSummary")}>
              <div><dt>{t("orders")}</dt><dd>{orders.length}</dd></div>
              <div><dt>{t("inProgress")}</dt><dd>{activeCount}</dd></div>
              <div><dt>{t("delivered")}</dt><dd>{confirmedCount}</dd></div>
            </dl>
          </section>

          <section className="profile-orders-mobile-history" aria-labelledby="profile-orders-mobile-title">
            <div className="profile-orders-mobile-heading">
              <h2 id="profile-orders-mobile-title">{t("myOrders")}</h2>
              <Link href="/catalogo">{t("continueShopping")}</Link>
            </div>

            <div className="profile-orders-mobile-list">
              {orders.map((order) => {
                const items = order.order_items || [];
                const firstItem = items[0];
                const additionalItems = Math.max(0, items.length - 1);
                const orderTitle = firstItem
                  ? `${firstItem.quantity > 1 ? `${firstItem.quantity} × ` : ""}${itemTitle(firstItem)}${additionalItems ? ` ${t("moreItems", { count: additionalItems })}` : ""}`
                  : t("orderNumber", { number: order.order_number });
                const statusLabel = orderStatusLabels[order.status]
                  || order.status.replaceAll("_", " ");
                const totalLabel = order.shipping_method === "international_coordination" ? t("subtotalNoShipping") : t("total");

                return (
                  <article className="profile-orders-mobile-card" key={order.id}>
                    <div className="profile-orders-mobile-card-main">
                      <div className="profile-orders-mobile-thumbnail">
                        <Image
                          src={orderThumbnail(firstItem)}
                          alt={firstItem?.item_type === "design" ? "MateArte" : firstItem ? itemTitle(firstItem) : t("orderNumber", { number: order.order_number })}
                          fill
                          sizes="96px"
                        />
                      </div>

                      <div className="profile-orders-mobile-info">
                        <time dateTime={order.created_at}>{compactDate(order.created_at, locale)}</time>
                        <h3 title={orderTitle}>{orderTitle}</h3>
                        <span className="profile-orders-mobile-status" title={orderStatusLabels[order.status] || statusLabel}>{statusLabel}</span>
                      </div>
                    </div>

                    <div className="profile-orders-mobile-divider" aria-hidden="true" />

                    <div className="profile-orders-mobile-card-footer">
                      <p className="profile-orders-mobile-total">
                        <span>{totalLabel}</span>
                        <strong>{formatMoney(order.total_minor)}</strong>
                      </p>
                      <Link
                        href={{ pathname: "/pedidos/[id]", params: { id: order.id } }}
                        aria-label={t("viewDetailAria", { number: order.order_number })}
                      >
                        {t("viewDetail")}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
        </>
      )}

      <div className="profile-account-standard pb-24 pt-8 sm:pb-32 sm:pt-12">
        <div className="container-shell">
        <section className="overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]" aria-labelledby="account-title">
          <div className="h-1.5 bg-[var(--leather)]" aria-hidden="true" />
          <div className="grid lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-[var(--cream-deep)] bg-[var(--leather)] shadow-md sm:size-28">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={t("avatarAlt", { name: name || firstName })} fill sizes="112px" className="object-cover" priority />
                  ) : (
                    <span className="display-font grid size-full place-items-center text-3xl font-semibold text-[var(--cream-deep)]" aria-label={t("initialsLabel", { name: name || firstName })}>{initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-[var(--leather)]">{t("accountEyebrow")}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <h1 id="account-title" className="display-font text-4xl font-medium tracking-[-0.025em] sm:text-5xl">{t("greeting", { name: firstName })}</h1>
                    {profile?.country_code && (
                      <span
                        className={`flag:${profile.country_code} inline-block rounded-[2px] shadow-sm [--CountryFlagIcon-height:1.65rem] sm:[--CountryFlagIcon-height:1.9rem]`}
                        role="img"
                        aria-label={t("flagLabel", { country: localizedCountry })}
                        title={localizedCountry}
                      />
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-black/65">
                    <p className="flex items-center gap-2"><EnvelopeSimple size={18} className="shrink-0 text-[var(--leather)]" aria-hidden="true" /><span className="truncate">{user.email}</span></p>
                    {location && <p className="flex items-center gap-2"><MapPin size={18} className="shrink-0 text-[var(--leather)]" aria-hidden="true" /><span>{location}</span></p>}
                    {profile?.birth_date && <p className="flex items-center gap-2"><Cake size={18} className="shrink-0 text-[var(--leather)]" aria-hidden="true" /><span>{birthdayDate(profile.birth_date, locale)}</span></p>}
                  </div>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-3 sm:ml-[8.5rem]">
                <Link className="button-secondary gap-2" href="/perfil/editar">
                  <PencilSimple size={18} aria-hidden="true" />
                  {t("editData")}
                </Link>
                <VisualizerProfileButton />
              </div>
            </div>
            <div className="bg-[var(--walnut)] p-6 text-[var(--paper)] sm:p-8 lg:p-9">
              <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--rawhide)] uppercase">{t("accountSummary")}</p>
              <dl className="mt-6 divide-y divide-white/15">
                <div className="flex items-center justify-between gap-5 py-4 first:pt-0">
                  <dt className="flex items-center gap-3 text-sm text-white/75"><ShoppingBagOpen size={21} aria-hidden="true" />{t("ordersPlaced")}</dt>
                  <dd className="display-font text-3xl tabular-nums">{orders.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-5 py-4">
                  <dt className="flex items-center gap-3 text-sm text-white/75"><Clock size={21} aria-hidden="true" />{t("inProgress")}</dt>
                  <dd className="display-font text-3xl tabular-nums">{activeCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-5 py-4 last:pb-0">
                  <dt className="flex items-center gap-3 text-sm text-white/75"><CheckCircle size={21} aria-hidden="true" />{t("paid")}</dt>
                  <dd className="display-font text-3xl tabular-nums">{confirmedCount}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="pt-12 sm:pt-16" aria-labelledby="orders-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-[var(--leather)]">{t("history")}</p>
              <h2 id="orders-title" className="display-font mt-5 text-4xl sm:text-5xl">{t("myOrders")}</h2>
            </div>
            <Link className="button-secondary" href="/catalogo">{t("continueShopping")}</Link>
          </div>

          {error ? (
            <div role="alert" className="mt-8 border border-[var(--danger)]/30 bg-[var(--paper)] p-6 text-[var(--danger)]">
              {t("ordersLoadFailed")}
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-8 border border-black/15 bg-[var(--paper)] p-7 sm:p-10">
              <Receipt size={30} className="text-[var(--leather)]" aria-hidden="true" />
              <h3 className="display-font mt-5 text-3xl">{t("noPurchaseTitle")}</h3>
              <p className="mt-3 max-w-lg text-sm leading-7 text-black/60">
                {t("noPurchaseBody")}
              </p>
              <Link className="button-primary mt-7" href="/catalogo">{t("catalog")}</Link>
            </div>
          ) : (
            <div className="mt-7 space-y-5">
              {orders.map((order) => {
                const items = order.order_items || [];
                return (
                  <article key={order.id} className="group overflow-hidden border border-black/15 bg-[var(--paper)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--leather)]/45 hover:shadow-[var(--shadow-soft)]">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-[var(--cream-deep)]/45 px-5 py-4 sm:px-7">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <p className="text-xs font-bold tracking-[0.12em] text-[var(--walnut)] uppercase">{t("orderNumber", { number: order.order_number })}</p>
                        <p className="text-xs text-black/55">{date(order.created_at, locale)}</p>
                      </div>
                      <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${orderStatusTone(order.status)}`}>
                        {orderStatusLabels[order.status] || order.status}
                      </span>
                    </header>
                    <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-black/45 uppercase">{t("content")}</p>
                        {items.length ? (
                          <ul className="mt-3 space-y-2" aria-label={t("itemsAria", { number: order.order_number })}>
                            {items.map((item) => (
                              <li key={item.id} className="flex items-start gap-3 text-sm text-black/70">
                                <Package size={19} className="mt-0.5 shrink-0 text-[var(--leather)]" aria-hidden="true" />
                                <span>{item.quantity > 1 ? `${item.quantity} × ` : ""}{itemTitle(item)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-black/60">{t("detailsAvailable")}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-5 border-t border-black/10 pt-5 lg:block lg:border-l lg:border-t-0 lg:py-1 lg:pl-7 lg:text-right">
                        <div>
                          <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-black/45 uppercase">{order.shipping_method === "international_coordination" ? t("subtotalNoShipping") : t("total")}</p>
                          <p className="display-font mt-1 text-3xl font-semibold tabular-nums">{formatMoney(order.total_minor)}</p>
                        </div>
                        <Link href={{ pathname: "/pedidos/[id]", params: { id: order.id } }} className="button-primary mt-0 gap-2 lg:mt-4 lg:w-full" aria-label={t("viewDetailAria", { number: order.order_number })}>
                          {t("viewDetail")} <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </div>
      </div>
    </main>
  );
}
