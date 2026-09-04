import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("portada, navegación y accesibilidad", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TRADICIÓN");
  await expect(page.getByRole("heading", { level: 2, name: "El Mate de los Campeones" })).toBeAttached();
  await expect(page.locator(".home-header-navigation .is-active")).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeVisible();
  } else {
    const languageButton = page.getByRole("button", { name: "Cambiar idioma. Idioma actual: Español" });
    await expect(languageButton).toBeEnabled();
    await languageButton.click();
    await expect(page.getByRole("menu", { name: "Idioma" }).getByRole("menuitem")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(languageButton).toBeFocused();
    await expect(page.getByRole("link", { name: /^Carrito/ })).toHaveAttribute("href", "/carrito");
  }
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.getByRole("link", { name: "Ver mates" }).click();
  await expect(page).toHaveURL(/\/catalogo/);
  await expect(page).toHaveTitle(/Catálogo/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Elegí tu producto");
});

test("el título inglés del hero permanece dentro del viewport", async ({ page }) => {
  await page.goto("/en");

  const heading = page.getByRole("heading", { level: 1, name: "TRADITION THAT BRINGS US TOGETHER" });
  await expect(heading).toBeVisible();
  const bounds = await heading.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      overflowingLine: Array.from(element.querySelectorAll("span")).some(
        (line) => line.scrollWidth > line.clientWidth,
      ),
    };
  });

  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.pageWidth).toBe(bounds.viewportWidth);
  expect(bounds.overflowingLine).toBe(false);
});

test("las imágenes editoriales conservan su nitidez", async ({ page }) => {
  const compact = (page.viewportSize()?.width ?? 1440) < 1024;
  await page.goto("/nosotros");

  const brandLogo = page.locator(compact ? ".nosotros-mobile-chapter-image-brand img" : ".nosotros-desktop-media-brand img");
  await expect(brandLogo).toHaveAttribute("src", "/assets/matearte/01-marca/Logo1254.png");

  const workshop = page.locator(compact ? ".nosotros-mobile-world > img" : ".nosotros-desktop-world > img");
  await expect(workshop).toHaveCSS("filter", "none");
  await expect(workshop).toHaveAttribute("src", /q=95/);

  await page.goto("/perfil");
  const profileVisual = page.locator(compact ? ".profile-guest-mobile-visual" : ".profile-guest-visual");
  await expect(profileVisual.locator("img")).toHaveCount(1);
  await expect(profileVisual.locator("img")).toHaveAttribute("src", /q=95/);
  await expect(profileVisual.locator("img")).toHaveCSS("filter", "none");
});

