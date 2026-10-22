import { useState } from "react";
import type { Customer, CustomerSourceChannel } from "./data";
import { customerOriginLabel, customerOriginOptions } from "./customerChannel";
import { countryDisplayName, countryOptions, flagCode } from "./location";
import { customerPhonePrefix, joinCustomerPhone, splitCustomerPhone } from "./customerPhone";
import { customerDepartments } from "./customerLocation";

export const customerInterestOptions = ["mates", "bombillas", "materas", "termos", "personalizados", "botas", "carteras", "otros-articulos-cuero"];
export const customerCategoryOptions = ["Mates", "Bombillas", "Termos", "Carteras", "Materas", "Cintos", "Cuchillos", "Billeteras", "Botas"];

export type CustomerFormValues = {
  name: string; company: string; email: string; originChannel: string; customerType: string;
  phone: string; birthDate: string; city: string; country: string; department: string;
  postalCode: string; address: string; additionalPhones: string[]; inferredCategory: string;
  productInterest: string; notes: string;
};

export function readCustomerForm(form: HTMLFormElement): CustomerFormValues {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) || "").trim();
  return {
    name: value("name").replace(/\s+/g, " "), company: value("company"), email: value("email"),
    originChannel: value("originChannel"), customerType: value("customerType"),
    phone: joinCustomerPhone(value("prefix"), value("phone")), birthDate: value("birthDate"),
    city: value("city"), country: value("country") === "Sin especificar" ? "" : value("country"),
    department: value("department"), postalCode: value("postalCode"), address: value("address"),
    additionalPhones: value("additionalPhones").split(/[\n,;]/).map((phone) => phone.trim()).filter(Boolean),
    inferredCategory: value("inferredCategory"), productInterest: value("productInterest"), notes: value("notes"),
  };
}

export function CustomerFormFields({ customer, defaultOrigin = "Local", defaultType = "Minorista", emailReadOnly = false, emailRequired = false, phoneRequired = false, nameRequired = false, typeLocked = false }: {
  customer?: Customer; defaultOrigin?: CustomerSourceChannel; defaultType?: "Minorista" | "Mayorista";
  emailReadOnly?: boolean; emailRequired?: boolean; phoneRequired?: boolean; nameRequired?: boolean; typeLocked?: boolean;
}) {
  const initialCountry = countryDisplayName(customer?.country || "");
  const [country, setCountry] = useState(initialCountry);
  const [department, setDepartment] = useState(customer?.department || "");
  const countries = initialCountry && !countryOptions.includes(initialCountry) ? [...countryOptions, initialCountry] : countryOptions;
  const departmentOptions = customerDepartments(country, department);
  const phone = splitCustomerPhone(customer?.phone || "", customer?.country);
  return <div className="form-grid customer-unified-grid">
    <label>Nombre completo<input name="name" required={nameRequired} maxLength={120} defaultValue={customer?.name || ""} /></label>
    <label>Empresa o institución<input name="company" maxLength={120} defaultValue={customer?.companyName || ""} /></label>
    <label>Correo<input name="email" type="email" required={emailRequired} readOnly={emailReadOnly} maxLength={320} defaultValue={customer?.email || ""} /></label>
    <label>Canal de origen<select name="originChannel" defaultValue={customer?.originChannel || defaultOrigin}>{customerOriginOptions.map((option) => <option key={option} value={option}>{customerOriginLabel(option)}</option>)}</select></label>
    <label>Tipo de cliente{typeLocked && <input type="hidden" name="customerType" value={defaultType} />}<select {...(typeLocked ? { disabled: true } : { name: "customerType" })} defaultValue={customer?.segment === "Mayorista" ? "Mayorista" : customer?.segment === "Minorista" ? "Minorista" : defaultType}><option>Minorista</option><option>Mayorista</option></select></label>
    <label>Prefijo<input name="prefix" type="tel" inputMode="tel" maxLength={8} placeholder="+598" defaultValue={phone.prefix || customerPhonePrefix(flagCode(customer?.country || "Uruguay") || customer?.country || "Uruguay")} /></label>
    <label>Celular<input name="phone" type="tel" inputMode="tel" required={phoneRequired} maxLength={40} defaultValue={phone.number} /></label>
    <label>Fecha de nacimiento<input name="birthDate" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} defaultValue={customer?.birthDate || ""} /></label>
    <label>Ciudad<input name="city" maxLength={120} defaultValue={customer?.city || ""} /></label>
    <label>País<select aria-label="País" name="country" value={country || "Sin especificar"} onChange={(event) => { setCountry(event.target.value); setDepartment(""); }}>{countries.map((option) => <option key={option}>{option}</option>)}</select></label>
    <label>Departamento o provincia<select aria-label="Departamento o provincia" name="department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Sin especificar</option>{departmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Código postal<input name="postalCode" maxLength={32} defaultValue={customer?.postalCode || ""} /></label>
    <label className="wide">Dirección<input name="address" maxLength={250} defaultValue={customer?.address || ""} /></label>
    <label className="wide">Otros celulares<textarea name="additionalPhones" defaultValue={customer?.agendaAdditionalPhones?.join("\n") || ""} /></label>
    <label>Categoría inferida del nombre<select name="inferredCategory" defaultValue={customer?.agendaInferredCategory || ""}><option value="">Sin inferencia</option>{customerCategoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    <label>Producto de interés<select name="productInterest" defaultValue={customer?.raffleProductInterest || ""}><option value="">Sin especificar</option>{customerInterestOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    <label className="wide">Notas<textarea name="notes" maxLength={2000} defaultValue={customer?.notes || ""} /></label>
  </div>;
}
