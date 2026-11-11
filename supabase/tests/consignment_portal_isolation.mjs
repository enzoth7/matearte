// Run only against a staging project with two active portal users, one paused
// portal user, two distinct consignments and an internal staff user.
import assert from "node:assert/strict";

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Falta ${key}`);
  return value;
};
const base = required("MATEARTE_TEST_SUPABASE_URL").replace(/\/$/, "");
const anon = required("MATEARTE_TEST_ANON_KEY");
const people = ["A", "B", "PAUSED", "STAFF"].map((name) => ({
  name,
  email: required(`MATEARTE_TEST_${name}_EMAIL`),
  password: required(`MATEARTE_TEST_${name}_PASSWORD`),
  expectedId: name === "A" || name === "B" ? required(`MATEARTE_TEST_${name}_CONSIGNMENT_ID`) : null,
}));
const headers = (token) => ({ apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

async function signIn(person) {
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: headers(anon), body: JSON.stringify({ email: person.email, password: person.password }),
  });
  assert.equal(response.status, 200, `${person.name}: no pudo iniciar sesión`);
  const data = await response.json();
  assert.ok(data.access_token, `${person.name}: falta token`);
  return data.access_token;
}

async function call(token, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST", headers: headers(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function checkPortal(person, token, otherId) {
  const panel = await call(token, "/functions/v1/gestion-consignatario", {});
  assert.equal(panel.status, 200, `${person.name}: panel rechazado`);
  const ids = panel.body.consignments?.map((item) => item.id) || [];
  assert.ok(ids.includes(person.expectedId), `${person.name}: falta su consignación`);
  assert.ok(!ids.includes(otherId), `${person.name}: recibió una consignación ajena`);
  assert.ok(panel.body.consignments.every((item) => !("contactId" in item) && !("note" in item)),
    `${person.name}: el panel incluyó datos internos`);

  for (const table of ["orders", "contacts", "wholesale_consignments", "customer_account_receipts", "settings"]) {
    const direct = await call(token, `/rest/v1/${table}?select=*&limit=1`);
    assert.equal(direct.status, 403, `${person.name}: lectura directa permitida de ${table}`);
  }
  const write = await call(token, "/rest/v1/rpc/gestion_record_wholesale_consignment_movement", {
    p_id: crypto.randomUUID(), p_line_id: crypto.randomUUID(), p_kind: "dispatch",
    p_quantity: 1, p_occurred_on: "2026-11-01", p_carrier: null, p_tracking: null, p_note: null,
  });
  assert.equal(write.status, 403, `${person.name}: RPC de escritura no bloqueada`);
}

const tokens = Object.fromEntries(await Promise.all(people.map(async (person) => [person.name, await signIn(person)])));
await checkPortal(people[0], tokens.A, people[1].expectedId);
await checkPortal(people[1], tokens.B, people[0].expectedId);
const pausedPanel = await call(tokens.PAUSED, "/functions/v1/gestion-consignatario", {});
assert.equal(pausedPanel.status, 403, "La cuenta pausada pudo leer el panel");
const pausedDirect = await call(tokens.PAUSED, "/rest/v1/orders?select=id&limit=1");
assert.equal(pausedDirect.status, 403, "La cuenta pausada pudo consultar la base");
const staffRead = await call(tokens.STAFF, "/rest/v1/orders?select=id&limit=1");
assert.equal(staffRead.status, 200, "El personal perdió su lectura habitual");
console.log("Aislamiento de dos cuentas, cuenta pausada, RPC y lectura interna: correcto.");
