// Generado por scripts/generar-guias.mjs desde marketing/guias/*.md. No editar a mano: editar los .md.

export type BloqueGuia =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; items: string[] }
  | { tipo: "tabla"; encabezado: string[]; filas: string[][] };

export type IdiomaGuia = "es" | "en" | "pt";

export type Guia = {
  /** Igual en los tres idiomas: une cada guía con sus traducciones. */
  id: string;
  slug: string;
  titulo: string;
  tituloSeo: string;
  descripcion: string;
  intro: string[];
  secciones: { titulo: string; bloques: BloqueGuia[] }[];
  faq: { pregunta: string; respuesta: string }[];
  seguir: string[];
};

export const guias: Record<IdiomaGuia, Guia[]> = {
  "es": [
    {
      "id": "1",
      "slug": "como-curar-un-mate",
      "titulo": "Cómo curar un mate de calabaza",
      "tituloSeo": "Cómo curar un mate de calabaza, paso a paso",
      "descripcion": "Cómo curar un mate de calabaza nuevo en tres días, qué errores evitar y cómo cuidarlo después. Los de cerámica y acero no se curan.",
      "intro": [
        "Un mate de calabaza nuevo se cura antes de usarlo: se llena con yerba usada y húmeda, se le agrega agua caliente sin que hierva y se deja reposar unas 24 horas. Al otro día se vacía y se raspa la piel blanda de adentro. Se repite dos o tres días y listo.",
        "Los mates de cerámica o de acero no se curan. Alcanza con enjuagarlos con agua caliente."
      ],
      "secciones": [
        {
          "titulo": "Para qué se cura",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "La calabaza es un material vivo. Por dentro tiene una capa blanda que, si no se trabaja, le da al primer mate un gusto amargo y raro, y se puede llegar a rajar o a llenar de hongos. Curarla le saca esa capa, la asienta y deja la pared lista para recibir la yerba todos los días."
            }
          ]
        },
        {
          "titulo": "Paso a paso",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": true,
              "items": [
                "**Llenalo con yerba usada y húmeda.** Hasta arriba, apretada sin exagerar.",
                "**Agregale agua caliente, sin que hierva.** La misma que usarías para tomar.",
                "**Dejalo reposar unas 24 horas.** En un lugar fresco, no al sol.",
                "**Vacialo y raspá la piel blanda** con una cuchara, con cuidado de no lastimar la virola ni el cuero.",
                "**Repetí el proceso dos o tres días.**",
                "**Dejalo secar boca abajo** en un lugar ventilado antes del primer mate."
              ]
            }
          ]
        },
        {
          "titulo": "Errores comunes",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Usar agua hirviendo:** quema la calabaza y la puede rajar.",
                "**Dejarlo húmedo después de usarlo:** es lo que más hongos genera. Siempre vacío y boca abajo.",
                "**Lavarlo con detergente:** se queda con el gusto. Con agua alcanza.",
                "**Raspar con algo filoso:** la cuchara es suficiente."
              ]
            }
          ]
        },
        {
          "titulo": "Cómo se cuida después",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Después de cada mate, vacialo, enjuagalo con agua y dejalo secar boca abajo en un lugar ventilado, sin detergente. Si el mate es de cuero, el cuero tiene su propio cuidado: lo contamos en [cómo cuidar el cuero de tu mate y tu matera](/guias/cuidado-del-cuero)."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "¿Cuánto tarda en curarse un mate?",
          "respuesta": "Dos o tres días, repitiendo el proceso de la yerba húmeda cada 24 horas."
        },
        {
          "pregunta": "¿Se curan los mates de cerámica o de acero?",
          "respuesta": "No. Con un enjuague de agua caliente ya se pueden usar."
        },
        {
          "pregunta": "¿Qué hago si le aparece una mancha de hongo?",
          "respuesta": "Escribinos por WhatsApp con una foto y te decimos cómo seguir."
        }
      ],
      "seguir": [
        "Mates de calabaza de MateArte, hechos a mano en Paysandú: [ver mates](/catalogo/mates).",
        "Si recién empezás, un kit trae todo junto: [kits materos](/catalogo/kits-materos).",
        "¿No sabés qué modelo elegir? [Qué mate elegir](/guias/que-mate-elegir)."
      ]
    },
    {
      "id": "2",
      "slug": "que-mate-elegir",
      "titulo": "Qué mate elegir: imperial, criollo, torpedo, camionero o estribo",
      "tituloSeo": "Qué mate elegir: imperial, criollo, torpedo, camionero o estribo",
      "descripcion": "Las diferencias entre el mate imperial, criollo, torpedo, camionero y la colección estribo, para quién es cada uno y cómo personalizarlo.",
      "intro": [
        "Depende de cómo tomás y de para quién es. El **imperial** lleva una virola ancha de metal trabajado y muchas veces pie de metal. El **camionero** es grande, de boca ancha y base firme. El **torpedo** es alargado y de boca más angosta. El **criollo** tiene la forma tradicional, más redondeada. Y la **colección estribo** son mates de calabaza sin cuero, con la virola original de cada modelo."
      ],
      "secciones": [
        {
          "titulo": "Imperial",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Es el más vistoso: la virola ancha de metal trabajado es la que lo distingue, y muchas veces lleva pie de metal. Es un regalo que se nota."
            },
            {
              "tipo": "parrafo",
              "texto": "Este modelo tiene historia en casa. Empezó en un viaje de Richard a Rivera, donde una boquilla de metal trabajada a mano le dio la idea. El diseño gustó antes de tener nombre, hasta que alguien propuso «Mate Imperial». Hoy es uno de los mates de cuero y calabaza más reconocidos."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quién:** quien quiere un mate que llame la atención, o un regalo especial. Es el que más se personaliza en la virola."
            }
          ]
        },
        {
          "titulo": "Camionero",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Grande, de boca ancha y base firme. Entra más yerba y se ceba cómodo."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quién:** el que toma mucho y en serio, en la oficina, en la ruta o en casa."
            }
          ]
        },
        {
          "titulo": "Torpedo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Alargado y de boca más angosta. Se agarra con una mano y es práctico para llevar."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quién:** quien prefiere un mate más fino, de cebada corta."
            }
          ]
        },
        {
          "titulo": "Criollo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "La forma tradicional, más redondeada. En el personalizador hay criollos con silueta de torpedo, de imperial y de camionero, con posamate."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quién:** quien busca el mate de siempre, con terminación de cuero."
            }
          ]
        },
        {
          "titulo": "Colección estribo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Mates de calabaza sin cuero, con la virola original del imperial, del torpedo o del camionero."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quién:** quien prefiere ver la calabaza al natural."
            }
          ]
        },
        {
          "titulo": "Cómo elegir rápido",
          "bloques": [
            {
              "tipo": "tabla",
              "encabezado": [
                "Si buscás…",
                "Elegí"
              ],
              "filas": [
                [
                  "Un regalo que se note",
                  "Imperial"
                ],
                [
                  "Tomar mucho y cómodo",
                  "Camionero"
                ],
                [
                  "Algo fino y práctico",
                  "Torpedo"
                ],
                [
                  "La forma de siempre",
                  "Criollo"
                ],
                [
                  "La calabaza a la vista",
                  "Estribo"
                ]
              ]
            }
          ]
        },
        {
          "titulo": "Personalizarlo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Cualquiera de estos modelos se puede personalizar con nombres, iniciales, escudos o diseños, en la virola y, según el modelo, en el fleje: con grabado láser o con apliques de bronce o alpaca. En el [personalizador](https://personalizador.matearteuruguay.com) elegís el mate, agregás lo que quieras y ves cómo queda y cuánto sale antes de pedirlo. Antes de producirlo, revisamos cada diseño."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "¿Cuál es la diferencia entre el mate imperial y el camionero?",
          "respuesta": "El imperial se distingue por la virola ancha de metal trabajado; el camionero, por su tamaño grande y la boca ancha."
        },
        {
          "pregunta": "¿Qué mate conviene para regalar?",
          "respuesta": "El imperial es el más vistoso, y personalizado con nombre o escudo es un regalo que se recuerda."
        },
        {
          "pregunta": "¿Puedo ver cómo queda antes de comprarlo?",
          "respuesta": "Sí: en el personalizador ves el diseño y el precio antes de pedirlo."
        }
      ],
      "seguir": [
        "[Armá tu mate en el personalizador](https://personalizador.matearteuruguay.com).",
        "[Ver todos los mates](/catalogo/mates).",
        "[Cómo curar un mate de calabaza](/guias/como-curar-un-mate)."
      ]
    },
    {
      "id": "3",
      "slug": "cuidado-del-cuero",
      "titulo": "Cómo cuidar el cuero de tu mate y tu matera",
      "tituloSeo": "Cómo cuidar el cuero de tu mate y tu matera",
      "descripcion": "Cómo limpiar e hidratar el cuero de tu mate, tu matera o tus artículos de cuero para que duren años, y qué evitar.",
      "intro": [
        "El cuero se limpia con un paño seco o apenas húmedo, se seca a la sombra y cada tanto se hidrata con crema o grasa para cuero. Lo que más lo castiga es el sol directo y el calor."
      ],
      "secciones": [
        {
          "titulo": "Limpieza de todos los días",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Pasale un paño seco, o apenas húmedo si tiene polvo o alguna marca. No lo mojes de más ni lo sumerjas: el agua en exceso lo endurece y lo mancha."
            },
            {
              "tipo": "parrafo",
              "texto": "Si se mojó, dejalo secar a la sombra, nunca al sol ni cerca de una estufa."
            }
          ]
        },
        {
          "titulo": "Hidratación",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Cada tanto, poné un poco de crema o grasa para cuero con un paño, en capas finas, y dejá que se absorba. Le devuelve la flexibilidad y lo protege. En un mate que usás todos los días, se nota."
            }
          ]
        },
        {
          "titulo": "Qué evitar",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Sol directo y calor:** resecan el cuero y lo agrietan. No lo dejes en el auto al sol.",
                "**Mucha agua:** endurece y mancha.",
                "**Productos de limpieza comunes:** con un paño y crema para cuero alcanza."
              ]
            }
          ]
        },
        {
          "titulo": "El mate: cuero por fuera, calabaza por dentro",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "En un mate forrado en cuero conviven dos cuidados: el del cuero, que es este, y el de la calabaza (vaciarlo, enjuagarlo y dejarlo secar boca abajo). Lo contamos en [cómo curar un mate](/guias/como-curar-un-mate)."
            }
          ]
        },
        {
          "titulo": "Por qué dura",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "En el taller de Paysandú cuidamos cada etapa del cuero: forrado, agujereado y costura a mano. Es un oficio de más de 30 años en la familia Ortiz. Con un cuidado simple, un mate o una matera de cuero te acompañan muchos años."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "¿Con qué se limpia el cuero del mate?",
          "respuesta": "Con un paño seco o apenas húmedo. Para hidratarlo, crema o grasa para cuero cada tanto."
        },
        {
          "pregunta": "¿Se puede mojar el mate de cuero?",
          "respuesta": "Un poco no le hace nada, pero no lo sumerjas y dejalo secar a la sombra."
        },
        {
          "pregunta": "¿Por qué se agrieta el cuero?",
          "respuesta": "Por el sol y el calor. Guardalo a la sombra y cada tanto hidratalo."
        }
      ],
      "seguir": [
        "[Materas de cuero](/catalogo/materas).",
        "[Cintos](/catalogo/cintos) y [billeteras](/catalogo/billeteras) de cuero hechos a mano.",
        "[Qué mate elegir](/guias/que-mate-elegir)."
      ]
    },
    {
      "id": "4",
      "slug": "regalos-para-empresas",
      "titulo": "Regalos empresariales personalizados hechos en Uruguay",
      "tituloSeo": "Regalos empresariales personalizados hechos en Uruguay",
      "descripcion": "Mates, materas y piezas de cuero con el logo o el nombre de tu equipo, hechos a mano en Paysandú. Ideas por ocasión, técnicas y cómo pedir.",
      "intro": [
        "Hacemos mates, materas y piezas de cuero con el logo de tu empresa o el nombre de tu equipo, a mano en nuestro taller de Paysandú. Se cotiza según la cantidad y el diseño, desde 30 unidades, y se produce en 7 a 14 días hábiles: escribinos con la idea y te pasamos opciones."
      ],
      "secciones": [
        {
          "titulo": "Ideas por ocasión",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Fin de año:** un mate con el logo para cada persona del equipo.",
                "**Aniversarios y logros:** piezas con el nombre y la fecha, para reconocer años de trabajo o un objetivo cumplido.",
                "**Clientes:** un regalo uruguayo con identidad, que se usa todos los días y no termina en un cajón.",
                "**Eventos, congresos y visitas:** un recuerdo para los invitados."
              ]
            }
          ]
        },
        {
          "titulo": "Cómo se personaliza",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Grabado láser** en la virola: el logo o el nombre, con detalle fino.",
                "**Apliques de bronce o alpaca** en la virola o en el fleje: iniciales, escudos o el logo en relieve.",
                "**El modelo de mate:** imperial, camionero, torpedo o criollo (ver [qué mate elegir](/guias/que-mate-elegir)). También materas y piezas de cuero."
              ]
            },
            {
              "tipo": "parrafo",
              "texto": "Antes de producir, el equipo revisa cada diseño para que quede bien en la pieza."
            }
          ]
        },
        {
          "titulo": "Experiencia",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Hicimos piezas personalizadas para la AFA, la AUF y figuras del fútbol. Somos la familia Ortiz, con más de 30 años de oficio en Paysandú, y la marca tiene la distinción Uruguay Natural."
            }
          ]
        },
        {
          "titulo": "Cómo pedir",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": true,
              "items": [
                "Escribinos por WhatsApp o desde [regalos para empresas](/empresas) con la cantidad aproximada, la ocasión y el logo.",
                "Te proponemos modelos y técnicas, con precio por unidad.",
                "Aprobás el diseño y lo producimos en el taller."
              ]
            },
            {
              "tipo": "parrafo",
              "texto": "La producción lleva de 7 a 14 días hábiles. Para fin de año, conviene pedir con 30 días de anticipación; si estás más justo, escribinos y lo conversamos."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "¿Pueden poner el logo de mi empresa en un mate?",
          "respuesta": "Sí, con grabado láser o con aplique de bronce o alpaca, según el modelo y el diseño."
        },
        {
          "pregunta": "¿Hay una cantidad mínima?",
          "respuesta": "Sí, 30 unidades."
        },
        {
          "pregunta": "¿Cuánto tarda la producción?",
          "respuesta": "De 7 a 14 días hábiles desde que aprobás el diseño."
        },
        {
          "pregunta": "¿Con cuánta anticipación conviene pedir para fin de año?",
          "respuesta": "En lo posible, 30 días antes. Si estás más justo, escribinos y lo conversamos."
        },
        {
          "pregunta": "¿Hacen envíos a todo el país?",
          "respuesta": "Sí, enviamos a todo Uruguay y al exterior."
        }
      ],
      "seguir": [
        "[Regalos para empresas](/empresas).",
        "[Armá un mate de prueba en el personalizador](https://personalizador.matearteuruguay.com)."
      ]
    }
  ],
  "en": [
    {
      "id": "1",
      "slug": "how-to-cure-a-mate-gourd",
      "titulo": "How to cure a gourd mate",
      "tituloSeo": "How to cure a gourd mate, step by step",
      "descripcion": "How to cure a new gourd mate in three days, which mistakes to avoid and how to care for it afterwards. Ceramic and steel mates don't need curing.",
      "intro": [
        "A new gourd mate is cured before its first use: fill it with used, damp yerba, add hot water without letting it boil and let it rest for about 24 hours. The next day, empty it and scrape off the soft skin inside. Repeat for two or three days and it is ready.",
        "Ceramic and steel mates don't need curing. A rinse with hot water is enough."
      ],
      "secciones": [
        {
          "titulo": "Why a mate is cured",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "The gourd is a natural material. Inside it has a soft layer that, if left untouched, gives the first mates a bitter, odd taste, and it can crack or grow mould. Curing removes that layer, settles the gourd and leaves the inner wall ready for yerba every day."
            }
          ]
        },
        {
          "titulo": "Step by step",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": true,
              "items": [
                "**Fill it with used, damp yerba.** Up to the top, pressed down but not packed too hard.",
                "**Add hot water, without letting it boil.** The same water you would use to drink mate.",
                "**Let it rest for about 24 hours.** In a cool place, out of the sun.",
                "**Empty it and scrape off the soft skin** with a spoon, taking care not to damage the rim or the leather.",
                "**Repeat the process for two or three days.**",
                "**Let it dry upside down** in a well-ventilated place before your first mate."
              ]
            }
          ]
        },
        {
          "titulo": "Common mistakes",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Using boiling water:** it burns the gourd and can crack it.",
                "**Leaving it damp after use:** this is the main cause of mould. Always empty it and leave it upside down.",
                "**Washing it with detergent:** the taste stays in the gourd. Water is enough.",
                "**Scraping with something sharp:** a spoon does the job."
              ]
            }
          ]
        },
        {
          "titulo": "Care after curing",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "After every mate, empty it, rinse it with water and let it dry upside down in a ventilated place, without detergent. If your mate is covered in leather, the leather needs its own care: we explain it in [how to care for the leather of your mate and matera](/en/guides/leather-care)."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "How long does it take to cure a mate?",
          "respuesta": "Two or three days, repeating the damp yerba process every 24 hours."
        },
        {
          "pregunta": "Do ceramic or steel mates need curing?",
          "respuesta": "No. After a rinse with hot water they are ready to use."
        },
        {
          "pregunta": "What should I do if a mould stain appears?",
          "respuesta": "Send us a photo on WhatsApp and we will tell you what to do."
        }
      ],
      "seguir": [
        "MateArte gourd mates, handmade in Paysandú: [see mates](/en/catalog/mates).",
        "If you are just starting out, a kit brings everything together: [mate kits](/en/catalog/kits-materos).",
        "Not sure which model to choose? [Which mate to choose](/en/guides/which-mate-to-choose)."
      ]
    },
    {
      "id": "2",
      "slug": "which-mate-to-choose",
      "titulo": "Which mate to choose: imperial, criollo, torpedo, camionero or estribo",
      "tituloSeo": "Which mate to choose: imperial, criollo, torpedo, camionero or estribo",
      "descripcion": "The differences between the imperial, criollo, torpedo and camionero mates and the estribo collection, who each one is for and how to personalize it.",
      "intro": [
        "It depends on how you drink mate and who it is for. The **imperial** has a wide rim of worked metal and often a metal base. The **camionero** is large, with a wide mouth and a steady base. The **torpedo** is elongated, with a narrower mouth. The **criollo** has the traditional, rounder shape. And the **estribo collection** is made of gourd mates without leather, with each model's original rim."
      ],
      "secciones": [
        {
          "titulo": "Imperial",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "The most striking one: its wide rim of worked metal is what sets it apart, and it often has a metal base. It is a gift that stands out."
            },
            {
              "tipo": "parrafo",
              "texto": "This model has a family story behind it. It began on a trip Richard made to Rivera, where a handcrafted metal rim gave him the idea. The design won people over before it even had a name, until someone suggested «Mate Imperial». Today it is one of the best-known leather and gourd mates."
            },
            {
              "tipo": "parrafo",
              "texto": "**Who it is for:** anyone who wants a mate that draws attention, or a special gift. It is the model most often personalized on the rim."
            }
          ]
        },
        {
          "titulo": "Camionero",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Large, with a wide mouth and a steady base. It holds more yerba and is easy to serve."
            },
            {
              "tipo": "parrafo",
              "texto": "**Who it is for:** people who drink a lot of mate, and take it seriously, at the office, on the road or at home."
            }
          ]
        },
        {
          "titulo": "Torpedo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Elongated, with a narrower mouth. It fits in one hand and is easy to carry."
            },
            {
              "tipo": "parrafo",
              "texto": "**Who it is for:** anyone who prefers a slimmer mate and shorter servings."
            }
          ]
        },
        {
          "titulo": "Criollo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "The traditional, rounder shape. In the personalizer there are criollos with torpedo, imperial and camionero silhouettes, with a mate stand."
            },
            {
              "tipo": "parrafo",
              "texto": "**Who it is for:** anyone looking for the classic mate, with a leather finish."
            }
          ]
        },
        {
          "titulo": "Estribo collection",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Gourd mates without leather, with the original rim of the imperial, the torpedo or the camionero."
            },
            {
              "tipo": "parrafo",
              "texto": "**Who it is for:** anyone who prefers to see the natural gourd."
            }
          ]
        },
        {
          "titulo": "Choosing quickly",
          "bloques": [
            {
              "tipo": "tabla",
              "encabezado": [
                "If you want…",
                "Choose"
              ],
              "filas": [
                [
                  "A gift that stands out",
                  "Imperial"
                ],
                [
                  "To drink a lot, comfortably",
                  "Camionero"
                ],
                [
                  "Something slim and practical",
                  "Torpedo"
                ],
                [
                  "The classic shape",
                  "Criollo"
                ],
                [
                  "The gourd on show",
                  "Estribo"
                ]
              ]
            }
          ]
        },
        {
          "titulo": "Personalizing it",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Any of these models can be personalized with names, initials, crests or designs, on the rim and, depending on the model, on the band: with laser engraving or with bronze or alpaca appliqués. In the [personalizer](https://personalizador.matearteuruguay.com) you choose the mate, add whatever you like and see how it looks and what it costs before ordering. We review every design before production."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "What is the difference between the imperial and the camionero mate?",
          "respuesta": "The imperial stands out for its wide rim of worked metal; the camionero, for its large size and wide mouth."
        },
        {
          "pregunta": "Which mate is best as a gift?",
          "respuesta": "The imperial is the most striking, and personalized with a name or a crest it is a gift people remember."
        },
        {
          "pregunta": "Can I see how it looks before buying it?",
          "respuesta": "Yes: in the personalizer you see the design and the price before ordering."
        }
      ],
      "seguir": [
        "[Design your mate in the personalizer](https://personalizador.matearteuruguay.com).",
        "[See all mates](/en/catalog/mates).",
        "[How to cure a gourd mate](/en/guides/how-to-cure-a-mate-gourd)."
      ]
    },
    {
      "id": "3",
      "slug": "leather-care",
      "titulo": "How to care for the leather of your mate and matera",
      "tituloSeo": "How to care for the leather of your mate and matera",
      "descripcion": "How to clean and condition the leather of your mate, your matera or your leather goods so they last for years, and what to avoid.",
      "intro": [
        "Clean leather with a dry or slightly damp cloth, let it dry in the shade and condition it now and then with leather cream or leather grease. Direct sun and heat are what damage it most."
      ],
      "secciones": [
        {
          "titulo": "Everyday cleaning",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Wipe it with a dry cloth, or a slightly damp one if it has dust or a mark. Don't soak it or put it under water: too much water hardens and stains leather."
            },
            {
              "tipo": "parrafo",
              "texto": "If it gets wet, let it dry in the shade, never in the sun or near a heater."
            }
          ]
        },
        {
          "titulo": "Conditioning",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Every so often, apply a little leather cream or grease with a cloth, in thin layers, and let it soak in. It brings back flexibility and protects the leather. On a mate you use every day, you will notice the difference."
            }
          ]
        },
        {
          "titulo": "What to avoid",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Direct sun and heat:** they dry out the leather and crack it. Don't leave it in a car in the sun.",
                "**Lots of water:** it hardens and stains.",
                "**Ordinary cleaning products:** a cloth and leather cream are enough."
              ]
            }
          ]
        },
        {
          "titulo": "The mate: leather outside, gourd inside",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "A leather-covered mate needs two kinds of care: the leather's, explained here, and the gourd's (empty it, rinse it and let it dry upside down). We cover that in [how to cure a mate](/en/guides/how-to-cure-a-mate-gourd)."
            }
          ]
        },
        {
          "titulo": "Why it lasts",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "In our Paysandú workshop we take care of every stage of the leatherwork: covering, punching and hand stitching. It is a craft the Ortiz family has practised for more than 30 years. With simple care, a leather mate or matera will stay with you for many years."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "What should I clean the leather of my mate with?",
          "respuesta": "A dry or slightly damp cloth. To condition it, leather cream or grease every so often."
        },
        {
          "pregunta": "Can a leather mate get wet?",
          "respuesta": "A little water won't harm it, but don't soak it, and let it dry in the shade."
        },
        {
          "pregunta": "Why does leather crack?",
          "respuesta": "Because of sun and heat. Keep it in the shade and condition it from time to time."
        }
      ],
      "seguir": [
        "[Leather materas](/en/catalog/materas).",
        "Handmade leather [belts](/en/catalog/cintos) and [wallets](/en/catalog/billeteras).",
        "[Which mate to choose](/en/guides/which-mate-to-choose)."
      ]
    },
    {
      "id": "4",
      "slug": "corporate-gifts",
      "titulo": "Personalized corporate gifts made in Uruguay",
      "tituloSeo": "Personalized corporate gifts made in Uruguay",
      "descripcion": "Mates, materas and leather pieces with your company logo or your team's name, handmade in Paysandú. Ideas by occasion, techniques and how to order.",
      "intro": [
        "We make mates, materas and leather pieces with your company logo or your team's name, by hand in our Paysandú workshop. Quotes depend on quantity and design, from 30 units, and production takes 7 to 14 business days: write to us with your idea and we will send you options."
      ],
      "secciones": [
        {
          "titulo": "Ideas by occasion",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**End of year:** a mate with the logo for each person on the team.",
                "**Anniversaries and milestones:** pieces with the name and the date, to recognize years of work or a goal reached.",
                "**Clients:** a Uruguayan gift with character, used every day instead of ending up in a drawer.",
                "**Events, conferences and visits:** a keepsake for your guests."
              ]
            }
          ]
        },
        {
          "titulo": "How it is personalized",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Laser engraving** on the rim: the logo or the name, in fine detail.",
                "**Bronze or alpaca appliqués** on the rim or the band: initials, crests or the logo in relief.",
                "**The mate model:** imperial, camionero, torpedo or criollo (see [which mate to choose](/en/guides/which-mate-to-choose)). Materas and leather pieces too."
              ]
            },
            {
              "tipo": "parrafo",
              "texto": "Before production, our team reviews every design so it looks right on the piece."
            }
          ]
        },
        {
          "titulo": "Experience",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "We have made personalized pieces for the AFA, the AUF and football stars. We are the Ortiz family, with more than 30 years of craft in Paysandú, and the brand holds the Uruguay Natural distinction."
            }
          ]
        },
        {
          "titulo": "How to order",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": true,
              "items": [
                "Write to us on WhatsApp or from [corporate gifts](/en/corporate-gifts) with the approximate quantity, the occasion and the logo.",
                "We suggest models and techniques, with a price per unit.",
                "You approve the design and we make it in the workshop."
              ]
            },
            {
              "tipo": "parrafo",
              "texto": "Production takes 7 to 14 business days. For the end of the year, it is best to order 30 days in advance; if your timeline is tighter, write to us and we will work it out."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "Can you put my company logo on a mate?",
          "respuesta": "Yes, with laser engraving or with a bronze or alpaca appliqué, depending on the model and the design."
        },
        {
          "pregunta": "Is there a minimum quantity?",
          "respuesta": "Yes, 30 units."
        },
        {
          "pregunta": "How long does production take?",
          "respuesta": "7 to 14 business days from when you approve the design."
        },
        {
          "pregunta": "How far in advance should I order for the end of the year?",
          "respuesta": "Ideally 30 days before. If your timeline is tighter, write to us and we will work it out."
        },
        {
          "pregunta": "Do you ship nationwide and abroad?",
          "respuesta": "Yes, we ship throughout Uruguay and abroad."
        }
      ],
      "seguir": [
        "[Corporate gifts](/en/corporate-gifts).",
        "[Design a sample mate in the personalizer](https://personalizador.matearteuruguay.com)."
      ]
    }
  ],
  "pt": [
    {
      "id": "1",
      "slug": "como-curar-uma-cuia",
      "titulo": "Como curar uma cuia de porongo",
      "tituloSeo": "Como curar uma cuia de porongo, passo a passo",
      "descripcion": "Como curar uma cuia de porongo nova em três dias, quais erros evitar e como cuidar dela depois. As de cerâmica e de aço não precisam de cura.",
      "intro": [
        "Uma cuia de porongo nova é curada antes do primeiro uso: encha com erva-mate usada e úmida, acrescente água quente sem deixar ferver e deixe descansar por cerca de 24 horas. No dia seguinte, esvazie e raspe a película mole de dentro. Repita por dois ou três dias e pronto.",
        "As cuias de cerâmica ou de aço não precisam de cura. Basta enxaguar com água quente."
      ],
      "secciones": [
        {
          "titulo": "Para que serve a cura",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "O porongo é um material natural. Por dentro, tem uma camada mole que, se não for trabalhada, deixa o primeiro mate com um gosto amargo e estranho, e a cuia pode rachar ou criar fungos. A cura retira essa camada, assenta a cuia e deixa a parede pronta para receber a erva todos os dias."
            }
          ]
        },
        {
          "titulo": "Passo a passo",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": true,
              "items": [
                "**Encha com erva-mate usada e úmida.** Até a boca, apertada sem exagero.",
                "**Acrescente água quente, sem deixar ferver.** A mesma que você usaria para tomar.",
                "**Deixe descansar por cerca de 24 horas.** Em um lugar fresco, longe do sol.",
                "**Esvazie e raspe a película mole** com uma colher, com cuidado para não danificar a virola nem o couro.",
                "**Repita o processo por dois ou três dias.**",
                "**Deixe secar de boca para baixo** em um lugar ventilado antes do primeiro mate."
              ]
            }
          ]
        },
        {
          "titulo": "Erros comuns",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Usar água fervendo:** queima o porongo e pode rachá-lo.",
                "**Deixar a cuia úmida depois do uso:** é o que mais gera fungos. Sempre vazia e de boca para baixo.",
                "**Lavar com detergente:** o gosto fica na cuia. Água é suficiente.",
                "**Raspar com algo afiado:** a colher dá conta."
              ]
            }
          ]
        },
        {
          "titulo": "Cuidados depois da cura",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Depois de cada mate, esvazie a cuia, enxágue com água e deixe secar de boca para baixo em um lugar ventilado, sem detergente. Se a cuia for revestida de couro, o couro tem seu próprio cuidado: explicamos em [como cuidar do couro da sua cuia e da sua matera](/pt/guias/cuidado-com-o-couro)."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "Quanto tempo leva para curar uma cuia?",
          "respuesta": "Dois ou três dias, repetindo o processo da erva úmida a cada 24 horas."
        },
        {
          "pregunta": "Cuias de cerâmica ou de aço precisam de cura?",
          "respuesta": "Não. Depois de um enxágue com água quente, já podem ser usadas."
        },
        {
          "pregunta": "O que faço se aparecer uma mancha de fungo?",
          "respuesta": "Mande uma foto pelo WhatsApp e dizemos como seguir."
        }
      ],
      "seguir": [
        "Cuias de porongo da MateArte, feitas à mão em Paysandú: [ver cuias](/pt/catalogo/mates).",
        "Se você está começando, um kit traz tudo junto: [kits de mate](/pt/catalogo/kits-materos).",
        "Não sabe qual modelo escolher? [Qual cuia escolher](/pt/guias/qual-cuia-escolher)."
      ]
    },
    {
      "id": "2",
      "slug": "qual-cuia-escolher",
      "titulo": "Qual cuia escolher: imperial, criollo, torpedo, camionero ou estribo",
      "tituloSeo": "Qual cuia escolher: imperial, criollo, torpedo, camionero ou estribo",
      "descripcion": "As diferenças entre as cuias imperial, criollo, torpedo e camionero e a coleção estribo, para quem é cada uma e como personalizá-la.",
      "intro": [
        "Depende de como você toma mate e de para quem é. A **imperial** tem uma virola larga de metal trabalhado e, muitas vezes, pé de metal. A **camionero** é grande, de boca larga e base firme. A **torpedo** é alongada e de boca mais estreita. A **criollo** tem o formato tradicional, mais arredondado. E a **coleção estribo** reúne cuias de porongo sem couro, com a virola original de cada modelo."
      ],
      "secciones": [
        {
          "titulo": "Imperial",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "É a mais vistosa: a virola larga de metal trabalhado é o que a diferencia, e muitas vezes tem pé de metal. É um presente que chama a atenção."
            },
            {
              "tipo": "parrafo",
              "texto": "Este modelo tem história na família. Começou em uma viagem de Richard a Rivera, onde uma boquilha de metal trabalhada à mão lhe deu a ideia. O design agradou antes mesmo de ter nome, até que alguém sugeriu «Mate Imperial». Hoje é uma das cuias de couro e porongo mais conhecidas."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quem:** quem quer uma cuia que chame a atenção, ou um presente especial. É o modelo mais personalizado na virola."
            }
          ]
        },
        {
          "titulo": "Camionero",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Grande, de boca larga e base firme. Cabe mais erva e é fácil de servir."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quem:** quem toma muito mate, e leva isso a sério, no escritório, na estrada ou em casa."
            }
          ]
        },
        {
          "titulo": "Torpedo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Alongada e de boca mais estreita. Cabe em uma mão e é prática para levar."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quem:** quem prefere uma cuia mais fina, para mates mais curtos."
            }
          ]
        },
        {
          "titulo": "Criollo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "O formato tradicional, mais arredondado. No personalizador há cuias criollo com silhueta de torpedo, de imperial e de camionero, com suporte."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quem:** quem procura a cuia de sempre, com acabamento em couro."
            }
          ]
        },
        {
          "titulo": "Coleção estribo",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Cuias de porongo sem couro, com a virola original da imperial, da torpedo ou da camionero."
            },
            {
              "tipo": "parrafo",
              "texto": "**Para quem:** quem prefere ver o porongo ao natural."
            }
          ]
        },
        {
          "titulo": "Como escolher rápido",
          "bloques": [
            {
              "tipo": "tabla",
              "encabezado": [
                "Se você procura…",
                "Escolha"
              ],
              "filas": [
                [
                  "Um presente que chame a atenção",
                  "Imperial"
                ],
                [
                  "Tomar muito e com conforto",
                  "Camionero"
                ],
                [
                  "Algo fino e prático",
                  "Torpedo"
                ],
                [
                  "O formato de sempre",
                  "Criollo"
                ],
                [
                  "O porongo à mostra",
                  "Estribo"
                ]
              ]
            }
          ]
        },
        {
          "titulo": "Personalizar",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Qualquer um desses modelos pode ser personalizado com nomes, iniciais, escudos ou desenhos, na virola e, conforme o modelo, na faixa: com gravação a laser ou com apliques de bronze ou alpaca. No [personalizador](https://personalizador.matearteuruguay.com) você escolhe a cuia, acrescenta o que quiser e vê como fica e quanto custa antes de pedir. Revisamos cada design antes da produção."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "Qual é a diferença entre a cuia imperial e a camionero?",
          "respuesta": "A imperial se destaca pela virola larga de metal trabalhado; a camionero, pelo tamanho grande e pela boca larga."
        },
        {
          "pregunta": "Qual cuia é melhor para presentear?",
          "respuesta": "A imperial é a mais vistosa e, personalizada com nome ou escudo, é um presente que fica na memória."
        },
        {
          "pregunta": "Posso ver como fica antes de comprar?",
          "respuesta": "Sim: no personalizador você vê o design e o preço antes de pedir."
        }
      ],
      "seguir": [
        "[Monte sua cuia no personalizador](https://personalizador.matearteuruguay.com).",
        "[Ver todas as cuias](/pt/catalogo/mates).",
        "[Como curar uma cuia de porongo](/pt/guias/como-curar-uma-cuia)."
      ]
    },
    {
      "id": "3",
      "slug": "cuidado-com-o-couro",
      "titulo": "Como cuidar do couro da sua cuia e da sua matera",
      "tituloSeo": "Como cuidar do couro da sua cuia e da sua matera",
      "descripcion": "Como limpar e hidratar o couro da sua cuia, da sua matera ou dos seus artigos de couro para que durem anos, e o que evitar.",
      "intro": [
        "O couro se limpa com um pano seco ou levemente úmido, seca à sombra e, de vez em quando, é hidratado com creme ou graxa para couro. O que mais o prejudica é o sol direto e o calor."
      ],
      "secciones": [
        {
          "titulo": "Limpeza do dia a dia",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Passe um pano seco, ou levemente úmido se houver poeira ou alguma marca. Não molhe demais nem mergulhe na água: o excesso de água endurece e mancha o couro."
            },
            {
              "tipo": "parrafo",
              "texto": "Se molhou, deixe secar à sombra, nunca ao sol nem perto de um aquecedor."
            }
          ]
        },
        {
          "titulo": "Hidratação",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "De vez em quando, aplique um pouco de creme ou graxa para couro com um pano, em camadas finas, e deixe absorver. Isso devolve a flexibilidade e protege o couro. Em uma cuia que você usa todos os dias, a diferença aparece."
            }
          ]
        },
        {
          "titulo": "O que evitar",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Sol direto e calor:** ressecam o couro e o racham. Não deixe no carro ao sol.",
                "**Muita água:** endurece e mancha.",
                "**Produtos de limpeza comuns:** um pano e creme para couro bastam."
              ]
            }
          ]
        },
        {
          "titulo": "A cuia: couro por fora, porongo por dentro",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Em uma cuia revestida de couro convivem dois cuidados: o do couro, que é este, e o do porongo (esvaziar, enxaguar e deixar secar de boca para baixo). Explicamos em [como curar uma cuia](/pt/guias/como-curar-uma-cuia)."
            }
          ]
        },
        {
          "titulo": "Por que dura",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Na oficina de Paysandú cuidamos de cada etapa do couro: revestimento, perfuração e costura à mão. É um ofício de mais de 30 anos na família Ortiz. Com um cuidado simples, uma cuia ou uma matera de couro acompanha você por muitos anos."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "Com o que se limpa o couro da cuia?",
          "respuesta": "Com um pano seco ou levemente úmido. Para hidratar, creme ou graxa para couro de vez em quando."
        },
        {
          "pregunta": "A cuia de couro pode molhar?",
          "respuesta": "Um pouco de água não faz mal, mas não mergulhe e deixe secar à sombra."
        },
        {
          "pregunta": "Por que o couro racha?",
          "respuesta": "Por causa do sol e do calor. Guarde à sombra e hidrate de vez em quando."
        }
      ],
      "seguir": [
        "[Materas de couro](/pt/catalogo/materas).",
        "[Cintos](/pt/catalogo/cintos) e [carteiras](/pt/catalogo/billeteras) de couro feitos à mão.",
        "[Qual cuia escolher](/pt/guias/qual-cuia-escolher)."
      ]
    },
    {
      "id": "4",
      "slug": "presentes-corporativos",
      "titulo": "Presentes corporativos personalizados feitos no Uruguai",
      "tituloSeo": "Presentes corporativos personalizados feitos no Uruguai",
      "descripcion": "Cuias, materas e peças de couro com o logo da sua empresa ou o nome da sua equipe, feitas à mão em Paysandú. Ideias por ocasião, técnicas e como pedir.",
      "intro": [
        "Fazemos cuias, materas e peças de couro com o logo da sua empresa ou o nome da sua equipe, à mão, na nossa oficina de Paysandú. O orçamento depende da quantidade e do design, a partir de 30 unidades, e a produção leva de 7 a 14 dias úteis: escreva para nós com a ideia e enviamos opções."
      ],
      "secciones": [
        {
          "titulo": "Ideias por ocasião",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Fim de ano:** uma cuia com o logo para cada pessoa da equipe.",
                "**Aniversários e conquistas:** peças com o nome e a data, para reconhecer anos de trabalho ou uma meta alcançada.",
                "**Clientes:** um presente uruguaio com identidade, que se usa todos os dias e não fica esquecido em uma gaveta.",
                "**Eventos, congressos e visitas:** uma lembrança para os convidados."
              ]
            }
          ]
        },
        {
          "titulo": "Como se personaliza",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": false,
              "items": [
                "**Gravação a laser** na virola: o logo ou o nome, com detalhe fino.",
                "**Apliques de bronze ou alpaca** na virola ou na faixa: iniciais, escudos ou o logo em relevo.",
                "**O modelo de cuia:** imperial, camionero, torpedo ou criollo (veja [qual cuia escolher](/pt/guias/qual-cuia-escolher)). Também materas e peças de couro."
              ]
            },
            {
              "tipo": "parrafo",
              "texto": "Antes da produção, a equipe revisa cada design para que fique bem na peça."
            }
          ]
        },
        {
          "titulo": "Experiência",
          "bloques": [
            {
              "tipo": "parrafo",
              "texto": "Fizemos peças personalizadas para a AFA, a AUF e estrelas do futebol. Somos a família Ortiz, com mais de 30 anos de ofício em Paysandú, e a marca tem a distinção Uruguay Natural."
            }
          ]
        },
        {
          "titulo": "Como pedir",
          "bloques": [
            {
              "tipo": "lista",
              "ordenada": true,
              "items": [
                "Escreva para nós pelo WhatsApp ou pela página de [presentes corporativos](/pt/empresas) com a quantidade aproximada, a ocasião e o logo.",
                "Propomos modelos e técnicas, com preço por unidade.",
                "Você aprova o design e produzimos na oficina."
              ]
            },
            {
              "tipo": "parrafo",
              "texto": "A produção leva de 7 a 14 dias úteis. Para o fim de ano, o ideal é pedir com 30 dias de antecedência; se o prazo estiver mais curto, escreva para nós e conversamos."
            }
          ]
        }
      ],
      "faq": [
        {
          "pregunta": "Vocês podem colocar o logo da minha empresa em uma cuia?",
          "respuesta": "Sim, com gravação a laser ou com aplique de bronze ou alpaca, conforme o modelo e o design."
        },
        {
          "pregunta": "Existe uma quantidade mínima?",
          "respuesta": "Sim, 30 unidades."
        },
        {
          "pregunta": "Quanto tempo leva a produção?",
          "respuesta": "De 7 a 14 dias úteis a partir da aprovação do design."
        },
        {
          "pregunta": "Com quanta antecedência devo pedir para o fim de ano?",
          "respuesta": "De preferência, 30 dias antes. Se o prazo estiver mais curto, escreva para nós e conversamos."
        },
        {
          "pregunta": "Vocês enviam para todo o país e para o exterior?",
          "respuesta": "Sim, enviamos para todo o Uruguai e para o exterior."
        }
      ],
      "seguir": [
        "[Presentes corporativos](/pt/empresas).",
        "[Monte uma cuia de teste no personalizador](https://personalizador.matearteuruguay.com)."
      ]
    }
  ]
};

export function guiaPorSlug(idioma: IdiomaGuia, slug: string): Guia | undefined {
  return guias[idioma].find((guia) => guia.slug === slug);
}

/** La misma guía en otro idioma: sirve para el selector de idioma, que conserva el slug. */
export function traduccionDeGuia(slug: string, idioma: IdiomaGuia): Guia | undefined {
  const id = Object.values(guias).flat().find((guia) => guia.slug === slug)?.id;
  return guias[idioma].find((guia) => guia.id === id);
}

export function slugsDeGuia(id: string): Record<IdiomaGuia, string> {
  const slug = (idioma: IdiomaGuia) => guias[idioma].find((guia) => guia.id === id)?.slug ?? "";
  return { es: slug("es"), en: slug("en"), pt: slug("pt") };
}
