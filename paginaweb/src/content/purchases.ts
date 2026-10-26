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
        { title: "Actualizaciones y contacto", paragraphs: ["MateArte puede corregir o actualizar la información del sitio. Los detalles de cada pedido se comunican y confirman con la persona compradora, respetando las condiciones de compra publicadas y sus derechos legales."] },
      ],
    },
    privacy: {
      title: "Política de privacidad",
      description: "Información sobre el tratamiento de datos en MateArte Uruguay.",
      introduction: "Un resumen de los datos que requiere el sitio y de los usos necesarios para brindar el servicio.",
      sections: [
        { title: "Datos que utiliza el sitio", items: ["Datos de cuenta y contacto, como nombre, correo y teléfono.", "Preferencias de productos, ciudad, país y fecha de nacimiento aportados para participar en campañas o sorteos.", "Datos necesarios para entregar o coordinar un pedido, como dirección, departamento, país o ciudad.", "Información del carrito, pedidos, diseños personalizados y archivos que la persona decida cargar.", "Estados técnicos de pago y entrega necesarios para dar seguimiento a una compra."] },
        { title: "Para qué se utilizan", paragraphs: ["Los datos se utilizan para autenticar cuentas, guardar diseños, preparar pedidos, procesar o verificar pagos, coordinar entregas, responder consultas, gestionar campañas o sorteos y enviar comunicaciones vinculadas con una operación. Las novedades comerciales se envían únicamente cuando la persona las acepta de forma separada."] },
        { title: "Servicios que participan", paragraphs: ["El funcionamiento actual utiliza proveedores tecnológicos para autenticación y almacenamiento, pagos y correos transaccionales. Entre ellos pueden encontrarse Supabase, Google cuando se elige ese acceso, Mercado Pago y Resend. Cada proveedor trata la información necesaria para prestar su servicio bajo sus propias condiciones.", "Específicamente sobre el uso de Google como método de inicio de sesión: la aplicación únicamente solicita acceso al perfil básico (nombre, dirección de correo electrónico e imagen de perfil). Estos datos se utilizan exclusivamente para crear y vincular la cuenta en nuestro sistema, permitiendo gestionar los pedidos y contactar al cliente sobre sus compras. MateArte no comparte esta información con terceros ajenos al servicio ni la utiliza para otros fines comerciales o publicitarios sin consentimiento expreso."] },
        { title: "Seguridad, conservación y consultas", paragraphs: ["MateArte aplica controles técnicos de acceso y mantiene privados los archivos asociados a cuentas y pedidos. La información se conserva durante el tiempo necesario para operar el servicio, atender consultas y cumplir las obligaciones aplicables. Para solicitar acceso, corrección o eliminación de datos, la persona puede escribir a los canales de contacto indicados en esta página."] },
      ],
    },
    purchase: {
      title: "Condiciones de compra",
      description: "Pagos, envíos, cambios, arrepentimiento y devoluciones de compras en MateArte Uruguay.",
      introduction: "Conocé cómo se pagan y entregan los pedidos, y qué opciones tenés para cambiar, cancelar o devolver una compra.",
      sections: [
        { title: "Productos, precios y disponibilidad", paragraphs: ["Los precios habilitados para compra en Uruguay se expresan en pesos uruguayos. Antes de iniciar el pago, el sistema vuelve a comprobar los artículos, las personalizaciones y el total a pagar en línea."] },
        { title: "Compras en Uruguay", items: ["El pago se gestiona mediante Mercado Pago cuando el comercio está habilitado.", "Un pedido se guarda y se considera pagado únicamente cuando Mercado Pago confirma la operación al sitio.", "El envío se paga a la agencia al recibir el pedido. Su costo real depende del destino y del peso; no está incluido en el pago en línea."] },
        { title: "Piezas personalizadas", paragraphs: ["Los diseños personalizados quedan sujetos a revisión. El pago no implica que una propuesta inviable pase automáticamente a producción; el equipo debe verificar que pueda fabricarse según la configuración solicitada."] },
        { title: "Arrepentimiento de compras web", paragraphs: ["Si compraste un producto común por esta web, podés dejar sin efecto la compra dentro de los 5 días hábiles contados, a tu elección, desde la compra o desde la entrega. Comunicanos tu decisión por un medio que deje constancia, indicando el número de pedido. Devolvé el producto sin uso y en el estado en que lo recibiste; podés abrirlo para comprobarlo. Cada parte asume el costo de devolver lo que recibió y MateArte restituye de inmediato los importes pagados conforme a la ley.", "Este derecho de arrepentimiento no se aplica a piezas confeccionadas según tus especificaciones o claramente personalizadas. Esto no limita la atención de fallas ni de diferencias con el pedido."] },
        { title: "Cambios voluntarios", paragraphs: ["Para productos comunes, aceptamos solicitudes de cambio dentro de los 10 días corridos desde la entrega, siempre que la pieza esté sin uso y en el estado en que fue recibida. Escribinos con el número de pedido para coordinar la devolución y elegir otra pieza disponible. El transporte del cambio voluntario corre por cuenta del comprador, salvo acuerdo distinto. Este cambio es adicional al derecho legal de arrepentimiento."] },
        { title: "Pedidos personalizados y problemas con una pieza", paragraphs: ["Podés pedir cambios en el diseño o cancelar un pedido personalizado antes de aprobar el diseño para fabricación. Contactanos cuanto antes con el número de pedido; si ya pagaste y cancelás antes de esa aprobación, coordinaremos el reintegro. Después de aprobarlo, no se admiten cambios o cancelaciones por preferencia personal.", "Si una pieza, incluso personalizada, llega con una falla o no coincide con el pedido aprobado, contactanos con el número de pedido y fotos del problema para resolverlo según corresponda. Los derechos legales por falta de conformidad se mantienen."] },
        { title: "Cómo contactarnos", paragraphs: ["Para arrepentimiento, cambios o reclamos escribí a matearte.ventas@gmail.com o al WhatsApp +598 91 674 231. También podés acercarte a 25 de Mayo 1734, Paysandú, Uruguay. Indicá tu número de pedido y cómo preferís que te respondamos."] },
      ],
    },
    shipping: {
      title: "Envíos nacionales e internacionales",
      description: "Información sobre entregas y coordinación internacional de MateArte Uruguay.",
      introduction: "Opciones de entrega dentro de Uruguay y coordinación personalizada para destinos del exterior.",
      sections: [
        { title: "Retiro y envíos dentro de Uruguay", paragraphs: ["Durante el checkout se muestran las modalidades activas para el destino indicado. Si elegís envío, pagás a la agencia al recibir el pedido. Se cobra el costo real de la entrega, que varía según el destino y el peso; no se suma al pago en línea y no hay una tarifa única publicada."], items: ["El retiro disponible se identifica expresamente como una opción sin costo.", "El importe de la entrega nacional depende de lo que cobre la agencia de transporte.", "Los plazos de preparación y entrega deben confirmarse para cada pedido."] },
        { title: "Envíos internacionales", paragraphs: ["Las compras con destino fuera de Uruguay se registran como una solicitud para revisión manual. El sitio prepara un mensaje de WhatsApp con el número de pedido, el destino, los artículos y el subtotal sin envío."], items: ["El costo de envío y la forma de pago se coordinan personalmente.", "La producción o el despacho comienzan después de completar esa coordinación."] },
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
        { title: "Updates and contact", paragraphs: ["MateArte may correct or update information on the website. Details of each order are communicated and confirmed with the buyer, while respecting the published purchase terms and their legal rights."] },
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
      description: "Payments, shipping, exchanges, withdrawal and returns for MateArte Uruguay purchases.",
      introduction: "How orders are paid and delivered, and your options to exchange, cancel or return a purchase.",
      sections: [
        { title: "Products, prices and availability", paragraphs: ["Prices enabled for purchases in Uruguay are expressed in Uruguayan pesos. Before payment begins, the system rechecks items, customizations and the total to be paid online."] },
        { title: "Purchases in Uruguay", items: ["Payment is processed through Mercado Pago when commerce is enabled.", "An order is saved and considered paid only after Mercado Pago confirms the transaction to the website.", "Shipping is paid to the carrier upon delivery. Its actual cost depends on destination and weight; it is not included in the online payment."] },
        { title: "Custom pieces", paragraphs: ["Custom designs are subject to review. Payment does not automatically move an unfeasible proposal into production; the team must verify that it can be made according to the requested configuration."] },
        { title: "Withdrawal from online purchases", paragraphs: ["If you bought a standard product through this website, you may withdraw within 5 business days counted, at your choice, from the purchase or delivery. Tell us through a channel that provides a record and include your order number. Return the item unused and in the condition received; you may open it to inspect it. Each party pays the cost of returning what it received, and MateArte promptly refunds the amounts paid as required by law.", "This withdrawal right does not apply to items made to your specifications or clearly personalized. Defects and differences from the order are still covered."] },
        { title: "Voluntary exchanges", paragraphs: ["For standard products, request an exchange within 10 calendar days of delivery if the item is unused and in the condition received. Contact us with your order number to arrange the return and select another available item. The buyer pays transport for a voluntary exchange unless otherwise agreed. This exchange is in addition to the legal withdrawal right."] },
        { title: "Custom orders and problems with an item", paragraphs: ["You may request design changes or cancel a custom order before approving the design for production. Contact us promptly with your order number; if you have already paid and cancel before approval, we will arrange a refund. After approval, changes or cancellations based on personal preference are not accepted.", "If any item, including a custom one, arrives defective or differs from the approved order, contact us with your order number and photos so we can resolve it as appropriate. Your legal rights for nonconforming goods remain in effect."] },
        { title: "How to contact us", paragraphs: ["For withdrawal, exchanges or claims, email matearte.ventas@gmail.com or WhatsApp +598 91 674 231. You can also visit 25 de Mayo 1734, Paysandú, Uruguay. Include your order number and preferred way to receive a response."] },
      ],
    },
    shipping: {
      title: "Domestic and international shipping",
      description: "Information about deliveries and international coordination at MateArte Uruguay.",
      introduction: "Delivery options within Uruguay and personalized coordination for international destinations.",
      sections: [
        { title: "Pickup and shipping within Uruguay", paragraphs: ["Checkout shows the delivery methods available for your destination. If you choose shipping, you pay the carrier upon delivery. The actual charge varies by destination and weight; it is not added to the online payment and there is no single published rate."], items: ["Available pickup is expressly identified as a free option.", "The domestic delivery charge depends on the carrier's rate.", "Preparation and delivery times must be confirmed for each order."] },
        { title: "International shipping", paragraphs: ["Purchases with a destination outside Uruguay are registered as requests for manual review. The website prepares a WhatsApp message with the order number, destination, items and subtotal excluding shipping."], items: ["Shipping cost and payment method are coordinated personally.", "Production or dispatch begins after that coordination is complete."] },
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
        { title: "Atualizações e contato", paragraphs: ["A MateArte pode corrigir ou atualizar as informações do site. Os detalhes de cada pedido são comunicados e confirmados com o comprador, respeitando as condições de compra publicadas e seus direitos legais."] },
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
      description: "Pagamentos, envios, trocas, arrependimento e devoluções de compras na MateArte Uruguai.",
      introduction: "Como os pedidos são pagos e entregues e quais são as opções para trocar, cancelar ou devolver uma compra.",
      sections: [
        { title: "Produtos, preços e disponibilidade", paragraphs: ["Os preços habilitados para compra no Uruguai são expressos em pesos uruguaios. Antes de iniciar o pagamento, o sistema verifica novamente os itens, as personalizações e o total a pagar online."] },
        { title: "Compras no Uruguai", items: ["O pagamento é processado pelo Mercado Pago quando o comércio está habilitado.", "Um pedido é salvo e considerado pago somente quando o Mercado Pago confirma a operação ao site.", "O frete é pago à transportadora no recebimento. O custo real depende do destino e do peso; não está incluído no pagamento online."] },
        { title: "Peças personalizadas", paragraphs: ["Os designs personalizados estão sujeitos a revisão. O pagamento não significa que uma proposta inviável entre automaticamente em produção; a equipe deve verificar se ela pode ser fabricada segundo a configuração solicitada."] },
        { title: "Arrependimento de compras online", paragraphs: ["Se você comprou um produto comum por este site, pode desistir da compra em até 5 dias úteis contados, à sua escolha, da compra ou da entrega. Avise-nos por um meio que deixe registro e informe o número do pedido. Devolva o produto sem uso e no estado em que o recebeu; você pode abri-lo para conferir. Cada parte assume o custo de devolver o que recebeu, e a MateArte restitui imediatamente os valores pagos conforme a lei.", "Esse direito de arrependimento não se aplica a peças feitas conforme suas especificações ou claramente personalizadas. Isso não limita o atendimento de defeitos ou diferenças em relação ao pedido."] },
        { title: "Trocas voluntárias", paragraphs: ["Para produtos comuns, aceitamos pedidos de troca em até 10 dias corridos após a entrega, desde que a peça esteja sem uso e no estado em que foi recebida. Entre em contato com o número do pedido para combinar a devolução e escolher outra peça disponível. O transporte da troca voluntária é pago pelo comprador, salvo acordo diferente. Esta troca é adicional ao direito legal de arrependimento."] },
        { title: "Pedidos personalizados e problemas com uma peça", paragraphs: ["Você pode pedir alterações no design ou cancelar um pedido personalizado antes de aprovar o design para fabricação. Entre em contato quanto antes com o número do pedido; se já pagou e cancelar antes dessa aprovação, combinaremos o reembolso. Após a aprovação, não são aceitas alterações ou cancelamentos por preferência pessoal.", "Se uma peça, inclusive personalizada, chegar com defeito ou diferente do pedido aprovado, entre em contato com o número do pedido e fotos do problema para que possamos resolver a situação. Seus direitos legais relativos a produtos não conformes continuam válidos."] },
        { title: "Como entrar em contato", paragraphs: ["Para arrependimento, trocas ou reclamações, escreva para matearte.ventas@gmail.com ou pelo WhatsApp +598 91 674 231. Você também pode ir até 25 de Mayo 1734, Paysandú, Uruguai. Informe o número do pedido e como prefere receber a resposta."] },
      ],
    },
    shipping: {
      title: "Envios nacionais e internacionais",
      description: "Informações sobre entregas e coordenação internacional da MateArte Uruguai.",
      introduction: "Opções de entrega dentro do Uruguai e coordenação personalizada para destinos no exterior.",
      sections: [
        { title: "Retirada e envios dentro do Uruguai", paragraphs: ["Durante o checkout são exibidas as modalidades disponíveis para o destino informado. Se você escolher o envio, paga à transportadora no recebimento. O custo real varia conforme o destino e o peso; não é somado ao pagamento online e não há uma tarifa única publicada."], items: ["A retirada disponível é identificada expressamente como uma opção sem custo.", "O valor da entrega nacional depende da tarifa da transportadora.", "Os prazos de preparação e entrega devem ser confirmados para cada pedido."] },
        { title: "Envios internacionais", paragraphs: ["As compras com destino fora do Uruguai são registradas como solicitações para revisão manual. O site prepara uma mensagem de WhatsApp com o número do pedido, o destino, os itens e o subtotal sem envio."], items: ["O custo de envio e a forma de pagamento são coordenados pessoalmente.", "A produção ou o despacho começa depois de concluir essa coordenação."] },
        { title: "Acompanhamento", paragraphs: ["As informações disponíveis do pedido podem ser consultadas na conta. Para detalhes de preparação, transportadora ou entrega, são utilizados os canais de contato da MateArte."] },
      ],
    },
  },
};
