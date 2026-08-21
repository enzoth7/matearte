from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


OUTPUT = Path(r"Informacion/ProDiseño/MIEM/MIEM_ObjetivosYJustificacion.DOCX")

# Design preset: grant_proposal (narrative_proposal) with one named override:
# A4 portrait, matching the supplied MIEM PDF reference.
NAVY = "17365D"
BLUE = "2E74B5"
DARK_BLUE = "1F4D78"
INK = "1F1F1F"
MUTED = "667085"
PALE_BLUE = "F4F6F9"
LINE = "D7DEE8"
FONT = "Calibri"


def set_font(run, size=None, bold=None, color=None, italic=None):
    run.font.name = FONT
    run._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    run._element.rPr.rFonts.set(qn("w:cs"), FONT)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)


def set_paragraph_style(paragraph, before=0, after=6, line=1.25, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    paragraph.alignment = align


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement("w:tcMar")
        tcPr.append(tcMar)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tcMar.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            tcMar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")


def set_cell_border(cell, color=LINE, size="6"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_table_geometry(table, widths_dxa, indent_dxa=120):
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    tbl = table._tbl
    tbl_pr = tbl.tblPr

    tbl_w = tbl_pr.first_child_found_in("w:tblW")
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths_dxa)))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.first_child_found_in("w:tblInd")
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(indent_dxa))
    tbl_ind.set(qn("w:type"), "dxa")

    grid = tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths_dxa:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)

    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(widths_dxa[idx]))
            tc_w.set(qn("w:type"), "dxa")
            cell.width = Cm(widths_dxa[idx] / 567)


def set_table_borders(table, color=LINE, size="6"):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_keep_with_next(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    keep = OxmlElement("w:keepNext")
    p_pr.append(keep)


def set_page_break_before(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    page_break = OxmlElement("w:pageBreakBefore")
    p_pr.append(page_break)


def set_bottom_border(paragraph, color=BLUE, size="12"):
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), size)
    bottom.set(qn("w:space"), "8")
    bottom.set(qn("w:color"), color)
    p_bdr.append(bottom)


def add_page_field(paragraph):
    run = paragraph.add_run()
    set_font(run, size=8.5, color=MUTED)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def add_body_paragraph(doc, text, before=0, after=6, keep=False):
    p = doc.add_paragraph()
    set_paragraph_style(p, before=before, after=after)
    run = p.add_run(text)
    set_font(run, size=11, color=INK)
    if keep:
        set_keep_with_next(p)
    return p


def add_labeled_paragraph(doc, label, text, before=0, after=6):
    p = doc.add_paragraph()
    set_paragraph_style(p, before=before, after=after)
    label_run = p.add_run(label)
    set_font(label_run, size=11, color=INK, bold=True)
    text_run = p.add_run(text)
    set_font(text_run, size=11, color=INK)
    return p


def add_heading(doc, text, level=1, page_break=False):
    style = "Heading 1" if level == 1 else "Heading 2"
    p = doc.add_paragraph(style=style)
    if page_break:
        set_page_break_before(p)
    p.add_run(text)
    set_keep_with_next(p)
    return p


def add_callout(doc, label, text):
    table = doc.add_table(rows=1, cols=1)
    set_table_geometry(table, [9360])
    set_table_borders(table, color=LINE, size="6")
    cell = table.cell(0, 0)
    set_cell_margins(cell, top=140, start=180, bottom=140, end=180)
    set_cell_shading(cell, PALE_BLUE)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    set_paragraph_style(p, before=0, after=0, line=1.2, align=WD_ALIGN_PARAGRAPH.LEFT)
    r = p.add_run(label + " ")
    set_font(r, size=10.5, color=NAVY, bold=True)
    r = p.add_run(text)
    set_font(r, size=10.5, color=INK)
    spacer = doc.add_paragraph()
    set_paragraph_style(spacer, before=0, after=4, line=1.0, align=WD_ALIGN_PARAGRAPH.LEFT)
    return table


