type DraftOpportunity = {
  empresa: string;
  actividad: string;
  ubicacion: string;
  pais: string;
  propuesta: string;
  apertura_correo: string | null;
};

export function buildOpportunityEmail(row: DraftOpportunity) {
  const { empresa, actividad, ubicacion, pais, propuesta, apertura_correo } =
    row;
  const domestic = pais === "Uruguay";
  const rural = actividad === "Consignación de ganado";
  const giftBoxes = propuesta === "Mates artesanales para cajas navideñas";
  const forMembers = rural || /cooperativa/i.test(actividad);
  const subject = domestic
    ? rural
      ? "mates para sus clientes"
      : forMembers
        ? "mates para sus socios"
        : "regalos para su equipo"
    : giftBoxes
      ? "mates para sus cajas"
      : "mates uruguayos para reventa";

  const localTie =
    ubicacion === "Localidad por confirmar" ? "" : ` en ${ubicacion}`;
  const opening =
    apertura_correo?.trim() ||
    (rural
      ? `Pensé en ${empresa} por el trabajo que hacen con productores${localTie}. Quería proponerles un mate con el logo del escritorio para regalar a productores o clientes.`
      : domestic
        ? `Quería hacerle llegar a ${empresa} una propuesta de regalos personalizados para su equipo o sus clientes.`
        : `Quería mostrarles algunos mates uruguayos que ${empresa} podría sumar a su surtido.`);

  const offer = domestic
    ? "Soy Richard, de MateArte. Hacemos mates de calabaza y cuero en nuestra empresa en Uruguay. Personalizamos pedidos desde 30 unidades y podemos mostrarles cómo quedaría el logo."
    : "Soy Richard, de MateArte. Hacemos mates de calabaza y cuero a mano en nuestra empresa en Uruguay y armamos selecciones con bombillas para comercios.";

  const ask = domestic
    ? "Les puedo mandar un par de opciones con fotos para que las evalúen?"
    : "Les puedo mandar una selección corta con fotos y precios mayoristas?";

  const website = domestic
    ? "https://www.matearteuruguay.com/empresas"
    : "https://www.matearteuruguay.com/";

  return {
    subject,
    body: [
      "Hola, cómo están?",
      opening,
      offer,
      ask,
      `Richard Ortiz\nMateArte\n25 de Mayo 1734, Paysandú, Uruguay\n${website}`,
    ].join("\n\n"),
  };
}
