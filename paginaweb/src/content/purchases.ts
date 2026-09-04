import type { Locale } from "@/types/catalog";

export type PurchasePolicySection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export type PurchasePolicyContent = {
  title: string;
  description: string;
  introduction: string;
  sections: readonly PurchasePolicySection[];
};

export const purchaseLinks = [
  { label: "Términos y condiciones", href: "/compras/terminos-y-condiciones" },
  { label: "Política de privacidad", href: "/compras/politica-de-privacidad" },
  { label: "Condiciones de compra", href: "/compras/condiciones-de-compra" },
  { label: "Envíos nacionales e internacionales", href: "/compras/envios" },
] as const;

export const purchasePolicies: Record<Locale, Record<"terms" | "privacy" | "purchase" | "shipping", PurchasePolicyContent>> = {
  es: {
    terms: {
      title: "Términos y condiciones",
      description: "Información sobre el uso del sitio de MateArte Uruguay.",
      introduction: "Información general sobre el uso del sitio y la presentación de las piezas MateArte.",
      sections: [
        { title: "Alcance", paragraphs: ["Este sitio presenta productos, trabajos personalizados y canales de contacto de MateArte Uruguay. Esta información describe el funcionamiento actual y no sustituye la confirmación de condiciones particulares antes de una compra."] },
        { title: "Información del catálogo", paragraphs: ["Las fotografías y descripciones procuran representar cada pieza con claridad. Al tratarse de productos artesanales, pueden existir variaciones propias de los materiales y del trabajo manual."], items: ["La publicación de una pieza no garantiza por sí sola disponibilidad inmediata.", "El precio y la posibilidad de compra se confirman mediante las opciones habilitadas en el sitio o por contacto directo.", "Las personalizaciones requieren revisión antes de ingresar a producción."] },
        { title: "Uso del sitio", paragraphs: ["El sitio debe utilizarse de forma lícita y sin interferir con su funcionamiento, seguridad o disponibilidad. No se autoriza la reproducción comercial de marcas, fotografías, diseños o textos sin permiso de sus titulares."] },
        { title: "Actualizaciones y contacto", paragraphs: ["MateArte puede corregir o actualizar la información del sitio. Las condiciones concretas de una operación serán las que se comuniquen y confirmen para ese pedido."] },
      ],
    },
    privacy: {
      title: "Política de privacidad",
      description: "Información sobre el tratamiento de datos en MateArte Uruguay.",
      introduction: "Un resumen de los datos que requiere el sitio y de los usos necesarios para brindar el servicio.",
      sections: [
        { title: "Datos que utiliza el sitio", items: ["Datos de cuenta y contacto, como nombre, correo y teléfono.", "Datos necesarios para entregar o coordinar un pedido, como dirección, departamento, país o ciudad.", "Información del carrito, pedidos, diseños personalizados y archivos que la persona decida cargar.", "Estados técnicos de pago y entrega necesarios para dar seguimiento a una compra."] },
        { title: "Para qué se utilizan", paragraphs: ["Los datos se utilizan para autenticar cuentas, guardar diseños, preparar pedidos, procesar o verificar pagos, coordinar entregas, responder consultas y enviar comunicaciones vinculadas con una operación."] },
        { title: "Servicios que participan", paragraphs: ["El funcionamiento actual utiliza proveedores tecnológicos para autenticación y almacenamiento, pagos y correos transaccionales. Entre ellos pueden encontrarse Supabase, Google cuando se elige ese acceso, Mercado Pago y Resend. Cada proveedor trata la información necesaria para prestar su servicio bajo sus propias condiciones."] },
        { title: "Seguridad, conservación y consultas", paragraphs: ["MateArte aplica controles técnicos de acceso y mantiene privados los archivos asociados a cuentas y pedidos. La información se conserva durante el tiempo necesario para operar el servicio, atender consultas y cumplir las obligaciones aplicables. Para solicitar acceso, corrección o eliminación de datos, la persona puede escribir a los canales de contacto indicados en esta página."] },
      ],
    },
    purchase: {
      title: "Condiciones de compra",
      description: "Información sobre pedidos y pagos en MateArte Uruguay.",
      introduction: "Cómo se validan los productos, el pago y las piezas personalizadas dentro del flujo actual.",
      sections: [
        { title: "Productos, precios y disponibilidad", paragraphs: ["Los precios habilitados para compra en Uruguay se expresan en pesos uruguayos. Antes de iniciar el pago, el sistema vuelve a comprobar los artículos, el stock, las personalizaciones, el envío y el total."] },
        { title: "Compras en Uruguay", items: ["El pago se gestiona mediante Mercado Pago cuando el comercio está habilitado.", "Un pedido se considera pagado únicamente cuando Mercado Pago confirma la operación al sitio.", "La reserva de stock asociada a un checkout pendiente vence a los 30 minutos.", "Las opciones de retiro o envío y su costo se muestran antes de ir al pago."] },
        { title: "Piezas personalizadas", paragraphs: ["Los diseños personalizados quedan sujetos a revisión. El pago no implica que una propuesta inviable pase automáticamente a producción; el equipo debe verificar que pueda fabricarse según la configuración solicitada."] },
        { title: "Cambios, cancelaciones y devoluciones", paragraphs: ["El sitio no establece plazos o condiciones generales para cambios, cancelaciones o devoluciones. Antes de confirmar una compra, esas condiciones deben consultarse con MateArte y quedar comunicadas para el pedido correspondiente."] },
      ],
    },
    shipping: {
      title: "Envíos nacionales e internacionales",
      description: "Información sobre entregas y coordinación internacional de MateArte Uruguay.",
      introduction: "Opciones de entrega dentro de Uruguay y coordinación personalizada para destinos del exterior.",
      sections: [
        { title: "Retiro y envíos dentro de Uruguay", paragraphs: ["Durante el checkout se muestran las modalidades activas para el destino indicado. Cuando corresponde, el costo se suma al pedido antes de iniciar el pago por Mercado Pago."], items: ["El retiro disponible se identifica expresamente como una opción sin costo.", "Las tarifas nacionales dependen de las modalidades y departamentos habilitados en el momento de la compra.", "Los plazos de preparación y entrega deben confirmarse para cada pedido."] },
        { title: "Envíos internacionales", paragraphs: ["Las compras con destino fuera de Uruguay se registran como una solicitud para revisión manual. El sitio prepara un mensaje de WhatsApp con el número de pedido, el destino, los artículos y el subtotal sin envío."], items: ["El costo de envío y la forma de pago se coordinan personalmente.", "La solicitud internacional no reserva stock hasta que MateArte confirme disponibilidad y condiciones.", "La producción o el despacho comienzan después de completar esa coordinación."] },
        { title: "Seguimiento", paragraphs: ["La información disponible del pedido puede consultarse desde la cuenta. Para detalles de preparación, transportista o entrega, se utilizan los canales de contacto de MateArte."] },
      ],
    },
  },
  en: {
    terms: {
      title: "Terms and conditions",
      description: "Information about using the MateArte Uruguay website.",
      introduction: "General information about using the website and how MateArte pieces are presented.",
      sections: [
        { title: "Scope", paragraphs: ["This website presents MateArte Uruguay products, custom work and contact channels. This information describes how the service currently operates and does not replace confirmation of specific terms before a purchase."] },
        { title: "Catalog information", paragraphs: ["Photographs and descriptions aim to represent each piece clearly. Because these are handcrafted products, natural variations in materials and manual work may occur."], items: ["Publishing a piece does not by itself guarantee immediate availability.", "Price and purchase availability are confirmed through enabled website options or direct contact.", "Customizations must be reviewed before entering production."] },
        { title: "Using the website", paragraphs: ["The website must be used lawfully and without interfering with its operation, security or availability. Commercial reproduction of trademarks, photographs, designs or text is not authorized without permission from their owners."] },
        { title: "Updates and contact", paragraphs: ["MateArte may correct or update information on the website. The specific terms of a transaction will be those communicated and confirmed for that order."] },
      ],
    },
    privacy: {
      title: "Privacy policy",
      description: "Information about data processing at MateArte Uruguay.",
      introduction: "A summary of the data the website requires and how it is used to provide the service.",
      sections: [
        { title: "Data used by the website", items: ["Account and contact data, such as name, email and telephone number.", "Information needed to deliver or coordinate an order, such as address, department, country or city.", "Cart, order, custom design and voluntarily uploaded file information.", "Technical payment and delivery statuses needed to track a purchase."] },
        { title: "How it is used", paragraphs: ["Data is used to authenticate accounts, save designs, prepare orders, process or verify payments, coordinate deliveries, answer inquiries and send communications related to a transaction."] },
        { title: "Services involved", paragraphs: ["The current service uses technology providers for authentication and storage, payments and transactional emails. These may include Supabase, Google when that sign-in method is chosen, Mercado Pago and Resend. Each provider processes the information needed to deliver its service under its own terms."] },
        { title: "Security, retention and inquiries", paragraphs: ["MateArte applies technical access controls and keeps files associated with accounts and orders private. Information is retained for as long as necessary to operate the service, answer inquiries and meet applicable obligations. To request access, correction or deletion of data, contact MateArte through the channels shown on this page."] },
      ],
    },
    purchase: {
      title: "Purchase terms",
      description: "Information about orders and payments at MateArte Uruguay.",
      introduction: "How products, payments and custom pieces are validated in the current purchase flow.",
      sections: [
        { title: "Products, prices and availability", paragraphs: ["Prices enabled for purchases in Uruguay are expressed in Uruguayan pesos. Before payment begins, the system rechecks items, stock, customizations, shipping and the total."] },
        { title: "Purchases in Uruguay", items: ["Payment is processed through Mercado Pago when commerce is enabled.", "An order is considered paid only after Mercado Pago confirms the transaction to the website.", "Stock reserved for a pending checkout expires after 30 minutes.", "Pickup or shipping options and their cost are shown before continuing to payment."] },
        { title: "Custom pieces", paragraphs: ["Custom designs are subject to review. Payment does not automatically move an unfeasible proposal into production; the team must verify that it can be made according to the requested configuration."] },
        { title: "Changes, cancellations and returns", paragraphs: ["The website does not establish general time frames or conditions for changes, cancellations or returns. Before confirming a purchase, these conditions must be discussed with MateArte and communicated for the relevant order."] },
      ],
    },
    shipping: {
      title: "Domestic and international shipping",
      description: "Information about deliveries and international coordination at MateArte Uruguay.",
      introduction: "Delivery options within Uruguay and personalized coordination for international destinations.",
      sections: [
        { title: "Pickup and shipping within Uruguay", paragraphs: ["During checkout, the active delivery methods for the specified destination are shown. When applicable, the cost is added to the order before Mercado Pago payment begins."], items: ["Available pickup is expressly identified as a free option.", "Domestic rates depend on the methods and departments enabled at the time of purchase.", "Preparation and delivery times must be confirmed for each order."] },
        { title: "International shipping", paragraphs: ["Purchases with a destination outside Uruguay are registered as requests for manual review. The website prepares a WhatsApp message with the order number, destination, items and subtotal excluding shipping."], items: ["Shipping cost and payment method are coordinated personally.", "An international request does not reserve stock until MateArte confirms availability and terms.", "Production or dispatch begins after that coordination is complete."] },
        { title: "Tracking", paragraphs: ["Available order information can be viewed from the account. MateArte's contact channels are used for preparation, carrier or delivery details."] },
      ],
    },
  },
  pt: {
    terms: {
      title: "Termos e condições",
      description: "Informações sobre o uso do site da MateArte Uruguai.",
      introduction: "Informações gerais sobre o uso do site e a apresentação das peças MateArte.",
      sections: [
        { title: "Escopo", paragraphs: ["Este site apresenta produtos, trabalhos personalizados e canais de contato da MateArte Uruguai. Estas informações descrevem o funcionamento atual e não substituem a confirmação de condições específicas antes de uma compra."] },
        { title: "Informações do catálogo", paragraphs: ["As fotografias e descrições procuram representar cada peça com clareza. Como são produtos artesanais, podem existir variações próprias dos materiais e do trabalho manual."], items: ["A publicação de uma peça não garante, por si só, disponibilidade imediata.", "O preço e a possibilidade de compra são confirmados pelas opções habilitadas no site ou por contato direto.", "As personalizações exigem revisão antes de entrar em produção."] },
        { title: "Uso do site", paragraphs: ["O site deve ser utilizado de forma lícita e sem interferir em seu funcionamento, segurança ou disponibilidade. Não é autorizada a reprodução comercial de marcas, fotografias, designs ou textos sem permissão de seus titulares."] },
        { title: "Atualizações e contato", paragraphs: ["A MateArte pode corrigir ou atualizar as informações do site. As condições concretas de uma operação serão aquelas comunicadas e confirmadas para o pedido."] },
      ],
    },
    privacy: {
      title: "Política de privacidade",
      description: "Informações sobre o tratamento de dados na MateArte Uruguai.",
      introduction: "Um resumo dos dados necessários para o site e dos usos necessários para prestar o serviço.",
      sections: [
        { title: "Dados utilizados pelo site", items: ["Dados de conta e contato, como nome, e-mail e telefone.", "Dados necessários para entregar ou coordenar um pedido, como endereço, departamento, país ou cidade.", "Informações do carrinho, pedidos, designs personalizados e arquivos que a pessoa decida enviar.", "Estados técnicos de pagamento e entrega necessários para acompanhar uma compra."] },
        { title: "Para que são utilizados", paragraphs: ["Os dados são utilizados para autenticar contas, salvar designs, preparar pedidos, processar ou verificar pagamentos, coordenar entregas, responder consultas e enviar comunicações relacionadas a uma operação."] },
        { title: "Serviços envolvidos", paragraphs: ["O funcionamento atual utiliza fornecedores de tecnologia para autenticação e armazenamento, pagamentos e e-mails transacionais. Entre eles podem estar Supabase, Google quando esse acesso é escolhido, Mercado Pago e Resend. Cada fornecedor trata as informações necessárias para prestar seu serviço segundo suas próprias condições."] },
        { title: "Segurança, conservação e consultas", paragraphs: ["A MateArte aplica controles técnicos de acesso e mantém privados os arquivos associados a contas e pedidos. As informações são conservadas durante o tempo necessário para operar o serviço, atender consultas e cumprir as obrigações aplicáveis. Para solicitar acesso, correção ou eliminação de dados, entre em contato pelos canais indicados nesta página."] },
      ],
    },
    purchase: {
      title: "Condições de compra",
      description: "Informações sobre pedidos e pagamentos na MateArte Uruguai.",
      introduction: "Como os produtos, o pagamento e as peças personalizadas são validados no fluxo atual.",
      sections: [
        { title: "Produtos, preços e disponibilidade", paragraphs: ["Os preços habilitados para compra no Uruguai são expressos em pesos uruguaios. Antes de iniciar o pagamento, o sistema verifica novamente os itens, o estoque, as personalizações, o envio e o total."] },
        { title: "Compras no Uruguai", items: ["O pagamento é processado pelo Mercado Pago quando o comércio está habilitado.", "Um pedido é considerado pago somente quando o Mercado Pago confirma a operação ao site.", "A reserva de estoque associada a um checkout pendente vence após 30 minutos.", "As opções de retirada ou envio e seu custo são exibidos antes de seguir para o pagamento."] },
        { title: "Peças personalizadas", paragraphs: ["Os designs personalizados estão sujeitos a revisão. O pagamento não significa que uma proposta inviável entre automaticamente em produção; a equipe deve verificar se ela pode ser fabricada segundo a configuração solicitada."] },
        { title: "Trocas, cancelamentos e devoluções", paragraphs: ["O site não estabelece prazos ou condições gerais para trocas, cancelamentos ou devoluções. Antes de confirmar uma compra, essas condições devem ser consultadas com a MateArte e comunicadas para o pedido correspondente."] },
      ],
    },
    shipping: {
      title: "Envios nacionais e internacionais",
      description: "Informações sobre entregas e coordenação internacional da MateArte Uruguai.",
      introduction: "Opções de entrega dentro do Uruguai e coordenação personalizada para destinos no exterior.",
      sections: [
        { title: "Retirada e envios dentro do Uruguai", paragraphs: ["Durante o checkout são exibidas as modalidades ativas para o destino informado. Quando aplicável, o custo é somado ao pedido antes de iniciar o pagamento pelo Mercado Pago."], items: ["A retirada disponível é identificada expressamente como uma opção sem custo.", "As tarifas nacionais dependem das modalidades e departamentos habilitados no momento da compra.", "Os prazos de preparação e entrega devem ser confirmados para cada pedido."] },
        { title: "Envios internacionais", paragraphs: ["As compras com destino fora do Uruguai são registradas como solicitações para revisão manual. O site prepara uma mensagem de WhatsApp com o número do pedido, o destino, os itens e o subtotal sem envio."], items: ["O custo de envio e a forma de pagamento são coordenados pessoalmente.", "A solicitação internacional não reserva estoque até que a MateArte confirme disponibilidade e condições.", "A produção ou o despacho começa depois de concluir essa coordenação."] },
        { title: "Acompanhamento", paragraphs: ["As informações disponíveis do pedido podem ser consultadas na conta. Para detalhes de preparação, transportadora ou entrega, são utilizados os canais de contato da MateArte."] },
      ],
    },
  },
};