def configure_document(doc):
    section = doc.sections[0]
    # A4 is the named visual-reference override to the preset's default Letter page.
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.9)
    section.bottom_margin = Cm(1.9)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.header_distance = Cm(1.0)
    section.footer_distance = Cm(1.0)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    h1 = doc.styles["Heading 1"]
    h1.font.name = FONT
    h1._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    h1._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    h1.font.size = Pt(16)
    h1.font.bold = True
    h1.font.color.rgb = RGBColor.from_string(BLUE)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(8)
    h1.paragraph_format.line_spacing = 1.0

    h2 = doc.styles["Heading 2"]
    h2.font.name = FONT
    h2._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    h2._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    h2.font.size = Pt(13)
    h2.font.bold = True
    h2.font.color.rgb = RGBColor.from_string(BLUE)
    h2.paragraph_format.space_before = Pt(12)
    h2.paragraph_format.space_after = Pt(6)
    h2.paragraph_format.line_spacing = 1.0

    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_style(hp, before=0, after=0, line=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = hp.add_run("PRODISEÑO 2026  |  MATEARTE")
    set_font(r, size=8.5, color=MUTED, bold=True)

    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_style(fp, before=0, after=0, line=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = fp.add_run("Objetivo y justificación del proyecto  |  Página ")
    set_font(r, size=8.5, color=MUTED)
    add_page_field(fp)


def add_metadata_table(doc):
    rows = [
        ("Proyecto", 'Ecosistema Digital y Experiencia de Personalización "Matearte"'),
        ("Empresa postulante", "ORTIZ CARDOZO RICHARD ARIEL"),
        ("RUT", "120281110019"),
        ("Empresa de diseño", "PAYRET ARBIZA JAVIER ENRIQUE (Polarist)"),
        ("RUT", "120121780016"),
    ]
    table = doc.add_table(rows=len(rows), cols=2)
    set_table_geometry(table, [2160, 7200])
    set_table_borders(table, color=LINE, size="6")
    for row, (label, value) in zip(table.rows, rows):
        row.cells[0].vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        row.cells[1].vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        for cell in row.cells:
            set_cell_margins(cell, top=90, start=120, bottom=90, end=120)
        set_cell_shading(row.cells[0], PALE_BLUE)
        lp = row.cells[0].paragraphs[0]
        set_paragraph_style(lp, before=0, after=0, line=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        lr = lp.add_run(label)
        set_font(lr, size=10.2, color=NAVY, bold=True)
        vp = row.cells[1].paragraphs[0]
        set_paragraph_style(vp, before=0, after=0, line=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        vr = vp.add_run(value)
        set_font(vr, size=10.2, color=INK)
    spacer = doc.add_paragraph()
    set_paragraph_style(spacer, before=0, after=6, line=1.0, align=WD_ALIGN_PARAGRAPH.LEFT)


def add_signature_block(doc):
    p = doc.add_paragraph()
    set_paragraph_style(p, before=0, after=8, line=1.25, align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    r = p.add_run(
        "Las partes declaran su conformidad con el objetivo, alcance y justificación expuestos en este documento. "
        "Las firmas se incorporarán en esta versión antes de la presentación final."
    )
    set_font(r, size=11, color=INK)

    # Space intentionally reserved for handwritten or electronic signatures.
    for _ in range(5):
        spacer = doc.add_paragraph()
        set_paragraph_style(spacer, before=0, after=0, line=1.0, align=WD_ALIGN_PARAGRAPH.LEFT)
        spacer.paragraph_format.keep_together = True

    table = doc.add_table(rows=1, cols=2)
    set_table_geometry(table, [4560, 4800])
    for cell in table.rows[0].cells:
        set_cell_margins(cell, top=40, start=120, bottom=40, end=120)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
        set_cell_border(cell, color="4A5568", size="8")
    left = table.cell(0, 0).paragraphs[0]
    set_paragraph_style(left, before=0, after=0, line=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = left.add_run("ORTIZ CARDOZO RICHARD ARIEL\n")
    set_font(r, size=10, color=INK, bold=True)
    r = left.add_run("RUT 120281110019\nEmpresa postulante beneficiaria")
    set_font(r, size=9.5, color=MUTED)
    right = table.cell(0, 1).paragraphs[0]
    set_paragraph_style(right, before=0, after=0, line=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = right.add_run("PAYRET ARBIZA JAVIER ENRIQUE\n")
    set_font(r, size=10, color=INK, bold=True)
    r = right.add_run("RUT 120121780016\nResponsable por la empresa de diseño")
    set_font(r, size=9.5, color=MUTED)


def build_document():
    doc = Document()
    configure_document(doc)

    # First-page header pattern: proposal_centerpiece.
    p = doc.add_paragraph()
    set_paragraph_style(p, before=4, after=4, line=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = p.add_run("DINAPYME - Ministerio de Industria, Energía y Minería")
    set_font(r, size=10.5, color=MUTED, bold=True)

    p = doc.add_paragraph()
    set_paragraph_style(p, before=0, after=4, line=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = p.add_run("CONVOCATORIA PRODISEÑO 2026")
    set_font(r, size=13, color=NAVY, bold=True)

    p = doc.add_paragraph()
    set_paragraph_style(p, before=2, after=3, line=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = p.add_run("Objetivo y justificación del proyecto")
    set_font(r, size=21, color=NAVY, bold=True)
    set_bottom_border(p, color=BLUE, size="12")

    p = doc.add_paragraph()
    set_paragraph_style(p, before=8, after=16, line=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = p.add_run('Ecosistema Digital y Experiencia de Personalización "Matearte"')
    set_font(r, size=13.5, color=DARK_BLUE, italic=True)

    add_metadata_table(doc)
    add_callout(
        doc,
        "Áreas de apoyo solicitadas.",
        "Diseño de servicio, diseño de comunicación visual, diseño web y diseño de interacciones UX/UI.",
    )

    add_heading(doc, "1. Antecedentes y contexto de la empresa postulante")
    add_body_paragraph(
        doc,
        "Matearte desarrolla y comercializa mates personalizados y accesorios artesanales desde Paysandú. "
        "Su propuesta combina materiales tales como cuero, madera, metal y virolas con trabajos de personalización mediante grabado, "
        "por lo que cada pedido requiere una coordinación precisa entre la instancia comercial y la ejecución en taller.",
    )
    add_body_paragraph(
        doc,
        "La empresa se encuentra en una etapa de crecimiento en la que la demanda de piezas personalizadas exige mayor trazabilidad, "
        "claridad en la definición de cada diseño y una comunicación más consistente con los clientes. Actualmente, parte del intercambio "
        "para validar textos, tipografías, escudos o aplicaciones, así como el pasaje de la información hacia producción, se resuelve de "
        "forma manual y mediante información distribuida. Este contexto incrementa los tiempos de respuesta, la dependencia de tareas "
        "concentradas en una sola persona y la posibilidad de reinterpretaciones o reprocesos.",
    )

    add_heading(doc, "2. Motivación, debilidades y oportunidad de incorporar diseño")
    add_body_paragraph(
        doc,
        "La postulación a ProDiseño responde a la necesidad de dar un salto cualitativo desde una operación artesanal y predominantemente "
        "manual hacia una estructura digital más profesional, escalable y coherente. El proyecto propone incorporar el diseño como activo "
        "estratégico para mejorar, de forma integrada, la experiencia de compra, la comunicación de la marca y la organización operativa del taller.",
    )

    add_labeled_paragraph(
        doc,
        "Fricción en la venta digital. ",
        "La tienda actual no permite que el cliente visualice en tiempo real cómo quedará su mate al incorporar un texto, elegir una tipografía "
        "o sumar un escudo o aplique. Esta falta de previsualización genera incertidumbre, demanda consultas adicionales y debilita la decisión de compra.",
    )
    add_labeled_paragraph(
        doc,
        "Variabilidad y reprocesos en taller. ",
        "La ausencia de una especificación digital completa y estandarizada para cada pedido puede dar lugar a errores de interpretación durante "
        "el grabado, repeticiones de trabajo y desperdicio de insumos. La información comercial debe transformarse en una orden de producción inequívoca.",
    )
    add_labeled_paragraph(
        doc,
        "Proceso de compra incompleto. ",
        "El recorrido de compra requiere una revisión integral para facilitar el pago mediante opciones adecuadas al mercado local, el cálculo o la "
        "gestión de envíos nacionales y la confirmación transparente de los detalles que el cliente selecciona.",
    )
    add_labeled_paragraph(
        doc,
        "Oportunidad de diferenciación. ",
        "La alta valoración de los productos personalizados permite convertir estas debilidades en una ventaja competitiva: una experiencia digital "
        "que acerque al cliente una previsualización clara y fiel de su elección, al tiempo que entregue al taller datos estructurados para trabajar con mayor seguridad.",
    )

    add_heading(doc, "3. Objetivo general del proyecto")
    add_callout(
        doc,
        "Objetivo general.",
        "Desarrollar para Matearte un ecosistema digital de venta y personalización que integre el rediseño de la tienda e-commerce, una experiencia "
        "UX/UI de configuración y previsualización en tiempo real del mate, y un flujo digital de órdenes para taller con especificaciones completas de "
        "producción. Con ello se busca mejorar la conversión del canal online, profesionalizar la comunicación con el cliente y reducir errores y reprocesos "
        "en el grabado y la preparación de cada pedido.",
    )

    add_heading(doc, "4. Justificación por rubro de diseño solicitado")

    add_heading(doc, "4.1 Diseño web y e-commerce", level=2)
    add_body_paragraph(
        doc,
        "El rediseño web es necesario para ordenar la oferta de Matearte, mejorar la jerarquía visual del catálogo y construir un recorrido de compra "
        "más claro desde la selección del producto hasta el pago. La nueva tienda deberá presentar adecuadamente las categorías, las posibilidades de "
        "personalización y las condiciones de entrega, además de contemplar medios de pago locales y la coordinación de envíos nacionales. El diseño web "
        "no se plantea como una página informativa, sino como el canal comercial que articula la consulta, la configuración, la compra y la confirmación del pedido.",
    )

    add_heading(doc, "4.2 Diseño de interacciones UX/UI", level=2)
    add_body_paragraph(
        doc,
        "El diseño de interacciones UX/UI permitirá crear un personalizador intuitivo para los modelos de mate Imperial, Torpedo y Camionero. El cliente "
        "podrá definir elementos como texto, tipografía, escudos o frases y visualizar su ubicación antes de pagar. Esta interacción debe priorizar la "
        "comprensión, la validación de las decisiones tomadas y la reducción de dudas que hoy se resuelven por canales manuales. La previsualización no solo "
        "mejora la experiencia de compra: también funciona como instancia de validación de la información que luego deberá utilizar el taller.",
    )

    add_heading(doc, "4.3 Diseño de servicio", level=2)
    add_body_paragraph(
        doc,
        "El proyecto necesita diseñar el servicio de punta a punta, conectando el momento en que la persona configura su mate con la preparación y "
        "ejecución del pedido. Esto implica definir los datos mínimos de cada solicitud, los puntos de validación, el formato de la orden de trabajo y el "
        "flujo de información que recibe el taller. El resultado esperado es un proceso más trazable, con menos dependencia de intercambios informales y una "
        "base para gestionar pedidos, responsabilidades y prioridades con mayor previsibilidad.",
    )

    add_heading(doc, "4.4 Diseño de comunicación visual", level=2)
    add_body_paragraph(
        doc,
        "El diseño de comunicación visual es clave para que el nuevo canal digital exprese con claridad la identidad de Matearte y ponga en valor el "
        "carácter artesanal y personalizado de su propuesta. Se aplicará a la jerarquización de contenidos, la presentación del catálogo, las fichas de "
        "producto, los mensajes del personalizador y los puntos de contacto de la compra. Una comunicación consistente ayudará a diferenciar la marca, "
        "hacer comprensibles las opciones disponibles y reforzar la confianza necesaria para comprar una pieza personalizada en línea.",
    )

    add_heading(doc, "5. Nuevo servicio y nuevo proceso resultantes")
    add_body_paragraph(
        doc,
        "El proyecto dará lugar a un nuevo servicio comercial: la posibilidad de configurar y previsualizar digitalmente un mate personalizado antes de "
        "realizar la compra. A diferencia del intercambio manual actual, el cliente contará con una experiencia guiada que le permitirá comprender las "
        "opciones disponibles, confirmar su elección y avanzar con mayor seguridad hacia el pago.",
    )
    add_body_paragraph(
        doc,
        "Asimismo, se implementará un nuevo proceso de gestión de órdenes para taller. La configuración definida por el cliente se traducirá en una "
        "especificación digital ordenada, con los atributos necesarios para producir el pedido. El diseño del flujo deberá evitar la transcripción innecesaria, "
        "reducir la ambigüedad y facilitar que el equipo de taller identifique, valide y ejecute cada trabajo de grabado con criterios uniformes.",
    )

    add_heading(doc, "6. Resultados esperados y forma de medición")
    add_body_paragraph(
        doc,
        "Los indicadores, metas y plazos se registrarán en los campos específicos del trámite en línea. Este documento los vincula al alcance del proyecto "
        "para dejar explícita la relación entre el diseño propuesto y los resultados operativos y comerciales esperados.",
    )
    add_labeled_paragraph(
        doc,
        "Facturación del canal digital. ",
        "Se medirá la facturación mensual del canal e-commerce en pesos uruguayos. La meta prevista es lograr un incremento de 35% en las ventas del canal web "
        "dentro de los seis meses posteriores al lanzamiento del proyecto.",
    )
    add_labeled_paragraph(
        doc,
        "Reducción de costos por reprocesos. ",
        "Se observará el porcentaje de pedidos con errores de grabado y desperdicio de insumos en taller. La meta es disminuir los reprocesos del 8% actual a "
        "menos de 0,5% durante los tres meses posteriores al lanzamiento.",
    )
    add_labeled_paragraph(
        doc,
        "Captación y conversión de clientes. ",
        "Se medirá la tasa de conversión de visitas a compradores en la tienda web. La meta es pasar del 1,2% actual a un valor igual o superior a 2,5% en los "
        "tres meses posteriores al lanzamiento.",
    )

    add_heading(doc, "7. Conformidad", page_break=True)
    add_signature_block(doc)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.core_properties.title = "Objetivo y justificación del proyecto - Matearte"
    doc.core_properties.subject = "Convocatoria ProDiseño 2026"
    doc.core_properties.author = "Matearte"
    doc.core_properties.keywords = "ProDiseño, Matearte, MIEM, DINAPYME"
    doc.save(OUTPUT)


if __name__ == "__main__":
    build_document()
