import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Public catalog variant used only in an isolated browser cart. No orders or accounts are created.
const variantId = "fefb67e1-2bd5-457e-8d44-d4ff5fb4c4e3";
test.beforeEach(async ({page}) => {
  await page.addInitScript(({variantId}) => {
    if (!localStorage.getItem("cart-test-seeded")) {
      localStorage.setItem("matearte_visitor_cart_v1",JSON.stringify(["39","40"].map(talle => ({variantId,quantity:1,optionValues:{color:"marron-blanco",talle}}))));
      localStorage.setItem("cart-test-seeded","true");
    }
    sessionStorage.setItem("matearte-welcome-dismissed","1");
  },{variantId});
});
test("carrito real, opciones, controles, recomendaciones y accesibilidad",async({page}) => {
  await page.goto("/carrito");
  const main=page.locator("main");
  await expect(main.getByText("Total: $ 11.200 UYU")).toBeVisible();
  const selected=main.getByRole("region",{name:"Artículos seleccionados"});
  await expect(selected.getByText("Color: Marrón/Blanco, Talle: 39")).toBeVisible();
  await expect(selected.getByText("Color: Marrón/Blanco, Talle: 40")).toBeVisible();
  await expect(selected.getByText("$ 5.600 UYU c/u",{exact:true})).toHaveCount(2);
  const quantity=selected.getByRole("spinbutton").first();
  const control=selected.getByRole("group").first();
  const bounds=await control.evaluate(e=>({outer:e.getBoundingClientRect().toJSON(),children:[...e.children].map(c=>c.getBoundingClientRect().toJSON())}));
  expect(bounds.outer.width).toBe(132);
  expect(bounds.children.map(c=>Math.round(c.width))).toEqual([44,44,44]);
  expect(Math.abs(bounds.children[1].x+bounds.children[1].width/2-(bounds.outer.x+66))).toBeLessThan(1);
  const trash=selected.locator("button:has(svg)").first();
  await expect(trash).toHaveAccessibleName("Quitar Zueco Cuero Vaquita del carrito");
  expect(await trash.locator("svg").evaluate(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))).toEqual({w:20,h:20});
  const rail=main.getByRole("region",{name:"Productos complementarios, deslizá para ver más"});
  await expect(rail.getByRole("article")).toHaveCount(2);
  // The single-color card holder can be added immediately; the two-color one still needs a choice.
  await expect(rail.getByRole("button",{name:"Agregar Tarjetero de Dama al carrito"})).toBeVisible();
  await expect(rail.getByRole("button",{name:"Agregar Tarjetero al carrito",exact:true})).toHaveCount(0);
  await expect(rail.getByRole("link",{name:"Ver producto"})).toHaveCount(2);
  const cards=await rail.getByRole("article").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  expect(cards[0].y).toBe(cards[1].y);
  if((page.viewportSize()?.width ?? 1440)<768) {
    expect(cards[0].width).toBe(266);
    const session=await page.context().newCDPSession(page);
    await rail.scrollIntoViewIfNeeded();
    const box=(await rail.boundingBox())!;
    await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+250,y:box.y+80}]});
    for(let x=230;x>=50;x-=30) await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+x,y:box.y+80}]});
    await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect.poll(()=>rail.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
  await quantity.fill("2");await quantity.blur();
  await expect(main.getByText("Total: $ 16.800 UYU")).toBeVisible();
  await page.reload();await expect(main.getByText("Total: $ 16.800 UYU")).toBeVisible();
  await main.getByRole("region",{name:"Artículos seleccionados"}).locator("button:has(svg)").first().click();
  await expect(main.getByText("Total: $ 5.600 UYU")).toBeVisible();
  const result=await new AxeBuilder({page}).include("main").analyze();
  expect(result.violations).toEqual([]);
});

test("las traducciones y monedas del carrito se mantienen",async({page})=>{
  for(const [path,title,related,currency,options] of [
    ["/en/cart","Cart","Complete your cart","USD","Color: Brown/White, Size: 39"],
    ["/pt/carrinho","Carrinho","Complete seu carrinho","BRL","Cor: Marrom/Branco, Tamanho: 39"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading",{level:1})).toHaveText(title);
    await expect(page.getByRole("heading",{name:related})).toBeVisible();
    await expect(page.locator("main").getByText(options,{exact:true})).toBeVisible();
    await expect(page.locator("main aside")).toContainText(currency);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
  }
});

test("una combinación única se agrega con su color y respeta movimiento reducido", async ({ page }) => {
  await page.goto("/carrito");
  const main = page.locator("main");
  const related = main.getByRole("region", { name: "Productos complementarios, deslizá para ver más" });
  const card = related.getByRole("article").filter({ has: page.getByRole("heading", { name: "Tarjetero de Dama", exact: true }) });
  const add = card.getByRole("button", { name: "Agregar Tarjetero de Dama al carrito" });
  await expect(add).toBeVisible();
  if (page.viewportSize()!.width >= 768) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await card.hover();
    await expect.poll(() => card.evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m42)).toBe(-4);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(card).toHaveCSS("transform", "none");
    await expect(card.locator("img").first()).toHaveCSS("transform", "none");
  }
  await add.click();
  await expect(main.getByText("Total: $ 12.600 UYU")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("matearte_visitor_cart_v1") || "[]"));
  expect(stored.find((item: { variantId: string }) => item.variantId === "53aae4d1-ff22-4dfc-91d6-681096e76728")).toMatchObject({ quantity: 1, optionValues: { color: "blanco-dorado" } });
  await expect(main.getByRole("region", { name: "Artículos seleccionados" }).getByRole("article")).toHaveCount(3);
  await page.reload();
  await expect(main.getByText("Total: $ 12.600 UYU")).toBeVisible();
});
