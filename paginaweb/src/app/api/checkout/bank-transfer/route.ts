import { randomUUID } from "node:crypto";
import { apiError, apiOk } from "@/lib/api";
import { readCart } from "@/lib/cart";
import { calculateDesignPriceMinor } from "@/lib/design-pricing";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";
import { isWholesaleMateEligible, type WholesaleDiscountSettings } from "@/lib/wholesale-pricing";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maximumBytes = 5 * 1024 * 1024;
const uruguayDepartments = new Set(["Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"]);
type PublishedPricingCatalog = { versionId: string; version: number; rules: Record<string, number> };

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (mimeType === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (mimeType === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  return false;
}

function extensionFor(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "pdf";
}

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  const admin = createAdminSupabase();
  let uploadedPath = "";
  try {
    const requestedKey = request.headers.get("idempotency-key") || "";
    const idempotencyKey = uuid.test(requestedKey) ? requestedKey : randomUUID();
    const existing = await admin
      .from("orders")
      .select("id,order_number,status,total_minor")
      .eq("user_id", user.id)
      .eq("checkout_idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      return apiOk({
        orderId: existing.data.id,
        orderNumber: existing.data.order_number,
        status: existing.data.status,
        totalMinor: existing.data.total_minor,
        existing: true,
      });
    }

    const formData = await request.formData();
    const receipt = formData.get("receipt");
    if (!(receipt instanceof File) || receipt.size < 1) return apiError("Adjuntá el comprobante de la transferencia.");
    if (!allowedTypes.has(receipt.type)) return apiError("El comprobante debe ser JPG, PNG, WebP o PDF.");
    if (receipt.size > maximumBytes) return apiError("El comprobante supera el máximo de 5 MB.");

    const bytes = new Uint8Array(await receipt.arrayBuffer());
    if (!validSignature(bytes, receipt.type)) return apiError("El contenido del comprobante no coincide con el tipo de archivo.");

    const shippingRateId = text(formData.get("shippingRateId"), 80);
    if (!uuid.test(shippingRateId)) return apiError("Elegí una modalidad de entrega.");
    let customerValue: unknown = {};
    try { customerValue = JSON.parse(text(formData.get("customer"), 2000)); } catch { return apiError("Los datos del comprador no son válidos."); }
    const customer = customerValue && typeof customerValue === "object" && !Array.isArray(customerValue)
      ? customerValue as Record<string, unknown>
      : {};
    const fullName = text(customer.fullName, 120);
    const phone = text(customer.phone, 40);
    const department = text(customer.department, 80);
    const city = text(customer.city, 100);
    const address = text(customer.address, 240);
    if (!fullName || !phone) return apiError("Completá nombre y teléfono.");

    const [{ data: settings, error: settingsError }, { data: shippingRate, error: shippingError }] = await Promise.all([
      admin.from("commerce_settings")
        .select("commerce_enabled,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent")
        .eq("singleton", true)
        .single(),
      admin.from("shipping_rates").select("id,is_pickup,departments").eq("id", shippingRateId).eq("active", true).maybeSingle(),
    ]);
    if (settingsError || !settings?.commerce_enabled) return apiError("El comercio todavía no está habilitado.", 503);
    if (shippingError || !shippingRate) return apiError("La modalidad de entrega no está disponible.");
    if (!shippingRate.is_pickup && (!uruguayDepartments.has(department) || !city || !address)) return apiError("Completá una dirección de entrega válida en Uruguay.");
    if (!shippingRate.is_pickup && Array.isArray(shippingRate.departments) && shippingRate.departments.length > 0 && !shippingRate.departments.includes(department)) {
      return apiError("La modalidad elegida no está disponible para ese departamento.");
    }

    const cart = await readCart(admin, user.id);
    if (!cart.items.length) return apiError("El carrito está vacío.");
    const designIds = cart.items.filter((item) => item.item_type === "design").map((item) => item.design_id).filter(Boolean) as string[];
    const designPrices: Record<string, number> = {};
    let pricingVersionId: string | null = null;
    if (designIds.length) {
      const [{ data: designs, error: designsError }, { data: catalog, error: catalogError }] = await Promise.all([
        admin.from("designs").select("id,configuration,fleje_configuration").in("id", designIds).eq("user_id", user.id),
        admin.rpc("get_published_pricing_catalog"),
      ]);
      if (designsError || catalogError || !catalog || typeof catalog !== "object") throw new Error("No se pudo verificar el catálogo de precios.");
      for (const design of designs || []) {
        const priced = calculateDesignPriceMinor(design.configuration, design.fleje_configuration, catalog as unknown as PublishedPricingCatalog);
        designPrices[design.id] = priced.priceMinor;
        pricingVersionId = priced.pricingVersionId;
      }
      if (Object.keys(designPrices).length !== designIds.length) throw new Error("No se pudo verificar uno de los diseños.");
    }

    const eligibilityLines = cart.items.map((item) => {
      const variant = item.variant as unknown as { base_price_minor?: number; price_minor?: number; product?: { category?: string; category_code?: string | null } } | null;
      const unitPriceMinor = item.item_type === "design" ? designPrices[String(item.design_id)] : Number(variant?.price_minor);
      return {
        itemType: item.item_type,
        quantity: Number(item.quantity) || 1,
        unitPriceMinor,
        baseUnitPriceMinor: item.item_type === "catalog" ? Number(variant?.base_price_minor ?? unitPriceMinor) : unitPriceMinor,
        category: variant?.product?.category_code || variant?.product?.category || null,
      };
    });
    if (!isWholesaleMateEligible(eligibilityLines, settings as WholesaleDiscountSettings)) {
      return apiError("El carrito ya no alcanza el mínimo mayorista.", 409);
    }

    const receiptId = randomUUID();
    uploadedPath = `${user.id}/${idempotencyKey}/${receiptId}.${extensionFor(receipt.type)}`;
    const upload = await admin.storage.from("bank-transfer-receipts").upload(uploadedPath, bytes, {
      contentType: receipt.type,
      cacheControl: "0",
      upsert: false,
    });
    if (upload.error) throw new Error(`No se pudo guardar el comprobante: ${upload.error.message}`);

    const { data: result, error: orderError } = await admin.rpc("create_wholesale_bank_transfer_order", {
      p_user_id: user.id,
      p_cart_id: cart.id,
      p_shipping_rate_id: shippingRateId,
      p_design_prices: designPrices,
      p_customer_snapshot: { fullName, phone, department, city, address, email: user.email, pricingVersionId },
      p_idempotency_key: idempotencyKey,
      p_receipt_id: receiptId,
      p_receipt_storage_path: uploadedPath,
      p_receipt_original_name: receipt.name.slice(0, 240) || `comprobante.${extensionFor(receipt.type)}`,
      p_receipt_mime_type: receipt.type,
      p_receipt_byte_size: receipt.size,
    });
    if (orderError || !result) throw new Error(orderError?.message || "No se pudo crear el pedido.");
    if (result.existing) {
      await admin.storage.from("bank-transfer-receipts").remove([uploadedPath]);
      uploadedPath = "";
    }

    return apiOk({
      orderId: String(result.id),
      orderNumber: result.orderNumber,
      status: result.status,
      totalMinor: result.totalMinor,
      existing: Boolean(result.existing),
    }, result.existing ? 200 : 201);
  } catch (error) {
    if (uploadedPath) await admin.storage.from("bank-transfer-receipts").remove([uploadedPath]);
    return apiError(error instanceof Error ? error.message : "No se pudo completar el pedido.", 400);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