test("cambia entre los tres idiomas conservando ruta, filtros y fragmento", async ({ page }) => {
  const mobile = (page.viewportSize()?.width ?? 1440) < 1024;
  await page.goto("/catalogo?categoria=mates&material=cuero&material=madera#productos");

  const choose = async (language: string) => {
    await expect(page.locator("header.home-header")).toHaveAttribute("data-hydrated", "true");
    if (mobile) await page.locator(".home-header-menu").click();
    else await page.locator(".home-header-language").click();
    await page.getByRole(mobile ? "link" : "menuitem", { name: language, exact: true }).click();
  };

  await choose("English");
  await expect(page).toHaveURL(/\/en\/catalog\?categoria=mates&material=cuero&material=madera#productos$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Choose your product" })).toBeVisible();
  const catalog = page.locator(mobile ? ".catalog-mobile-view" : ".catalog-desktop-view");
  await expect(catalog.getByText("$ 4.500 UYU", { exact: true }).first()).toBeVisible();

  const englishProduct = catalog.getByRole("link", { name: /Mate Imperial/ }).first();
  await expect(englishProduct).toHaveAttribute("href", /\/en\/product\/mate-imperial/);

  await choose("Português (Brasil)");
  await expect(page).toHaveURL(/\/pt\/catalogo\?categoria=mates&material=cuero&material=madera#productos$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("heading", { level: 1, name: "Escolha seu produto" })).toBeVisible();
});

test("publica canonical y hreflang para cada idioma", async ({ page }) => {
  await page.goto("/en/product/mate-imperial");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/product\/mate-imperial$/);
  await expect(page.locator('link[rel="alternate"][hreflang="es-UY"]')).toHaveAttribute("href", /\/producto\/mate-imperial$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/product\/mate-imperial$/);
  await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute("href", /\/pt\/produto\/mate-imperial$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/producto\/mate-imperial$/);
});

test("detecta el idioma solo en la primera visita a la portada y respeta URLs explícitas", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto("/contacto");
  await expect(page).toHaveURL(/\/contacto$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-UY");
  await context.close();
});

test("el header y el footer nuevos son globales", async ({ page }) => {
  const compactNavigation = (page.viewportSize()?.width ?? 1440) < 1024;
  await page.goto("/catalogo");
  await expect(page.locator("header.home-header")).toBeVisible();
  await expect(page.locator("footer.home-footer")).toBeAttached();
  if (compactNavigation) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(page.getByRole("navigation", { name: "Navegación móvil" }).getByRole("link", { name: "Catálogo", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Cerrar menú" }).click();
  } else {
    await expect(page.locator("header.home-header").getByRole("link", { name: "Catálogo", exact: true })).toHaveAttribute("aria-current", "page");
    const navigationOffset = await page.locator(".home-header-navigation").evaluate((navigation) => {
      const bounds = navigation.getBoundingClientRect();
      return Math.abs(bounds.left + bounds.width / 2 - document.documentElement.clientWidth / 2);
    });
    expect(navigationOffset).toBeLessThanOrEqual(1);
  }
  await expect(page.locator("footer.home-footer").getByRole("link", { name: "Escribinos →" })).toHaveAttribute("href", "/contacto");
  await expect(page.locator("footer.home-footer").getByRole("link", { name: /Consultar por WhatsApp/ })).toHaveAttribute("href", /wa\.me\/59891674231\?text=Hola%2C%20quer%C3%ADa%20hacer%20una%20consulta\./);
  await expect(page.locator("footer.home-footer").getByRole("link", { name: "Creada por Polarist" })).toHaveAttribute("href", "https://polarist.app/");
  await expect(page.locator(".home-polarist img")).toHaveCSS("width", "40px");
  await expect(page.locator("footer.home-footer").getByRole("link", { name: /Facebook/i })).toHaveCount(0);
  if (compactNavigation) {
    const footer = page.locator("footer.home-footer");
    const purchasesButton = footer.getByRole("button", { name: "Ver más" });
    await expect(footer.locator(".home-polarist img")).toHaveCSS("margin-right", "-10px");
    await expect(footer.locator(".home-footer-socials-desktop")).toBeHidden();
    await expect(footer.locator(".home-footer-socials-mobile")).toBeVisible();
    await expect(purchasesButton).toHaveCSS("border-top-width", "0px");
    const mobileFooterAlignment = await footer.evaluate((element) => {
      const navigation = element.querySelector<HTMLElement>(".home-footer-nav")!.getBoundingClientRect();
      const disclosure = element.querySelector<HTMLElement>(".home-footer-purchases-mobile > button")!.getBoundingClientRect();
      const contact = element.querySelector<HTMLElement>(".home-footer-contact")!.getBoundingClientRect();
      const instagram = element.querySelector<HTMLElement>(".home-footer-socials-mobile")!.getBoundingClientRect();
      return {
        disclosureLeft: Math.round(disclosure.left - navigation.left),
        instagramRight: Math.round(contact.right - instagram.right),
      };
    });
    expect(mobileFooterAlignment).toEqual({ disclosureLeft: 0, instagramRight: 0 });
    const footerBottomAlignment = await footer.locator(".home-footer-bottom > div").evaluate((element) => {
      const copyright = element.querySelector("p")!.getBoundingClientRect();
      const polarist = element.querySelector(".home-polarist")!.getBoundingClientRect();
      return Math.abs(copyright.top + copyright.height / 2 - (polarist.top + polarist.height / 2));
    });
    expect(footerBottomAlignment).toBeLessThanOrEqual(1);
    await expect(purchasesButton).toHaveAttribute("aria-expanded", "false");
    await purchasesButton.click();
    await expect(page.getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Información de compras" }).last().getByRole("link", { name: "Política de privacidad" })).toBeVisible();
  } else {
    await expect(page.locator(".home-footer-socials-desktop")).toBeVisible();
    await expect(page.locator(".home-footer-socials-mobile")).toBeHidden();
    const purchaseNavigation = page.locator(".home-footer-purchases");
    await expect(purchaseNavigation).toBeVisible();
    await expect(purchaseNavigation.getByRole("link")).toHaveCount(4);
  }
  const catalogAccessibility = await new AxeBuilder({ page }).analyze();
  expect(catalogAccessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.goto("/contacto");
  await expect(page.locator("header.home-header")).toBeVisible();
  await expect(page.locator("footer.home-footer")).toBeAttached();
  if (compactNavigation) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(page.getByRole("navigation", { name: "Navegación móvil" }).getByRole("link", { name: "Contacto", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Cerrar menú" }).click();
  } else {
    await expect(page.locator("header.home-header").getByRole("link", { name: "Contacto", exact: true })).toHaveAttribute("aria-current", "page");
  }
  const contactView = page.locator(compactNavigation ? ".contact-mobile" : ".contact-desktop");
  await expect(contactView.getByRole("link", { name: "+598 91 674 231" })).toHaveAttribute("href", /wa\.me\/59891674231\?text=Hola%2C%20quer%C3%ADa%20hacer%20una%20consulta\./);
  const contactAccessibility = await new AxeBuilder({ page }).analyze();
  expect(contactAccessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("el footer móvil alinea Ver más con la navegación e Instagram con el contacto", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 1024, "La composición solicitada corresponde al footer móvil");
  await page.goto("/catalogo");

  const footer = page.locator("footer.home-footer");
  const purchasesButton = footer.getByRole("button", { name: "Ver más" });
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await expect(footer.locator(".home-footer-socials-desktop")).toBeHidden();
  await expect(footer.locator(".home-footer-socials-mobile")).toBeVisible();
  await expect(purchasesButton).toHaveCSS("border-top-width", "0px");

  const alignment = await footer.evaluate((element) => {
    const navigation = element.querySelector<HTMLElement>(".home-footer-nav")!.getBoundingClientRect();
    const disclosure = element.querySelector<HTMLElement>(".home-footer-purchases-mobile > button")!.getBoundingClientRect();
    const contact = element.querySelector<HTMLElement>(".home-footer-contact")!.getBoundingClientRect();
    const instagram = element.querySelector<HTMLElement>(".home-footer-socials-mobile")!.getBoundingClientRect();
    return {
      disclosureLeft: Math.round(disclosure.left - navigation.left),
      instagramRight: Math.round(contact.right - instagram.right),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(alignment).toEqual({ disclosureLeft: 0, instagramRight: 0, overflow: 0 });

  await purchasesButton.click();
  await expect(footer.getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");
  await expect(footer.getByRole("navigation", { name: "Información de compras" }).getByRole("link", { name: "Política de privacidad" })).toBeVisible();
});

test("el acceso del carrito dirige al perfil", async ({ page }) => {
  await page.goto("/carrito");
  const loginLink = page.locator((page.viewportSize()?.width ?? 1440) < 1024 ? ".cart-empty-mobile-login" : ".cart-empty-login-button");
  await expect(loginLink).toBeVisible();
  await expect(loginLink).toHaveAttribute("href", "/perfil");
  await loginLink.click();
  await expect(page).toHaveURL(/\/perfil$/);
});

test("las categorías de inicio abren el catálogo filtrado", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".home-category-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.nth(0)).toHaveAttribute("href", "/catalogo?categoria=mates");
  await expect(cards.nth(4)).toHaveAttribute("href", "/catalogo?categoria=regalos");
  await cards.nth(1).click();
  await expect(page).toHaveURL(/\/catalogo\?categoria=bombillas$/);
  const catalog = page.locator((page.viewportSize()?.width ?? 1440) >= 1024 ? ".catalog-desktop-view" : ".catalog-mobile-view");
  await expect(catalog.getByRole("radio", { name: "Bombillas", exact: true })).toBeChecked();
  await expect(catalog.locator((page.viewportSize()?.width ?? 1440) >= 1024 ? ".catalog-product-card" : ".catalog-mobile-product-card")).toHaveCount(2);
});

test("las subpáginas antiguas redirigen al catálogo unificado", async ({ page, request }) => {
  for (const category of ["mates", "bombillas", "materas", "termos", "regalos"]) {
    const response = await request.get(`/catalogo/${category}`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`/catalogo?categoria=${category}`);
  }
  const prefixedSpanish = await request.get("/es/catalogo", { maxRedirects: 0 });
  expect(prefixedSpanish.status()).toBe(308);
  expect(prefixedSpanish.headers().location).toBe("/catalogo");
  await page.goto("/catalogo/bombillas");
  await expect(page).toHaveURL(/\/catalogo\?categoria=bombillas$/);
});

test("las páginas de compras están enlazadas y presentan una cabecera limpia", async ({ page }) => {
  const pages = [
    ["/compras/terminos-y-condiciones", "Términos y condiciones"],
    ["/compras/politica-de-privacidad", "Política de privacidad"],
    ["/compras/condiciones-de-compra", "Condiciones de compra"],
    ["/compras/envios", "Envíos nacionales e internacionales"],
  ] as const;

  for (const [href, heading] of pages) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Borrador informativo", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Información de compras", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Migas de pan" })).toHaveCount(0);
    await expect(page.locator(".purchase-policy-whatsapp")).toHaveCSS("background-color", "rgb(255, 253, 248)");
    await expect(page.locator(".purchase-policy-content ul").first()).toHaveCSS("list-style-type", "disc");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator(`footer a[href="${href}"]`)).toHaveCount(2);
  }
});

test("filtros y detalle de producto son funcionales", async ({ page }) => {
  await page.goto("/catalogo");
  const isDesktop = (page.viewportSize()?.width ?? 1440) >= 1024;
  const catalog = page.locator(isDesktop ? ".catalog-desktop-view" : ".catalog-mobile-view");
  if (isDesktop) {
    await page.getByRole("radio", { name: "Mates", exact: true }).check();
    await expect(page).toHaveURL(/categoria=mates/);
  } else {
    await page.getByRole("radio", { name: "Mates", exact: true }).check();
    await expect(page).toHaveURL(/categoria=mates/);
  }
  await expect(catalog.getByText("Mate Imperial", { exact: true }).first()).toBeVisible();
  await catalog.getByRole("link", { name: /Mate Imperial/ }).first().click();
  await expect(page).toHaveURL(/\/producto\/mate-imperial/);
  if (isDesktop) {
    await expect(page.locator(".product-desktop-view").getByRole("heading", { level: 1, name: "Mate Imperial" })).toBeVisible();
    await page.locator(".product-desktop-view").getByRole("button", { name: "Agregar al carrito" }).click();
  } else {
    await expect(page.locator(".product-mobile-view").getByRole("heading", { level: 1, name: "Mate Imperial" })).toBeVisible();
    await page.locator(".product-mobile-view").getByRole("button", { name: "Agregar al carrito" }).click();
  }
  await expect(page.getByText(/Precio y compra todavía no disponibles/)).toBeVisible();
});

test("el detalle de producto móvil conserva las medidas del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 1024, "El frame 452:717 corresponde a móvil");
  await page.goto("/producto/mate-imperial-animal-print");
  const mobileProduct = page.locator("main#contenido > .product-mobile-view").first();

  await expect(mobileProduct.locator(".product-mobile-detail")).toHaveCSS("height", "1128px");
  await expect(mobileProduct.locator(".product-mobile-gallery")).toHaveCSS("width", "342px");
  await expect(mobileProduct.locator(".product-mobile-gallery")).toHaveCSS("height", "428px");
  await expect(mobileProduct.locator(".product-mobile-information")).toHaveCSS("width", "342px");
  await expect(mobileProduct.locator(".product-mobile-information")).toHaveCSS("height", "580px");
  await expect(mobileProduct.getByRole("heading", { level: 1, name: "Imperial animal print" })).toBeVisible();
  await expect(mobileProduct.getByText("$ 1.304 UYU", { exact: true })).toBeVisible();
  await expect(mobileProduct.locator(".product-mobile-gallery img")).toHaveAttribute("src", /imperial-animal-print/);
  await expect(mobileProduct.locator(".product-mobile-color-options button")).toHaveCount(4);
  await expect(page.locator(".product-desktop-view")).toBeHidden();

  const geometry = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".home-header")!.getBoundingClientRect();
    const detail = document.querySelector<HTMLElement>(".product-mobile-detail")!.getBoundingClientRect();
    const gallery = document.querySelector<HTMLElement>(".product-mobile-gallery")!.getBoundingClientRect();
    const information = document.querySelector<HTMLElement>(".product-mobile-information")!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>(".home-footer")!.getBoundingClientRect();
    return {
      headerHeight: Math.round(header.height),
      detailOffset: Math.round(detail.y),
      galleryOffset: Math.round(gallery.y - detail.y),
      informationOffset: Math.round(information.y - detail.y),
      footerOffset: Math.round(footer.y),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(geometry).toEqual({
    headerHeight: 72,
    detailOffset: 72,
    galleryOffset: 32,
    informationOffset: 484,
    footerOffset: 1200,
    overflow: 0,
  });

  await mobileProduct.getByRole("button", { name: "Color Arena" }).click();
  await expect(mobileProduct.locator(".product-mobile-color-heading").getByText("Arena", { exact: true })).toBeVisible();
  await expect(mobileProduct.getByRole("link", { name: "Conocer personalización" })).toHaveAttribute("href", "/personalizados");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedDuration = await mobileProduct.locator(".product-mobile-gallery img").evaluate((image) => parseFloat(getComputedStyle(image).transitionDuration));
  expect(reducedDuration).toBeLessThanOrEqual(0.00001);

  const results = await new AxeBuilder({ page }).include(".product-mobile-view").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("el detalle de producto web conserva las medidas del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "El frame 452:712 corresponde a escritorio");
  await page.goto("/producto/mate-imperial-animal-print");

  await expect(page.locator(".product-desktop-detail")).toHaveCSS("min-height", "1060px");
  await expect(page.locator(".product-desktop-gallery")).toHaveCSS("width", "720px");
  await expect(page.locator(".product-desktop-gallery")).toHaveCSS("height", "900px");
  await expect(page.locator(".product-desktop-information")).toHaveCSS("width", "448px");
  await expect(page.locator(".product-desktop-gallery img")).toHaveAttribute("src", /imperial-animal-print/);
  await expect(page.locator(".product-desktop-view").getByRole("heading", { level: 1, name: "Imperial animal print" })).toBeVisible();
  await expect(page.locator(".product-desktop-view").getByText("$ 1.304 UYU", { exact: true })).toBeVisible();
  await expect(page.locator(".product-desktop-color-options button")).toHaveCount(4);
  await expect(page.locator(".product-mobile-view")).toBeHidden();

  const geometry = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>(".product-desktop-detail")!.getBoundingClientRect();
    const gallery = document.querySelector<HTMLElement>(".product-desktop-gallery")!.getBoundingClientRect();
    const information = document.querySelector<HTMLElement>(".product-desktop-information")!.getBoundingClientRect();
    const heading = document.querySelector<HTMLElement>(".product-desktop-information h1")!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>(".home-footer")!.getBoundingClientRect();
    return {
      sectionHeight: Math.round(section.height),
      columnsGap: Math.round(information.x - gallery.right),
      headingOffset: Math.round(heading.y - information.y),
      footerOffset: Math.round(footer.y - section.y),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(geometry).toEqual({ sectionHeight: 1060, columnsGap: 64, headingOffset: 16, footerOffset: 1060, overflow: 0 });

  await page.getByRole("button", { name: "Color Arena" }).click();
  await expect(page.locator(".product-desktop-color-heading").getByText("Arena", { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("personalizados web conserva la composición del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "El frame 267:2 corresponde a escritorio");
  await page.goto("/personalizados");

  await expect(page.locator(".personalizados-desktop-hero")).toHaveCSS("height", "680px");
  await expect(page.locator(".personalizados-desktop-gallery")).toHaveCSS("height", "544px");
  await expect(page.locator(".personalizados-desktop-craft")).toHaveCSS("height", "380px");
  await expect(page.locator(".personalizados-desktop-gallery-card")).toHaveCount(14);
  await expect(page.locator(".personalizados-desktop-gallery-group").first().locator(".personalizados-desktop-gallery-card")).toHaveCount(7);
  await expect(page.locator(".personalizados-mobile-view")).toBeHidden();
  await expect(page.getByRole("link", { name: "Abrir personalizador" })).toBeVisible();
  await expect(page.locator(".personalizados-desktop-pagination")).toHaveCount(0);
  await expect(page.locator(".personalizados-desktop-craft")).not.toContainText("No se procesará ningún pedido");

  const carouselMotion = await page.locator(".personalizados-desktop-gallery-track").evaluate((track) => {
    const style = getComputedStyle(track);
    return {
      duration: style.animationDuration,
      iterations: style.animationIterationCount,
      name: style.animationName,
      playState: style.animationPlayState,
    };
  });
  expect(carouselMotion).toEqual({
    duration: "36s",
    iterations: "infinite",
    name: "personalizados-carousel-loop",
    playState: "running",
  });

  await page.emulateMedia({ reducedMotion: "reduce" });

  const geometry = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".personalizados-desktop-hero")!.getBoundingClientRect();
    const copy = document.querySelector<HTMLElement>(".personalizados-desktop-hero-copy")!.getBoundingClientRect();
    const gallery = document.querySelector<HTMLElement>(".personalizados-desktop-gallery")!.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>(".personalizados-desktop-gallery-card")!.getBoundingClientRect();
    const craft = document.querySelector<HTMLElement>(".personalizados-desktop-craft")!.getBoundingClientRect();
    const craftGrid = document.querySelector<HTMLElement>(".personalizados-desktop-craft-grid")!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>(".home-footer")!.getBoundingClientRect();
    return {
      copyX: Math.round(copy.x),
      copyOffset: Math.round(copy.y - hero.y),
      galleryOffset: Math.round(gallery.y - hero.y),
      cardX: Math.round(card.x),
      cardOffset: Math.round(card.y - gallery.y),
      craftOffset: Math.round(craft.y - hero.y),
      craftGridX: Math.round(craftGrid.x),
      craftGridWidth: Math.round(craftGrid.width),
      footerOffset: Math.round(footer.y - hero.y),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(geometry).toEqual({
    copyX: 104,
    copyOffset: 169,
    galleryOffset: 680,
    cardX: 64,
    cardOffset: 80,
    craftOffset: 1224,
    craftGridX: 96,
    craftGridWidth: 1248,
    footerOffset: 1604,
    overflow: 0,
  });

  const transitionDuration = await page.locator(".personalizados-desktop-gallery-card img").first().evaluate((image) => parseFloat(getComputedStyle(image).transitionDuration));
  expect(transitionDuration).toBeLessThanOrEqual(0.00001);
  await expect(page.locator(".personalizados-desktop-gallery-track")).toHaveCSS("animation-name", "none");

  const results = await new AxeBuilder({ page }).include(".personalizados-desktop-view").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("personalizados móvil conserva la composición del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 1024, "El frame 476:41 corresponde a móvil");
  const expectedCopyWidth = (page.viewportSize()?.width ?? 390) >= 768 ? 720 : 342;
  await page.goto("/personalizados", { waitUntil: "domcontentloaded" });

  const mobile = page.locator(".personalizados-mobile-view");
  await expect(mobile.locator(".personalizados-mobile-hero")).toHaveCSS("height", "640px");
  await expect(mobile.locator(".personalizados-mobile-gallery")).toHaveCSS("height", "476px");
  await expect(mobile.locator(".personalizados-mobile-gallery-card")).toHaveCount(20);
  await expect(mobile.locator(".personalizados-mobile-gallery-group").first().locator(".personalizados-mobile-gallery-card")).toHaveCount(10);
  await expect(mobile.locator(".personalizados-mobile-gallery-card").first()).toHaveCSS("width", "300px");
  await expect(mobile.locator(".personalizados-mobile-gallery-card").first()).toHaveCSS("height", "380px");
  await expect(mobile.locator(".personalizados-mobile-pagination")).toHaveCount(0);
  await expect(page.locator(".personalizados-desktop-view")).toBeHidden();
  await expect(mobile.getByRole("link", { name: "Abrir personalizador" })).toBeVisible();

  const carouselMotion = await mobile.locator(".personalizados-mobile-gallery-track").evaluate((track) => {
    const style = getComputedStyle(track);
    return {
      duration: style.animationDuration,
      iterations: style.animationIterationCount,
      name: style.animationName,
      playState: style.animationPlayState,
    };
  });
  expect(carouselMotion).toEqual({
    duration: "48s",
    iterations: "infinite",
    name: "personalizados-mobile-carousel-loop",
    playState: "running",
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const geometry = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".home-header")!.getBoundingClientRect();
    const hero = document.querySelector<HTMLElement>(".personalizados-mobile-hero")!.getBoundingClientRect();
    const copy = document.querySelector<HTMLElement>(".personalizados-mobile-hero-copy")!.getBoundingClientRect();
    const button = document.querySelector<HTMLElement>(".personalizados-mobile-hero-copy a")!.getBoundingClientRect();
    const gallery = document.querySelector<HTMLElement>(".personalizados-mobile-gallery")!.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>(".personalizados-mobile-gallery-card")!.getBoundingClientRect();
    const craft = document.querySelector<HTMLElement>(".personalizados-mobile-craft")!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>(".home-footer")!.getBoundingClientRect();
    return {
      headerHeight: Math.round(header.height),
      heroOffset: Math.round(hero.y),
      copyX: Math.round(copy.x),
      copyOffset: Math.round(copy.y - hero.y),
      copyWidth: Math.round(copy.width),
      buttonWidth: Math.round(button.width),
      buttonHeight: Math.round(button.height),
      galleryOffset: Math.round(gallery.y - hero.y),
      cardX: Math.round(card.x),
      cardOffset: Math.round(card.y - gallery.y),
      craftOffset: Math.round(craft.y - hero.y),
      craftHeight: Math.round(craft.height),
      footerOffset: Math.round(footer.y - hero.y),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(geometry).toEqual({
    headerHeight: 72,
    heroOffset: 72,
    copyX: 24,
    copyOffset: 56,
    copyWidth: expectedCopyWidth,
    buttonWidth: 190,
    buttonHeight: 52,
    galleryOffset: 640,
    cardX: 24,
    cardOffset: 48,
    craftOffset: 1116,
    craftHeight: 332,
    footerOffset: 1448,
    overflow: 0,
  });
  await expect(mobile.locator(".personalizados-mobile-gallery-track")).toHaveCSS("animation-name", "none");

  const results = await new AxeBuilder({ page }).include(".personalizados-mobile-view").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("el catálogo web conserva las medidas del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "El frame 407:20 corresponde a escritorio");
  await page.goto("/catalogo");

  await expect(page.locator(".catalog-hero")).toHaveCSS("height", "420px");
  await expect(page.locator(".catalog-product-card")).toHaveCount(15);
  await expect(page.locator(".catalog-product-card").first()).toBeVisible();
  const firstRow = await page.locator(".catalog-product-card").evaluateAll((cards) => cards.slice(0, 3).map((card) => {
    const bounds = card.getBoundingClientRect();
    return { x: Math.round(bounds.x), width: Math.round(bounds.width) };
  }));
  expect(firstRow.map((card) => card.width)).toEqual([289, 289, 289]);
  expect(firstRow[1].x - firstRow[0].x).toBe(329);

  const layout = await page.locator(".catalog-desktop-layout").boundingBox();
  const filters = await page.locator(".catalog-filters").boundingBox();
  const results = await page.locator(".catalog-results").boundingBox();
  expect(layout).not.toBeNull();
  expect(filters).not.toBeNull();
  expect(results).not.toBeNull();
  expect(Math.round((results?.x ?? 0) - (filters?.x ?? 0))).toBe(284);

  const filterPanel = page.locator(".catalog-desktop-view .catalog-filters-inner");
  await expect(filterPanel).toHaveCSS("position", "relative");
  await expect(filterPanel).toHaveCSS("overflow", "visible");
  const filterDimensions = await filterPanel.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(filterDimensions.scrollHeight).toBe(filterDimensions.clientHeight);
  await expect(filterPanel.getByText("Próximamente", { exact: true })).toBeVisible();

  const cta = page.locator(".catalog-desktop-view .catalog-personalize-cta");
  expect((await cta.boundingBox())?.width ?? 0).toBeGreaterThan(1100);
  await expect(cta).toHaveCSS("height", "360px");
  await expect(cta.getByRole("link", { name: "Quiero hacerlo" })).toHaveAttribute("href", "/personalizados");
  await expect(page.locator(".catalog-mobile-view")).toBeHidden();

  await page.goto("/catalogo?categoria=materas");
  const materasCta = page.locator(".catalog-desktop-view .catalog-personalize-cta");
  await expect(materasCta).toBeVisible();
  await page.evaluate(() => {
    const personalize = document.querySelector<HTMLElement>(".catalog-desktop-view .catalog-personalize-cta")!;
    window.scrollTo(0, window.scrollY + personalize.getBoundingClientRect().top - 500);
  });
  const filterAtCatalogEnd = await page.locator(".catalog-desktop-view .catalog-filters-inner").boundingBox();
  const ctaAtCatalogEnd = await materasCta.boundingBox();
  expect(filterAtCatalogEnd).not.toBeNull();
  expect(ctaAtCatalogEnd).not.toBeNull();
  expect((filterAtCatalogEnd?.y ?? 0) + (filterAtCatalogEnd?.height ?? 0)).toBeLessThanOrEqual((ctaAtCatalogEnd?.y ?? 0) + 1);

  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

test("el catálogo móvil conserva las medidas del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 1024, "El frame 437:17 corresponde a móvil");
  await page.goto("/catalogo");
  const mobileCatalog = page.locator("main#contenido > .catalog-mobile-view").first();

  await expect(mobileCatalog.locator(".catalog-mobile-hero")).toHaveCSS("height", "420px");
  await expect(mobileCatalog.locator(".catalog-mobile-personalize")).toHaveCSS("height", "510px");
  await expect(mobileCatalog.locator(".catalog-mobile-product-card")).toHaveCount(15);
  await expect(page.locator(".catalog-desktop-view")).toBeHidden();
  await expect(mobileCatalog.getByRole("group", { name: "Precio" })).toBeVisible();
  await expect(mobileCatalog.getByRole("group", { name: "Material" })).toBeVisible();
  await expect(mobileCatalog.getByRole("group", { name: "Tipo de mate" })).toBeVisible();
  await expect(mobileCatalog.getByRole("group", { name: "Color" })).toBeVisible();
  await expect(mobileCatalog.getByRole("checkbox", { name: "Arena" })).toBeDisabled();

  const geometry = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".catalog-mobile-product-grid")!.getBoundingClientRect();
    const cards = [...document.querySelectorAll<HTMLElement>(".catalog-mobile-product-card")];
    const firstCard = cards[0].getBoundingClientRect();
    const secondCard = cards[1].getBoundingClientRect();
    const firstImage = cards[0].querySelector<HTMLElement>(".catalog-mobile-product-image")!.getBoundingClientRect();
    const hero = document.querySelector<HTMLElement>(".catalog-mobile-hero")!.getBoundingClientRect();
    const controls = document.querySelector<HTMLElement>(".catalog-mobile-controls")!.getBoundingClientRect();
    const products = document.querySelector<HTMLElement>(".catalog-mobile-products")!.getBoundingClientRect();
    const personalize = document.querySelector<HTMLElement>(".catalog-mobile-personalize")!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>(".home-footer")!.getBoundingClientRect();
    return {
      gridWidth: Math.round(grid.width),
      cardWidth: Math.round(firstCard.width),
      imageHeight: Math.round(firstImage.height),
      columnPitch: Math.round(secondCard.x - firstCard.x),
      controlsOffset: Math.round(controls.y - hero.y),
      productsOffset: Math.round(products.y - hero.y),
      personalizeOffset: Math.round(personalize.y - hero.y),
      footerOffset: Math.round(footer.y - hero.y),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(geometry).toMatchObject({
    gridWidth: 342,
    cardWidth: 163,
    imageHeight: 204,
    columnPitch: 179,
    controlsOffset: 420,
    overflow: 0,
  });
  expect(geometry.productsOffset).toBeGreaterThan(geometry.controlsOffset);
  expect(geometry.personalizeOffset).toBeGreaterThan(geometry.productsOffset);
  expect(geometry.footerOffset).toBeGreaterThan(geometry.personalizeOffset);

  await mobileCatalog.getByRole("radio", { name: "Bombillas", exact: true }).check();
  await expect(page).toHaveURL(/categoria=bombillas/);
  await expect(mobileCatalog.locator(".catalog-mobile-product-card")).toHaveCount(2);
  await expect(mobileCatalog.getByRole("heading", { name: "Bombilla de acero desarmable", exact: true })).toBeVisible();

  await mobileCatalog.getByRole("radio", { name: "Todos", exact: true }).check();
  await expect(page).not.toHaveURL(/categoria=/);
  await mobileCatalog.getByRole("combobox", { name: "Ordenar productos" }).selectOption("precio");
  await expect(page).toHaveURL(/orden=precio/);
  await expect(mobileCatalog.locator(".catalog-mobile-product-card").first().getByRole("heading", { level: 2 })).toHaveText("Mate Torpedo");

  const results = await new AxeBuilder({ page }).include(".catalog-mobile-view").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("combina precio, material y tipo de mate", async ({ page }) => {
  await page.goto("/catalogo?precio=3000-4999&precio=5000-6999&material=cuero&tipo=imperial");
  const catalog = page.locator((page.viewportSize()?.width ?? 1440) >= 1024 ? ".catalog-desktop-view" : ".catalog-mobile-view");
  const cardSelector = (page.viewportSize()?.width ?? 1440) >= 1024 ? ".catalog-product-card" : ".catalog-mobile-product-card";
  await expect(catalog.locator(cardSelector)).toHaveCount(2);
  await expect(catalog.getByRole("heading", { name: "Mate Imperial", exact: true })).toBeVisible();
  await expect(catalog.getByRole("heading", { name: "Imperial animal print", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/precio=3000-4999&precio=5000-6999&material=cuero&tipo=imperial/);
});

test("el clip de portada está visible y se reproduce sin sonido", async ({ page }) => {
  await page.goto("/");
  const heroVideo = page.locator(".home-hero-video");
  await expect(heroVideo).toHaveAttribute("autoplay", "");
  await expect(heroVideo).toHaveAttribute("loop", "");
  await expect(heroVideo).toHaveAttribute("preload", "metadata");
  await expect(heroVideo).toHaveAttribute("src", /hero-segment\.mp4$/);
  await expect.poll(() => heroVideo.evaluate((element) => (element as HTMLVideoElement).muted)).toBe(true);
  await expect.poll(() => heroVideo.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(false);
  await expect(page.getByAltText("Marca País Uruguay")).toBeAttached();
});

test("respeta reduced motion y no desborda horizontalmente", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".home-hero-video")).toHaveCSS("display", "none");
  await expect(page.locator(".home-hero-content")).toHaveCSS("transform", "none");
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

test("todas las fotos editoriales responden al hover", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "El hover corresponde a puntero de escritorio");
  await page.goto("/");
  const photos = page.locator(".home-image");
  const photoCount = await photos.count();
  expect(photoCount).toBeGreaterThan(0);
  for (let index = 0; index < photoCount; index += 1) {
    const photo = photos.nth(index);
    const image = photo.locator("img");
    await photo.scrollIntoViewIfNeeded();
    const before = await image.evaluate((element) => getComputedStyle(element).transform);
    await photo.hover();
    await page.waitForTimeout(120);
    const after = await image.evaluate((element) => getComputedStyle(element).transform);
    expect(after).not.toBe(before);
  }
});

test("la portada web mantiene compactos Campeones y Visítanos", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "La composición solicitada corresponde a escritorio");
  await page.goto("/");
  const championsHeight = await page.locator(".home-champions").evaluate((element) => element.getBoundingClientRect().height);
  expect(championsHeight).toBeLessThanOrEqual(740);

  await page.locator(".home-visit").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const visitClearance = await page.locator(".home-visit").evaluate((section) => {
    const image = section.querySelector<HTMLElement>(".home-visit-image");
    if (!image) return 0;
    return section.getBoundingClientRect().bottom - image.getBoundingClientRect().bottom;
  });
  expect(visitClearance).toBeGreaterThanOrEqual(80);
});

test("la portada móvil respeta la composición y la paleta de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 1024, "La referencia 417:9 corresponde a móvil");
  await page.goto("/");

  await expect(page.locator(".home-hero")).toHaveCSS("height", "560px");
  await expect(page.locator(".home-history")).toHaveCSS("background-color", "rgb(113, 110, 89)");

  const categoryCards = page.locator(".home-category-card");
  await expect(categoryCards).toHaveCount(5);
  for (let index = 0; index < 4; index += 1) {
    await expect(categoryCards.nth(index)).toHaveCSS("background-color", "rgb(49, 28, 18)");
  }
  await expect(categoryCards.nth(4)).toHaveCSS("background-color", "rgb(113, 110, 89)");
  await expect(page.locator(".home-category-grid")).toHaveCSS("width", "342px");

  await expect(page.locator(".home-personalized-image")).toHaveCSS("height", "310px");
  await expect(page.locator(".home-imperial-image")).toHaveCSS("height", "360px");
  await expect(page.locator(".home-culture-image")).toHaveCSS("height", "390px");
  await expect(page.locator(".home-visit-image")).toHaveCSS("height", "300px");

  const footer = page.locator(".home-footer");
  await expect(footer).toHaveCSS("background-color", "rgb(113, 110, 89)");
  await expect(footer.locator('input[name="email"]')).toHaveCSS("height", "52px");
  await expect(footer.getByRole("button", { name: "Suscribirme" })).toHaveCSS("border-radius", "8px");
  const footerRhythm = await footer.evaluate((element) => {
    const main = element.querySelector<HTMLElement>(".home-footer-main");
    const email = element.querySelector<HTMLElement>('#site-newsletter-email');
    const button = element.querySelector<HTMLElement>(".home-footer-newsletter button");
    if (!main || !email || !button) return null;
    const footerBounds = element.getBoundingClientRect();
    return {
      emailTop: Math.round(email.getBoundingClientRect().top - footerBounds.top),
      buttonBottom: Math.round(button.getBoundingClientRect().bottom - footerBounds.top),
      bottomSpace: Math.round(main.getBoundingClientRect().bottom - button.getBoundingClientRect().bottom),
    };
  });
  expect(footerRhythm?.emailTop).toBeGreaterThan(180);
  expect(footerRhythm?.buttonBottom).toBeGreaterThan(footerRhythm?.emailTop ?? 0);
  expect(footerRhythm?.bottomSpace).toBeGreaterThanOrEqual(20);

  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

test("clientes presenta el alcance internacional y controla el carrusel", async ({ page }) => {
  await page.goto("/clientes");
  const viewportWidth = page.viewportSize()?.width ?? 1440;
  const isPhone = viewportWidth < 768;
  await expect(page).toHaveTitle(/Clientes alrededor del mundo/);
  await expect(page.getByRole("heading", { level: 1, name: /Hecho acá/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Destinos internacionales de MateArte Uruguay" })).toBeVisible();

  const destinationList = page.locator(".international-destination-list");
  await expect(destinationList.locator("button")).toHaveCount(17);
  expect(await destinationList.locator("strong").allTextContents()).toEqual([
    "Alemania",
    "Argentina",
    "Australia",
    "Brasil",
    "Chile",
    "Costa Rica",
    "Emiratos Árabes Unidos",
    "España",
    "Estados Unidos",
    "Francia",
    "Honduras",
    "Italia",
    "México",
    "Paraguay",
    "Reino Unido",
    "Rusia",
    "Singapur",
  ]);
  if (isPhone) {
    await expect(destinationList).toBeHidden();
    await expect(page.locator(".international-map-country--destination")).toHaveCount(17);
  } else {
    const destinations = page.getByRole("list", { name: "Lista de destinos internacionales" });
    await destinations.getByRole("button", { name: /Singapur/ }).click();
    await expect(page.getByText("Asia", { exact: true })).toBeVisible();
  }

  const pauseButton = page.getByRole("button", { name: "Pausar carrusel" });
  await expect(pauseButton).toBeVisible();
  await pauseButton.focus();
  await pauseButton.press("Enter");
  await expect(page.getByRole("button", { name: "Reanudar carrusel" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".testimonial-scroller").first()).toHaveAttribute("data-paused", "true");
  await expect(page.locator(".testimonial-demo-note")).toHaveCount(0);
  await expect(page.locator(".testimonial-card").filter({ hasText: "Luis N." }).first().getByText("Australia", { exact: true })).toBeAttached();
  await expect(page.locator(".testimonial-card").filter({ hasText: "Yaquelin L." }).first().getByText("Uruguay", { exact: true })).toBeAttached();
  await expect(page.locator(".testimonial-card").getByText("Google Maps", { exact: true })).toHaveCount(0);
  await expect(page.locator(".testimonial-card").getByText("cliente", { exact: true })).toHaveCount(0);

  const results = await new AxeBuilder({ page }).include(".clientes-page").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("clientes web conserva la composición del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "El frame 516:543 corresponde a escritorio");
  await page.goto("/clientes", { waitUntil: "domcontentloaded" });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await expect(page.locator(".international-cta")).toHaveCSS("height", "340px");
  await expect(page.locator(".testimonial-card")).toHaveCount(22);
  await expect(page.locator(".testimonial-demo-note")).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>(".international-map-section")!.getBoundingClientRect();
    const heading = document.querySelector<HTMLElement>(".international-section-heading")!.getBoundingClientRect();
    const map = document.querySelector<HTMLElement>(".international-map-layout")!.getBoundingClientRect();
    const canvas = document.querySelector<HTMLElement>(".international-map-canvas")!.getBoundingClientRect();
    const countries = document.querySelector<HTMLElement>(".international-destination-list")!.getBoundingClientRect();
    const testimonials = document.querySelector<HTMLElement>(".testimonials-section")!.getBoundingClientRect();
    const testimonialHeading = document.querySelector<HTMLElement>(".testimonials-heading-grid")!.getBoundingClientRect();
    const rows = document.querySelector<HTMLElement>(".testimonial-rows")!.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>(".testimonial-card")!.getBoundingClientRect();
    const cta = document.querySelector<HTMLElement>(".international-cta")!.getBoundingClientRect();
    const ctaGrid = document.querySelector<HTMLElement>(".international-cta-grid")!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>(".home-footer")!.getBoundingClientRect();

    return {
      sectionHeight: Math.round(section.height),
      headingX: Math.round(heading.x),
      headingOffset: Math.round(heading.y - section.y),
      headingWidth: Math.round(heading.width),
      mapOffset: Math.round(map.y - section.y),
      canvasWidth: Math.round(canvas.width),
      countriesWidth: Math.round(countries.width),
      testimonialsOffset: Math.round(testimonials.y - section.y),
      testimonialHeadingOffset: Math.round(testimonialHeading.y - testimonials.y),
      rowsOffset: Math.round(rows.y - testimonials.y),
      cardWidth: Math.round(card.width),
      cardHeight: Math.round(card.height),
      ctaOffset: Math.round(cta.y - section.y),
      ctaGridOffset: Math.round(ctaGrid.y - cta.y),
      footerOffset: Math.round(footer.y - section.y),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(geometry).toEqual({
    sectionHeight: 1172,
    headingX: 96,
    headingOffset: 88,
    headingWidth: 1248,
    mapOffset: 344,
    canvasWidth: 912,
    countriesWidth: 304,
    testimonialsOffset: 1172,
    testimonialHeadingOffset: 96,
    rowsOffset: 232,
    cardWidth: 400,
    cardHeight: 248,
    ctaOffset: 2108,
    ctaGridOffset: 96,
    footerOffset: 2448,
    overflow: 0,
  });
});

test("clientes móvil conserva la composición del frame de Figma", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 768, "El frame 516:611 corresponde a móvil");
  await page.goto("/clientes", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".international-map-section")).toHaveCSS("height", "592px");
  await expect(page.locator(".international-map-canvas")).toHaveCSS("width", "342px");
  await expect(page.locator(".international-map-canvas")).toHaveCSS("height", "246px");
  await expect(page.locator(".international-destination-list")).toBeHidden();
  await expect(page.locator(".testimonials-section")).toHaveCSS("height", "522px");
  await expect(page.locator(".testimonial-card").first()).toHaveCSS("width", "300px");
  await expect(page.locator(".testimonial-card").first()).toHaveCSS("height", "186px");
  await expect(page.locator(".testimonial-scroller").nth(1)).toBeHidden();
  await expect(page.locator(".international-cta")).toHaveCSS("height", "426px");
  await expect(page.locator(".international-cta .button-primary")).toHaveCSS("height", "52px");
  await expect(page.locator(".international-cta .button-primary")).toHaveCSS("border-radius", "8px");

  const geometry = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>(".international-map-section")!.getBoundingClientRect();
    const canvas = document.querySelector<HTMLElement>(".international-map-canvas")!.getBoundingClientRect();
    const testimonials = document.querySelector<HTMLElement>(".testimonials-section")!.getBoundingClientRect();
    const rows = document.querySelector<HTMLElement>(".testimonial-rows")!.getBoundingClientRect();
    const cta = document.querySelector<HTMLElement>(".international-cta")!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>(".home-footer")!.getBoundingClientRect();
    return {
      mapOffset: Math.round(map.y),
      canvasOffset: Math.round(canvas.y - map.y),
      testimonialsOffset: Math.round(testimonials.y - map.y),
      rowsOffset: Math.round(rows.y - testimonials.y),
      ctaOffset: Math.round(cta.y - map.y),
      footerOffset: Math.round(footer.y - map.y),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(geometry).toEqual({
    mapOffset: 72,
    canvasOffset: 306,
    testimonialsOffset: 592,
    rowsOffset: 260,
    ctaOffset: 1114,
    footerOffset: 1540,
    overflow: 0,
  });

  const results = await new AxeBuilder({ page }).include(".clientes-page").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("el carrusel internacional respeta reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/clientes");
  await expect(page.getByRole("button", { name: "Movimiento reducido" })).toBeDisabled();
  await expect(page.locator(".testimonial-track").first()).toHaveCSS("animation-name", "none");
});

test("el menú móvil abre, identifica su estado y navega", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 1024, "Solo corresponde a navegación móvil y tablet");
  await page.goto("/");
  await page.waitForTimeout(500);
  const menuButton = page.getByRole("button", { name: "Abrir menú" });
  await menuButton.press("Enter");
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
  const mobileNavigation = page.getByRole("navigation", { name: "Navegación móvil" });
  await expect(mobileNavigation.locator("small")).toHaveCount(0);
  await mobileNavigation.getByRole("link", { name: "Nosotros", exact: true }).click();
  await expect(page).toHaveURL(/\/nosotros/);
});
