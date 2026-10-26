import type { Locale } from "@/types/catalog";

export type FaqEntry = { question: string; answer: string[] };
export type FaqPage = { title: string; description: string; introduction: string; entries: FaqEntry[] };

export const faqPages: Record<Locale, FaqPage> = {
  es: {
    title: "Preguntas frecuentes",
    description: "Cómo personalizar un mate online, la historia de MateArte, envíos y respuestas sobre mates, bombillas y cuidado del cuero.",
    introduction: "Respuestas sobre la personalización online, nuestra historia, los envíos y el cuidado de las piezas artesanales.",
    entries: [
      {
        question: "¿Cómo se cura un mate de calabaza?",
        answer: [
          "Llená el mate con yerba usada y húmeda, agregá agua caliente sin que hierva y dejalo reposar unas 24 horas.",
          "Al día siguiente vaciá el mate y raspá con cuidado la piel blanda del interior con una cuchara. Repetí el proceso dos o tres días y después dejalo secar boca abajo antes de usarlo.",
        ],
      },
      {
        question: "¿Hay que curar un mate de cerámica o de acero?",
        answer: ["No. Alcanza con enjuagarlo con agua caliente antes del primer uso."],
      },
      {
        question: "¿Qué diferencia hay entre un mate imperial, camionero, torpedo y criollo?",
        answer: [
          "Son modelos de mate, es decir, formas. Cada uno puede ser de calabaza, cerámica o cuero según la pieza; el material de cada mate figura en su ficha.",
          "El imperial lleva una virola ancha de metal trabajado y, en muchos modelos, pie de metal.",
          "El camionero es un mate grande, de boca ancha y base firme.",
          "El torpedo tiene forma alargada y boca más angosta.",
          "El criollo tiene la forma tradicional, más redondeada.",
        ],
      },
      {
        question: "¿Bombilla de alpaca o de acero inoxidable?",
        answer: [
          "La alpaca es la aleación tradicional de la bombilla uruguaya y permite cincelados y terminaciones decorativas; con el uso puede oscurecerse y se limpia con agua caliente y un cepillo.",
          "El acero inoxidable no se oscurece y pide menos cuidado.",
        ],
      },
      {
        question: "¿Cómo se limpia y se guarda el mate?",
        answer: [
          "Después de cada uso vaciá la yerba, enjuagá el mate con agua y dejalo secar boca abajo en un lugar ventilado. No lo guardes húmedo ni lo laves con detergente, porque toma el olor.",
        ],
      },
      {
        question: "¿Cómo se cuida el cuero de materas, cintos y billeteras?",
        answer: [
          "Limpialo con un paño seco o apenas húmedo y dejalo secar a la sombra. Cada tanto podés aplicar una crema o grasa para cuero. Evitá el sol directo y las fuentes de calor.",
        ],
      },
      {
        question: "¿Se puede personalizar un mate?",
        answer: [
          "Sí. En el personalizador elegís el mate y agregás nombres, escudos o diseños grabados o aplicados en la virola y el fleje. MateArte revisa cada diseño antes de producirlo.",
        ],
      },
      {
        question: "¿Cómo funciona el personalizador de mates online?",
        answer: [
          "Elegís el modelo y las terminaciones disponibles, agregás nombres, escudos o diseños y visualizás el resultado mientras lo armás. Al hacer el pedido, MateArte revisa los detalles antes de producir la pieza.",
        ],
      },
      {
        question: "¿El mate que veo en pantalla será exactamente igual al terminado?",
        answer: [
          "La vista online te ayuda a elegir y revisar tu diseño. Cada mate se termina de forma artesanal; los tonos y pequeños detalles pueden variar. MateArte confirma que la combinación elegida pueda realizarse antes de producirla.",
        ],
      },
      {
        question: "¿Hace cuánto se dedican a hacer mates?",
        answer: [
          "La familia Ortiz lleva más de 30 años trabajando el oficio en Paysandú. La marca MateArte nació en 2019, al renovar la identidad de ese trabajo familiar.",
        ],
      },
      {
        question: "¿Hacen envíos fuera de Uruguay?",
        answer: [
          "Sí. Los pedidos internacionales se registran en la tienda y nuestro equipo coordina por WhatsApp el envío y la forma de pago según el destino.",
        ],
      },
    ],
  },
  en: {
    title: "Frequently asked questions",
    description: "How to customize a mate online, MateArte's history, shipping, mate gourds, bombillas and leather care.",
    introduction: "Answers about online customization, our history, shipping and caring for handmade pieces.",
    entries: [
      {
        question: "How do you cure a gourd mate?",
        answer: [
          "Fill the mate with used, damp yerba, add hot water that is not boiling and let it rest for about 24 hours.",
          "The next day empty it and gently scrape the soft skin inside with a spoon. Repeat for two or three days, then let it dry upside down before using it.",
        ],
      },
      {
        question: "Do ceramic or steel mates need curing?",
        answer: ["No. Rinsing them with hot water before the first use is enough."],
      },
      {
        question: "What is the difference between imperial, camionero, torpedo and criollo mates?",
        answer: [
          "They are mate models, that is, shapes. Each one can be made of gourd, ceramic or leather depending on the piece; the material of each mate is listed on its page.",
          "The imperial has a wide worked metal rim and, in many models, a metal base.",
          "The camionero is a large mate with a wide mouth and a steady base.",
          "The torpedo has an elongated shape and a narrower mouth.",
          "The criollo has the traditional, rounder shape.",
        ],
      },
      {
        question: "Alpaca or stainless steel bombilla?",
        answer: [
          "Alpaca is the traditional alloy of the Uruguayan bombilla and allows chiseled and decorative finishes; it can darken with use and is cleaned with hot water and a brush.",
          "Stainless steel does not darken and needs less care.",
        ],
      },
      {
        question: "How do you clean and store a mate?",
        answer: [
          "After each use, empty the yerba, rinse the mate with water and let it dry upside down in a ventilated place. Do not store it wet or wash it with detergent, as it absorbs the smell.",
        ],
      },
      {
        question: "How do you care for leather bags, belts and wallets?",
        answer: [
          "Clean it with a dry or slightly damp cloth and let it dry in the shade. From time to time you can apply a leather cream or balm. Avoid direct sun and heat sources.",
        ],
      },
      {
        question: "Can a mate be personalized?",
        answer: [
          "Yes. In the personalization tool you choose the mate and add names, crests or designs engraved or applied on the rim and band. MateArte reviews every design before production.",
        ],
      },
      {
        question: "How does the online mate personalizer work?",
        answer: [
          "Choose a model and available finishes, add names, crests or designs, and preview the result as you build it. After you order, MateArte reviews the details before making the piece.",
        ],
      },
      {
        question: "Will the finished mate look exactly like the on-screen preview?",
        answer: [
          "The online preview helps you choose and review your design. Each mate is finished by hand, so tones and small details may vary. MateArte confirms that the chosen combination can be made before production.",
        ],
      },
      {
        question: "How long has MateArte been making mates?",
        answer: [
          "The Ortiz family has practiced the craft in Paysandú for more than 30 years. The MateArte brand was born in 2019, when that family craft took on a renewed identity.",
        ],
      },
      {
        question: "Do you ship outside Uruguay?",
        answer: [
          "Yes. International orders are registered in the store, and our team coordinates shipping and payment by WhatsApp according to the destination.",
        ],
      },
    ],
  },
  pt: {
    title: "Perguntas frequentes",
    description: "Como personalizar uma cuia online, a história da MateArte, envios, cuias, bombas e cuidados com o couro.",
    introduction: "Respostas sobre personalização online, nossa história, envios e cuidados com peças artesanais.",
    entries: [
      {
        question: "Como se cura uma cuia de cabaça?",
        answer: [
          "Encha a cuia com erva usada e úmida, acrescente água quente sem ferver e deixe descansar cerca de 24 horas.",
          "No dia seguinte esvazie a cuia e raspe com cuidado a película macia do interior com uma colher. Repita por dois ou três dias e depois deixe secar de boca para baixo antes de usar.",
        ],
      },
      {
        question: "É preciso curar uma cuia de cerâmica ou de aço?",
        answer: ["Não. Basta enxaguar com água quente antes do primeiro uso."],
      },
      {
        question: "Qual é a diferença entre as cuias imperial, camionero, torpedo e criollo?",
        answer: [
          "São modelos de cuia, ou seja, formatos. Cada um pode ser de cabaça, cerâmica ou couro conforme a peça; o material de cada cuia aparece na sua página.",
          "A imperial tem uma virola larga de metal trabalhado e, em muitos modelos, pé de metal.",
          "A camionero é uma cuia grande, de boca larga e base firme.",
          "A torpedo tem formato alongado e boca mais estreita.",
          "A criollo tem o formato tradicional, mais arredondado.",
        ],
      },
      {
        question: "Bomba de alpaca ou de aço inoxidável?",
        answer: [
          "A alpaca é a liga tradicional da bomba uruguaia e permite cinzelados e acabamentos decorativos; com o uso pode escurecer e se limpa com água quente e uma escova.",
          "O aço inoxidável não escurece e exige menos cuidado.",
        ],
      },
      {
        question: "Como limpar e guardar a cuia?",
        answer: [
          "Depois de cada uso esvazie a erva, enxágue a cuia com água e deixe secar de boca para baixo em um lugar ventilado. Não a guarde úmida nem lave com detergente, porque ela absorve o cheiro.",
        ],
      },
      {
        question: "Como cuidar do couro de mateiras, cintos e carteiras?",
        answer: [
          "Limpe com um pano seco ou levemente úmido e deixe secar à sombra. De vez em quando você pode aplicar um creme ou graxa para couro. Evite sol direto e fontes de calor.",
        ],
      },
      {
        question: "É possível personalizar uma cuia?",
        answer: [
          "Sim. No personalizador você escolhe a cuia e acrescenta nomes, escudos ou desenhos gravados ou aplicados na virola e na faixa. A MateArte revisa cada desenho antes da produção.",
        ],
      },
      {
        question: "Como funciona o personalizador de cuias online?",
        answer: [
          "Escolha o modelo e os acabamentos disponíveis, acrescente nomes, escudos ou desenhos e visualize o resultado enquanto cria. Após o pedido, a MateArte revisa os detalhes antes de produzir a peça.",
        ],
      },
      {
        question: "A cuia pronta será exatamente igual à visualização na tela?",
        answer: [
          "A visualização online ajuda você a escolher e revisar seu design. Cada cuia recebe acabamento artesanal; tons e pequenos detalhes podem variar. A MateArte confirma a viabilidade da combinação escolhida antes da produção.",
        ],
      },
      {
        question: "Há quanto tempo a MateArte faz cuias?",
        answer: [
          "A família Ortiz trabalha nesse ofício em Paysandú há mais de 30 anos. A marca MateArte nasceu em 2019, quando esse trabalho familiar ganhou uma identidade renovada.",
        ],
      },
      {
        question: "Vocês enviam para fora do Uruguai?",
        answer: [
          "Sim. Os pedidos internacionais são registrados na loja, e nossa equipe coordena pelo WhatsApp o envio e a forma de pagamento conforme o destino.",
        ],
      },
    ],
  },
};
