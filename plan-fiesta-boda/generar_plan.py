#!/usr/bin/env python3
"""Genera la hoja de cálculo para planificar una fiesta de boda.

Uso:
    python3 generar_plan.py

Requiere openpyxl. El archivo queda junto a este script:
Plan-fiesta-de-boda.xlsx
"""

from __future__ import annotations

from datetime import time
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.comments import Comment
from openpyxl.formatting.rule import DataBarRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.page import PageMargins

CAL = "Calibri"
WINE = "6B2D3C"
INK = "1F1A17"
CREAM = "FBF7F2"
SAND = "F3E6D8"
BLUSH = "F6EDE8"
LINE = "E0D4C8"
WHITE = "FFFFFF"
SAGE = "245C45"
SAGE_BG = "E5F0EB"
GOLD = "7A5B2E"
GOLD_BG = "F8F1E3"
RED = "8C3A3A"
RED_BG = "F8E8E6"
MUTED = "6F645C"
INPUT_BG = "FFFCF8"
FORMULA_BG = "F4F0EA"
HAIR = "EFE6DE"

MONEY = '#,##0.00'
DATE_FMT = "DD/MM/YYYY"
TIME_FMT = "HH:MM"
PCT = "0%"
INT = "#,##0"

CATEGORIAS = [
    "Lugar",
    "Banquete",
    "Bebidas",
    "Pastel",
    "Música",
    "Foto y video",
    "Flores y decoración",
    "Invitaciones",
    "Vestuario",
    "Belleza",
    "Transporte",
    "Mobiliario",
    "Recuerdos",
    "Coordinación",
    "Otra",
]

CONCEPTOS = [
    ("Lugar", "Renta del salón o jardín", False),
    ("Lugar", "Hora extra", False),
    ("Lugar", "Permiso o cargo del lugar", False),
    ("Banquete", "Alimentos por persona", True),
    ("Banquete", "Cóctel o mesa de bocadillos", False),
    ("Banquete", "Personal de servicio", False),
    ("Bebidas", "Barra por persona", True),
    ("Bebidas", "Brindis por persona", True),
    ("Bebidas", "Hielo, cristalería y barra", False),
    ("Pastel", "Pastel", False),
    ("Pastel", "Mesa de postres", False),
    ("Música", "DJ, grupo o banda", False),
    ("Música", "Hora loca o animación", False),
    ("Música", "Audio e iluminación", False),
    ("Foto y video", "Fotografía", False),
    ("Foto y video", "Video", False),
    ("Foto y video", "Álbum o entrega digital", False),
    ("Flores y decoración", "Decoración de la ceremonia", False),
    ("Flores y decoración", "Centros de mesa", False),
    ("Flores y decoración", "Iluminación decorativa", False),
    ("Invitaciones", "Save the date", False),
    ("Invitaciones", "Invitaciones", False),
    ("Invitaciones", "Señalética y menús impresos", False),
    ("Vestuario", "Vestido o traje", False),
    ("Vestuario", "Accesorios", False),
    ("Belleza", "Maquillaje y peinado", False),
    ("Belleza", "Prueba de belleza", False),
    ("Transporte", "Traslado de la pareja", False),
    ("Transporte", "Traslado de invitados", False),
    ("Mobiliario", "Renta de mesas, sillas y lounge", False),
    ("Mobiliario", "Mantelería y loza", False),
    ("Recuerdos", "Recuerdos por persona", True),
    ("Coordinación", "Coordinación del día", False),
    ("Coordinación", "Maestro de ceremonias", False),
]

EXTRA_PRES = 12
INV_FILAS = 100
EXTRA_PROV = 12
EXTRA_TAREAS = 8
EXTRA_MENU = 8
MESAS = 20

RSVP = ["Pendiente", "Confirmado", "Rechazado"]
LADOS = ["Novia", "Novio", "Ambos", "Otro"]
INVITACION = ["No enviada", "Enviada", "Entregada"]
MENUS = ["Estándar", "Vegetariano", "Vegano", "Sin gluten", "Infantil", "Otro"]
ESTADO_GASTO = [
    "Por cotizar",
    "Cotizado",
    "Apartado",
    "Contratado",
    "Pagado parcial",
    "Pagado",
    "Cancelado",
]
ESTADO_PROVEEDOR = [
    "Por contactar",
    "En conversación",
    "Cotizado",
    "Contratado",
    "Descartado",
]
ESTADO_TAREA = ["Por hacer", "En curso", "Hecho"]
PRIORIDAD = ["Alta", "Media", "Baja"]
SI_NO = ["Sí", "No"]

EJEMPLOS = [
    {
        "nombre": "EJEMPLO · Ana López",
        "grupo": "Familia López",
        "lado": "Novia",
        "relacion": "Hermana",
        "adultos": 2,
        "ninos": 0,
        "invitacion": "Enviada",
        "rsvp": "Confirmado",
        "menu": "Estándar",
        "mesa": 1,
    },
    {
        "nombre": "EJEMPLO · Luis Pérez",
        "grupo": "Familia López",
        "lado": "Novio",
        "relacion": "Amigo",
        "adultos": 1,
        "ninos": 0,
        "invitacion": "Enviada",
        "rsvp": "Pendiente",
        "menu": "Estándar",
        "mesa": 1,
    },
    {
        "nombre": "EJEMPLO · Maya Ruiz",
        "grupo": "Familia Ruiz",
        "lado": "Novia",
        "relacion": "Prima",
        "adultos": 2,
        "ninos": 1,
        "invitacion": "Entregada",
        "rsvp": "Confirmado",
        "menu": "Vegetariano",
        "mesa": 2,
    },
    {
        "nombre": "EJEMPLO · Jorge Díaz",
        "grupo": "Trabajo",
        "lado": "Novio",
        "relacion": "Compañero de trabajo",
        "adultos": 1,
        "ninos": 0,
        "invitacion": "Enviada",
        "rsvp": "Rechazado",
        "menu": "Estándar",
        "mesa": None,
    },
]

TAREAS = [
    ("Con 12 meses", "Definir la fecha y la ciudad", 365, "Alta"),
    ("Con 12 meses", "Acordar el presupuesto total", 360, "Alta"),
    ("Con 12 meses", "Hacer la lista preliminar de invitados", 340, "Alta"),
    ("Con 12 meses", "Visitar y apartar el lugar", 300, "Alta"),
    ("De 6 a 9 meses", "Definir el estilo de la fiesta", 270, "Media"),
    ("De 6 a 9 meses", "Contratar el banquete", 240, "Alta"),
    ("De 6 a 9 meses", "Contratar la música", 240, "Alta"),
    ("De 6 a 9 meses", "Contratar foto y video", 210, "Media"),
    ("De 6 a 9 meses", "Elegir vestuario y agendar pruebas", 210, "Media"),
    ("De 6 a 9 meses", "Enviar el save the date", 180, "Media"),
    ("De 3 a 6 meses", "Cerrar menú, barra y opción para niños", 150, "Alta"),
    ("De 3 a 6 meses", "Encargar el pastel", 140, "Media"),
    ("De 3 a 6 meses", "Contratar flores y decoración", 120, "Media"),
    ("De 3 a 6 meses", "Diseñar invitaciones y señalética", 120, "Media"),
    ("De 3 a 6 meses", "Definir alojamiento para quien viene de fuera", 120, "Baja"),
    ("De 3 a 6 meses", "Armar el primer plan de mesas", 100, "Media"),
    ("De 1 a 3 meses", "Enviar las invitaciones", 75, "Alta"),
    ("De 1 a 3 meses", "Confirmar horarios con cada proveedor", 60, "Alta"),
    ("De 1 a 3 meses", "Hacer la prueba de maquillaje y peinado", 45, "Media"),
    ("De 1 a 3 meses", "Elegir la playlist y el orden de momentos", 45, "Media"),
    ("De 1 a 3 meses", "Comprar detalles y separar propinas", 40, "Baja"),
    ("Último mes", "Cerrar las respuestas de la lista", 30, "Alta"),
    ("Último mes", "Pasar el número final al banquete", 21, "Alta"),
    ("Último mes", "Revisar saldos y fechas de pago", 21, "Alta"),
    ("Último mes", "Confirmar el transporte", 14, "Media"),
    ("Último mes", "Cerrar el plano de mesas", 14, "Alta"),
    ("Último mes", "Imprimir menús, lugares y horario", 10, "Media"),
    ("Último mes", "Recorrer el lugar o hacer un ensayo", 7, "Media"),
    ("Semana de la fiesta", "Confirmar el horario final con cada proveedor", 5, "Alta"),
    ("Semana de la fiesta", "Preparar el kit de emergencia", 4, "Media"),
    ("Semana de la fiesta", "Entregar el horario a quien coordina", 2, "Alta"),
    ("Semana de la fiesta", "Separar pagos, propinas y documentos", 1, "Alta"),
    ("El día", "Nombrar a quien resuelve imprevistos", 0, "Alta"),
    ("El día", "Comer algo antes de recibir invitados", 0, "Media"),
]

MENU_FILAS = [
    ("Cóctel", "Bocadillos salados", "Algo para picar al llegar"),
    ("Cóctel", "Estación para picar", "Quesos, fruta o lo que prefieran"),
    ("Cena", "Entrada", ""),
    ("Cena", "Plato fuerte", ""),
    ("Cena", "Opción vegetariana", "Cuadra este plato con el conteo de la derecha"),
    ("Cena", "Plato para niños", ""),
    ("Postre", "Pastel", "Piensa en una rebanada por persona"),
    ("Postre", "Mesa de postres", "Opcional"),
    ("Barra", "Trago de bienvenida", ""),
    ("Barra", "Bebidas de la cena", ""),
    ("Barra", "Brindis", ""),
    ("Barra", "Después de la cena", ""),
]

HORARIO = [
    (time(15, 0), "Llegan los invitados", 30),
    (time(15, 30), "Ceremonia", 40),
    (time(16, 10), "Fotos y cóctel", 80),
    (time(17, 30), "Entrada a la fiesta", 15),
    (time(17, 45), "Brindis", 15),
    (time(18, 0), "Cena", 75),
    (time(19, 15), "Pastel y baile de apertura", 25),
    (time(19, 40), "Baile", 90),
    (time(21, 10), "Hora loca", 50),
    (time(22, 0), "Cierre y despedida", 30),
]

# Layout fijo. Las fórmulas de otras hojas apuntan a estas celdas.
PRES_HEADER = 7
PRES_FIRST = 8
PRES_LAST = PRES_FIRST + len(CONCEPTOS) + EXTRA_PRES - 1
PRES_TOTAL = PRES_LAST + 1

INV_HEADER = 7
INV_FIRST = 8
INV_LAST = INV_FIRST + INV_FILAS - 1

PROV_HEADER = 7
PROV_FIRST = 8
PROV_LAST = PROV_FIRST + len(CATEGORIAS) + EXTRA_PROV - 1

TASK_HEADER = 7
TASK_FIRST = 8
TASK_LAST = TASK_FIRST + len(TAREAS) + EXTRA_TAREAS - 1

MENU_HEADER = 7
MENU_FIRST = 8
MENU_LAST = MENU_FIRST + len(MENU_FILAS) + EXTRA_MENU - 1

MESA_HEADER = 7
MESA_FIRST = 8
MESA_LAST = MESA_FIRST + MESAS - 1

HORA_HEADER = 7
HORA_FIRST = 8
HORA_LAST = HORA_FIRST + len(HORARIO) + 6 - 1

CAT_HEADER = 7
CAT_FIRST = 8
CAT_LAST = CAT_FIRST + len(CATEGORIAS) - 1
CAT_OTRA = CAT_LAST + 1
CAT_RESERVA = CAT_OTRA + 1


def fill(hex_color: str) -> PatternFill:
    return PatternFill("solid", fgColor=hex_color)


def font(size=11, bold=False, color=INK, italic=False) -> Font:
    return Font(name=CAL, size=size, bold=bold, color=color, italic=italic)


def side(color=LINE, style="thin") -> Side:
    return Side(style=style, color=color)


def box(color=LINE) -> Border:
    edge = side(color)
    return Border(left=edge, right=edge, top=edge, bottom=edge)


def align(horizontal="left", wrap=False, indent=0) -> Alignment:
    return Alignment(horizontal=horizontal, vertical="center", wrap_text=wrap, indent=indent)


def comment(text: str, height=70) -> Comment:
    return Comment(text, "Plan", width=280, height=height)


def apply_widths(ws, widths: dict) -> None:
    for col, width in widths.items():
        ws.column_dimensions[col].width = width


def banner(ws, title: str, subtitle: str, last_col: int, tab: str) -> None:
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=last_col)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=last_col)
    title_cell = ws.cell(1, 1, title)
    title_cell.font = font(20, bold=True, color=WHITE)
    title_cell.alignment = align(indent=1)
    sub = ws.cell(2, 1, subtitle)
    sub.font = font(11, color=MUTED)
    sub.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True, indent=1)
    for col in range(1, last_col + 1):
        ws.cell(1, col).fill = fill(WINE)
        ws.cell(2, col).fill = fill(BLUSH)
    ws.row_dimensions[1].height = 36
    ws.row_dimensions[2].height = 34
    ws.row_dimensions[3].height = 10
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 110
    ws.sheet_properties.tabColor = tab
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.horizontalCentered = True
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.5, right=0.5, top=0.55, bottom=0.5, header=0.2, footer=0.25)
    ws.oddFooter.left.text = "Plan de la fiesta de boda"
    ws.oddFooter.right.text = "Página &P de &N"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    ws.page_setup.horizontalCentered = True
    ws.sheet_format.defaultRowHeight = 18


def write_headers(ws, row: int, headers: list[str]) -> None:
    ws.row_dimensions[row].height = 32
    for col, text in enumerate(headers, start=1):
        cell = ws.cell(row, col, text)
        cell.font = font(10, bold=True, color=WHITE)
        cell.fill = fill(WINE)
        cell.alignment = align("center", wrap=True)
        cell.border = box(WINE)


def mark_input(cell, fmt=None, horizontal="left") -> None:
    cell.fill = fill(INPUT_BG)
    cell.font = font(11)
    cell.alignment = align(horizontal, indent=1 if horizontal == "left" else 0)
    cell.border = box()
    if fmt:
        cell.number_format = fmt


def mark_formula(cell, fmt=None) -> None:
    cell.fill = fill(FORMULA_BG)
    cell.font = font(11)
    cell.alignment = align("right")
    cell.border = box(HAIR)
    if fmt:
        cell.number_format = fmt


def mark_text(cell) -> None:
    cell.font = font(11)
    cell.alignment = align(wrap=True, indent=1)
    cell.border = box(HAIR)


def add_list_validation(ws, sqref: str, formula: str, error: str, strict=True) -> None:
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    dv.showInputMessage = False
    dv.showErrorMessage = strict
    dv.errorTitle = "Elige una opción"
    dv.error = error
    dv.add(sqref)
    ws.add_data_validation(dv)


def add_number_validation(ws, sqref: str, kind: str, error: str) -> None:
    dv = DataValidation(type=kind, operator="greaterThanOrEqual", formula1="0", allow_blank=True)
    dv.showInputMessage = False
    dv.showErrorMessage = True
    dv.errorTitle = "Revisa el número"
    dv.error = error
    dv.add(sqref)
    ws.add_data_validation(dv)


def paint_status(ws, sqref: str, column_letter: str, mapping: dict[str, tuple[str, str]]) -> None:
    first_cell = sqref.split(":")[0]
    for text, (bg, fg) in mapping.items():
        rule = FormulaRule(
            formula=[f'{column_letter}{first_cell[1:]}="{text}"'],
            fill=fill(bg),
            font=font(11, color=fg),
        )
        ws.conditional_formatting.add(sqref, rule)


def outer_border(ws, r1, c1, r2, c2) -> None:
    edge = side()
    for row in range(r1, r2 + 1):
        for col in range(c1, c2 + 1):
            cell = ws.cell(row, col)
            current = cell.border
            cell.border = Border(
                left=edge if col == c1 else current.left,
                right=edge if col == c2 else current.right,
                top=edge if row == r1 else current.top,
                bottom=edge if row == r2 else current.bottom,
            )


def panel(ws, r1, c1, r2, c2, title: str) -> None:
    ws.merge_cells(start_row=r1, start_column=c1, end_row=r1, end_column=c2)
    for row in range(r1, r2 + 1):
        for col in range(c1, c2 + 1):
            ws.cell(row, col).fill = fill(CREAM)
    header = ws.cell(r1, c1, title)
    header.font = font(12, bold=True, color=WINE)
    header.alignment = align(indent=1)
    header.fill = fill(SAND)
    for col in range(c1, c2 + 1):
        ws.cell(r1, col).fill = fill(SAND)
    ws.row_dimensions[r1].height = 24


def cantidad_usada(ajuste, por_persona, previstos):
    if ajuste not in ("", None):
        return ajuste
    if por_persona == "Sí":
        return "" if previstos in ("", None) else previstos
    return ""


def saldo_concepto(estimado, contratado, pagado):
    if estimado in ("", None) and contratado in ("", None) and pagado in ("", None):
        return ""
    base = contratado if contratado not in ("", None) else (estimado or 0)
    return (base or 0) - (pagado or 0)


def saldo_proveedor(cotizacion, anticipo, pagado):
    if cotizacion in ("", None) and anticipo in ("", None) and pagado in ("", None):
        return ""
    descuento = anticipo if pagado in ("", None) else pagado
    return (cotizacion or 0) - (descuento or 0)


def total_personas(adultos, ninos):
    if adultos in ("", None) and ninos in ("", None):
        return ""
    return (adultos or 0) + (ninos or 0)


def personas_que_asisten(rsvp, total):
    if rsvp in ("", None, "Pendiente"):
        return ""
    if rsvp == "Rechazado":
        return 0
    if rsvp == "Confirmado":
        return "" if total == "" else total
    return ""


def resumen_ejemplos() -> dict:
    lista = confirmadas = pendientes = rechazadas = 0
    for fila in EJEMPLOS:
        total = total_personas(fila["adultos"], fila["ninos"])
        lista += total
        if fila["rsvp"] == "Confirmado":
            confirmadas += total
        elif fila["rsvp"] == "Pendiente":
            pendientes += total
        elif fila["rsvp"] == "Rechazado":
            rechazadas += total
    return {
        "lista": lista,
        "confirmadas": confirmadas,
        "pendientes": pendientes,
        "rechazadas": rechazadas,
    }


def construir() -> Workbook:
    wb = Workbook()
    listas = wb.active
    listas.title = "Listas"
    rangos = construir_listas(listas)

    inicio = wb.create_sheet("Inicio", 0)
    presupuesto = wb.create_sheet("Presupuesto", 1)
    invitados = wb.create_sheet("Invitados", 2)
    mesas = wb.create_sheet("Mesas", 3)
    menu = wb.create_sheet("Menú", 4)
    proveedores = wb.create_sheet("Proveedores", 5)
    tareas = wb.create_sheet("Tareas", 6)
    horario = wb.create_sheet("Horario", 7)
    guia = wb.create_sheet("Guía", 8)

    construir_inicio(inicio)
    construir_presupuesto(presupuesto, rangos)
    construir_invitados(invitados, rangos)
    construir_mesas(mesas)
    construir_menu(menu)
    construir_proveedores(proveedores, rangos)
    construir_tareas(tareas, rangos)
    construir_horario(horario, rangos)
    construir_guia(guia)
    agregar_grafico(inicio, presupuesto)
    definir_nombres(wb)

    wb.active = inicio
    wb.properties.title = "Plan de la fiesta de boda"
    wb.properties.subject = "Presupuesto, invitados, mesas, menú, proveedores y horario"
    wb.properties.creator = "Plan de la fiesta de boda"
    wb.properties.description = "Hoja de cálculo para planificar una fiesta de boda."
    wb.calculation.calcMode = "auto"
    wb.calculation.fullCalcOnLoad = True
    listas.sheet_state = "hidden"
    return wb


def construir_listas(ws) -> dict[str, str]:
    ws.sheet_properties.tabColor = "C8BDB4"
    ws["A1"] = "Estas listas alimentan los menús desplegables. No hace falta editar esta hoja."
    ws["A1"].font = font(11, color=MUTED)
    columnas = {
        "categorias": (1, CATEGORIAS),
        "rsvp": (2, RSVP),
        "lados": (3, LADOS),
        "invitacion": (4, INVITACION),
        "menus": (5, MENUS),
        "estado_gasto": (6, ESTADO_GASTO),
        "estado_proveedor": (7, ESTADO_PROVEEDOR),
        "estado_tarea": (8, ESTADO_TAREA),
        "prioridad": (9, PRIORIDAD),
        "si_no": (10, SI_NO),
        "mesas": (11, list(range(1, MESAS + 1))),
    }
    rangos = {}
    for key, (col, values) in columnas.items():
        letter = get_column_letter(col)
        ws.cell(1, col).font = font(10, bold=True, color=WINE)
        for offset, value in enumerate(values):
            cell = ws.cell(2 + offset, col, value)
            cell.font = font(11)
        rangos[key] = f"=Listas!${letter}$2:${letter}${1 + len(values)}"
        ws.column_dimensions[letter].width = 24
    ws.column_dimensions["A"].width = 28
    return rangos


def construir_inicio(ws) -> None:
    banner(
        ws,
        "Plan de la fiesta de boda",
        "Llena las celdas claras. Los totales salen solos. Si aparecen invitados, son cuatro filas de ejemplo: bórralas en Invitados.",
        8,
        WINE,
    )
    ws.page_setup.fitToHeight = 1
    ws.row_dimensions[2].height = 32
    panel(ws, 4, 1, 17, 2, "Datos de la fiesta")
    panel(ws, 4, 4, 17, 5, "Invitados y avance")
    panel(ws, 4, 7, 17, 8, "Presupuesto")

    datos = [
        (5, "Pareja", None, None),
        (6, "Fecha de la fiesta", DATE_FMT, "date"),
        (7, "Ciudad", None, None),
        (8, "Lugar de la ceremonia", None, None),
        (9, "Lugar de la recepción", None, None),
        (10, "Hora de inicio", TIME_FMT, None),
        (11, "Invitados previstos", INT, "whole"),
        (12, "Presupuesto total", MONEY, "decimal"),
        (13, "Moneda", None, "moneda"),
        (14, "Reserva para imprevistos", PCT, "reserva"),
        (15, "Persona para imprevistos", None, None),
        (16, "Teléfono de esa persona", "@", None),
    ]
    for row, label, fmt, kind in datos:
        label_cell = ws.cell(row, 1, label)
        label_cell.font = font(11, color=MUTED)
        label_cell.alignment = align(indent=1)
        label_cell.fill = fill(CREAM)
        value = ws.cell(row, 2, "MXN" if kind == "moneda" else (0.10 if kind == "reserva" else None))
        mark_input(value, fmt, "right" if fmt in (MONEY, INT, PCT, DATE_FMT, TIME_FMT) else "left")
        ws.row_dimensions[row].height = 22

    ws["B6"].comment = comment("Escríbela como día/mes/año. Las tareas calculan su fecha con esta celda.")
    ws["B11"].comment = comment(
        "Es el número que usan los gastos marcados por persona, cuando dejas Ajuste vacío.",
        80,
    )
    ws["B12"].comment = comment("Tope de lo que quieres gastar, en la moneda de la celda de abajo.")
    ws["B14"].comment = comment("Porcentaje del presupuesto que se aparta para imprevistos. 10% es un buen inicio.")
    ws["B15"].comment = comment("Alguien que no sea de la pareja y pueda resolver pagos o cambios ese día.")

    dv_prev = DataValidation(type="whole", operator="greaterThanOrEqual", formula1="0", allow_blank=True)
    dv_prev.errorTitle = "Invitados"
    dv_prev.error = "Escribe el número de personas que esperas, o deja la celda vacía."
    dv_prev.add("B11")
    ws.add_data_validation(dv_prev)

    dv_money = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True)
    dv_money.errorTitle = "Presupuesto"
    dv_money.error = "Escribe un monto igual o mayor que cero."
    dv_money.add("B12")
    ws.add_data_validation(dv_money)

    dv_reserva = DataValidation(type="decimal", operator="between", formula1="0", formula2="0.5", allow_blank=True)
    dv_reserva.errorTitle = "Reserva"
    dv_reserva.error = "Usa un porcentaje entre 0% y 50%."
    dv_reserva.add("B14")
    ws.add_data_validation(dv_reserva)

    dv_fecha = DataValidation(type="date", operator="greaterThan", formula1="DATE(2000,1,1)", allow_blank=True)
    dv_fecha.errorTitle = "Fecha"
    dv_fecha.error = "Escribe una fecha, por ejemplo 20/06/2027."
    dv_fecha.add("B6")
    ws.add_data_validation(dv_fecha)

    invitados_kpis = [
        (5, "En la lista", f"=SUM(Invitados!I{INV_FIRST}:I{INV_LAST})", INT),
        (6, "Confirmadas", f'=SUMIF(Invitados!K{INV_FIRST}:K{INV_LAST},"Confirmado",Invitados!I{INV_FIRST}:I{INV_LAST})', INT),
        (7, "Sin respuesta", f'=SUMIF(Invitados!K{INV_FIRST}:K{INV_LAST},"Pendiente",Invitados!I{INV_FIRST}:I{INV_LAST})', INT),
        (8, "No asisten", f'=SUMIF(Invitados!K{INV_FIRST}:K{INV_LAST},"Rechazado",Invitados!I{INV_FIRST}:I{INV_LAST})', INT),
    ]
    for row, label, formula, fmt in invitados_kpis:
        lab = ws.cell(row, 4, label)
        lab.font = font(11, color=MUTED)
        lab.alignment = align(indent=1)
        lab.fill = fill(CREAM)
        val = ws.cell(row, 5, formula)
        val.font = font(16, bold=True)
        val.alignment = align("right")
        val.number_format = fmt
        val.fill = fill(CREAM)

    ws.merge_cells("D16:E17")
    aviso = ws["D16"]
    aviso.value = (
        f'=IF(E5=0,"",IF(E5=E6+E7+E8,"La lista cuadra","Revisa filas sin RSVP o sin número de personas"))'
    )
    aviso.font = font(10, color=MUTED)
    aviso.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True, indent=1)
    aviso.fill = fill(CREAM)
    ws.conditional_formatting.add(
        "D16",
        FormulaRule(formula=['D16="La lista cuadra"'], fill=fill(SAGE_BG), font=font(10, color=SAGE)),
    )
    ws.conditional_formatting.add(
        "D16",
        FormulaRule(
            formula=['AND(E5>0,D16<>"La lista cuadra")'],
            fill=fill(GOLD_BG),
            font=font(10, color=GOLD),
        ),
    )

    separador = ws.cell(9, 4, "Tareas")
    separador.font = font(11, bold=True, color=WINE)
    separador.alignment = align(indent=1)
    separador.fill = fill(CREAM)
    ws.cell(9, 5).fill = fill(CREAM)
    hechas = f'COUNTIF(Tareas!G{TASK_FIRST}:G{TASK_LAST},"Hecho")'
    total_tareas = f"COUNTA(Tareas!B{TASK_FIRST}:B{TASK_LAST})"
    tareas_kpis = [
        (10, "Tareas hechas", f'=IF({total_tareas}=0,"",{hechas}&" de "&{total_tareas})', None, 14),
        (11, "Avance", f'=IF({total_tareas}=0,"",{hechas}/{total_tareas})', PCT, 14),
        (12, "Días restantes", '=IF(B6="","",B6-TODAY())', INT, 20),
    ]
    for row, label, formula, fmt, size in tareas_kpis:
        lab = ws.cell(row, 4, label)
        lab.font = font(11, color=MUTED)
        lab.alignment = align(indent=1)
        lab.fill = fill(CREAM)
        val = ws.cell(row, 5, formula)
        val.font = font(size, bold=True, color=WINE if row == 12 else INK)
        val.alignment = align("right")
        val.fill = fill(CREAM)
        if fmt:
            val.number_format = fmt
    ws.conditional_formatting.add(
        "E11",
        DataBarRule(
            start_type="num",
            start_value=0,
            end_type="num",
            end_value=1,
            color=WINE,
            showValue=True,
        ),
    )

    dinero = [
        (5, "Presupuesto", "=B12", MONEY, 16, False),
        (6, "Conceptos", f"=Presupuesto!G{PRES_TOTAL}", MONEY, 14, False),
        (7, None, '=IF(B12="","",B12*IF(B14="",0,B14))', MONEY, 14, False),
        (8, "Estimado con reserva", "=N(H6)+N(H7)", MONEY, 16, True),
        (9, "Pagado", f"=Presupuesto!I{PRES_TOTAL}", MONEY, 14, False),
        (10, "Por pagar", f"=Presupuesto!J{PRES_TOTAL}", MONEY, 14, False),
        (11, "Disponible", '=IF(B12="","",B12-N(H8))', MONEY, 20, True),
        (12, "Por persona, sin reserva", '=IF(OR(B11="",B11=0,H6=0),"",H6/B11)', MONEY, 14, False),
        (
            13,
            "Estado",
            '=IF(B12="","Falta el presupuesto",IF(H8>B12,"Por encima del presupuesto",IF(H8>=B12*0.9,"Cerca del límite","Dentro del presupuesto")))',
            None,
            12,
            True,
        ),
    ]
    for row, label, formula, fmt, size, strong in dinero:
        if label:
            lab = ws.cell(row, 7, label)
            lab.font = font(11, color=MUTED)
            lab.alignment = align(indent=1)
            lab.fill = fill(CREAM)
        val = ws.cell(row, 8, formula)
        val.font = font(size, bold=strong, color=INK)
        val.alignment = align("left" if row == 13 else "right", wrap=row == 13)
        val.fill = fill(CREAM)
        if fmt:
            val.number_format = fmt
    ws["G7"] = '=IF(B14="","Reserva","Reserva ("&TEXT(B14,"0%")&")")'
    ws["G7"].font = font(11, color=MUTED)
    ws["G7"].alignment = align(indent=1)
    ws["G7"].fill = fill(CREAM)

    ws.merge_cells("G17:H17")
    moneda = ws["G17"]
    moneda.value = '=IF(B13="","","Montos en "&B13)'
    moneda.font = font(10, color=MUTED)
    moneda.alignment = align(indent=1)
    moneda.fill = fill(CREAM)

    for row in range(5, 18):
        ws.row_dimensions[row].height = 22
    ws.row_dimensions[11].height = 24
    ws.row_dimensions[12].height = 28
    ws.row_dimensions[16].height = 18
    ws.row_dimensions[17].height = 18

    ws.conditional_formatting.add(
        "H11",
        FormulaRule(formula=['AND(B12<>"",H11<0)'], fill=fill(RED_BG), font=font(20, bold=True, color=RED), stopIfTrue=True),
    )
    ws.conditional_formatting.add(
        "H13",
        FormulaRule(formula=['H13="Dentro del presupuesto"'], fill=fill(SAGE_BG), font=font(12, bold=True, color=SAGE)),
    )
    ws.conditional_formatting.add(
        "H13",
        FormulaRule(formula=['H13="Cerca del límite"'], fill=fill(GOLD_BG), font=font(12, bold=True, color=GOLD)),
    )
    ws.conditional_formatting.add(
        "H13",
        FormulaRule(formula=['H13="Por encima del presupuesto"'], fill=fill(RED_BG), font=font(12, bold=True, color=RED)),
    )
    ws.conditional_formatting.add(
        "H13",
        FormulaRule(formula=['H13="Falta el presupuesto"'], fill=fill(GOLD_BG), font=font(12, color=GOLD)),
    )

    outer_border(ws, 4, 1, 17, 2)
    outer_border(ws, 4, 4, 17, 5)
    outer_border(ws, 4, 7, 17, 8)
    ws.freeze_panes = "A4"
    apply_widths(ws, {"A": 28, "B": 34, "C": 3, "D": 24, "E": 16, "F": 3, "G": 26, "H": 32})
    ws.sheet_view.zoomScale = 110
    seleccionar(ws, "B5")


def seleccionar(ws, coord: str) -> None:
    view = ws.views.sheetView[0]
    if view.selection:
        view.selection[0].activeCell = coord
        view.selection[0].sqref = coord


def construir_presupuesto(ws, rangos: dict) -> None:
    banner(
        ws,
        "Presupuesto",
        "Escribe costos en las celdas claras. Si el gasto es por persona y Ajuste está vacío, la cantidad son los invitados previstos. El saldo usa Contratado; si está vacío, usa el estimado.",
        13,
        "8C6A3D",
    )
    ws.print_title_rows = "1:7"
    strip = [
        (4, 1, "Conceptos", f"=G{PRES_TOTAL}"),
        (4, 5, "Contratado", f"=H{PRES_TOTAL}"),
        (4, 9, "Pagado", f"=I{PRES_TOTAL}"),
        (5, 1, "Saldo de conceptos", f"=J{PRES_TOTAL}"),
        (5, 5, "Reserva", "=Inicio!H7"),
        (5, 9, "Estimado con reserva", f"=N(G{PRES_TOTAL})+N(Inicio!H7)"),
    ]
    for row, col, label, formula in strip:
        ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + 1)
        ws.merge_cells(start_row=row, start_column=col + 2, end_row=row, end_column=col + 3)
        lab = ws.cell(row, col, label)
        lab.font = font(10, color=MUTED)
        lab.alignment = align(indent=1)
        lab.fill = fill(BLUSH)
        ws.cell(row, col + 1).fill = fill(BLUSH)
        val = ws.cell(row, col + 2, formula)
        val.font = font(14, bold=True)
        val.number_format = MONEY
        val.alignment = align("right")
        val.fill = fill(BLUSH)
        ws.cell(row, col + 3).fill = fill(BLUSH)
        ws.cell(row, col + 3).number_format = MONEY
        ws.row_dimensions[row].height = 24
    ws.row_dimensions[6].height = 20
    ws.merge_cells("O6:R6")
    titulo_resumen = ws["O6"]
    titulo_resumen.value = "Resumen por categoría"
    titulo_resumen.font = font(11, bold=True, color=WINE)
    titulo_resumen.alignment = align(indent=1)

    headers = [
        "Categoría",
        "Concepto",
        "Por persona",
        "Ajuste",
        "Cantidad",
        "Costo unitario",
        "Estimado",
        "Contratado",
        "Pagado",
        "Saldo",
        "Estado",
        "Fecha de pago",
        "Notas",
    ]
    write_headers(ws, PRES_HEADER, headers)
    ws.cell(PRES_HEADER, 4).comment = comment(
        "Opcional. Si escribes un número, se usa en lugar de los invitados previstos.",
        75,
    )
    ws.cell(PRES_HEADER, 5).comment = comment("Esta columna se calcula. No hace falta escribirla.")
    ws.cell(PRES_HEADER, 10).comment = comment(
        "Si hay monto contratado, el saldo es contratado menos pagado. Si no, es estimado menos pagado.",
        85,
    )

    for offset in range(PRES_LAST - PRES_FIRST + 1):
        row = PRES_FIRST + offset
        concepto = CONCEPTOS[offset] if offset < len(CONCEPTOS) else None
        ws.row_dimensions[row].height = 20
        if concepto:
            ws.cell(row, 1, concepto[0])
            ws.cell(row, 2, concepto[1])
            ws.cell(row, 3, "Sí" if concepto[2] else "No")
        for col in (1, 2, 3, 4, 6, 8, 9, 11, 12, 13):
            cell = ws.cell(row, col)
            if col in (6, 8, 9):
                mark_input(cell, MONEY, "right")
            elif col == 4:
                mark_input(cell, '#,##0.00', "right")
            elif col == 12:
                mark_input(cell, DATE_FMT, "right")
            elif col == 13:
                mark_input(cell, horizontal="left")
            else:
                mark_input(cell)
        for col, fmt in ((5, '#,##0.00'), (7, MONEY), (10, MONEY)):
            mark_formula(ws.cell(row, col), fmt)
        ws.cell(row, 5).value = (
            f'=IF(D{row}<>"",D{row},IF(C{row}="Sí",IF(InvitadosPrevistos="", "",InvitadosPrevistos),""))'
        )
        ws.cell(row, 7).value = f'=IF(OR(E{row}="",F{row}=""),"",E{row}*F{row})'
        ws.cell(row, 10).value = (
            f'=IF(AND(G{row}="",H{row}="",I{row}=""),"",IF(H{row}="",N(G{row}),N(H{row}))-N(I{row}))'
        )

    ws.cell(PRES_FIRST, 6).comment = comment(
        "Ejemplo: si el banquete cuesta 850 por persona, escríbelo aquí. La cantidad ya sale de Inicio.",
        80,
    )

    ws.row_dimensions[PRES_TOTAL].height = 24
    ws.cell(PRES_TOTAL, 1, "Total")
    ws.cell(PRES_TOTAL, 2, "Total de conceptos")
    for col in range(1, 14):
        cell = ws.cell(PRES_TOTAL, col)
        cell.fill = fill(SAND)
        cell.font = font(11, bold=True, color=WINE)
        cell.border = box(LINE)
        cell.alignment = align("right" if col >= 5 else "left", indent=1 if col < 5 else 0)
    for col, letter in ((7, "G"), (8, "H"), (9, "I"), (10, "J")):
        cell = ws.cell(PRES_TOTAL, col, f"=SUM({letter}{PRES_FIRST}:{letter}{PRES_LAST})")
        cell.number_format = MONEY
        cell.font = font(12, bold=True, color=WINE)
        cell.fill = fill(SAND)

    resumen_headers = ["Categoría", "Estimado", "% del presupuesto", "Pagado"]
    for col, text in enumerate(resumen_headers, start=15):
        cell = ws.cell(CAT_HEADER, col, text)
        cell.font = font(10, bold=True, color=WHITE)
        cell.fill = fill(WINE)
        cell.alignment = align("center", wrap=True)
        cell.border = box(WINE)
    for index, categoria in enumerate(CATEGORIAS):
        row = CAT_FIRST + index
        ws.cell(row, 15, categoria).font = font(11)
        ws.cell(row, 16, f'=SUMIF($A${PRES_FIRST}:$A${PRES_LAST},O{row},$G${PRES_FIRST}:$G${PRES_LAST})')
        ws.cell(row, 17, f'=IF(OR(PresupuestoTotal="",PresupuestoTotal=0),"",P{row}/PresupuestoTotal)')
        ws.cell(row, 18, f'=SUMIF($A${PRES_FIRST}:$A${PRES_LAST},O{row},$I${PRES_FIRST}:$I${PRES_LAST})')
    ws.cell(CAT_OTRA, 15, "Sin categoría")
    ws.cell(CAT_OTRA, 16, f"=SUM($G${PRES_FIRST}:$G${PRES_LAST})-SUM($P${CAT_FIRST}:$P${CAT_LAST})")
    ws.cell(CAT_OTRA, 17, f'=IF(OR(PresupuestoTotal="",PresupuestoTotal=0),"",P{CAT_OTRA}/PresupuestoTotal)')
    ws.cell(CAT_OTRA, 18, f"=SUM($I${PRES_FIRST}:$I${PRES_LAST})-SUM($R${CAT_FIRST}:$R${CAT_LAST})")
    ws.cell(CAT_RESERVA, 15, "Reserva")
    ws.cell(CAT_RESERVA, 16, "=Inicio!H7")
    ws.cell(CAT_RESERVA, 17, f'=IF(OR(PresupuestoTotal="",PresupuestoTotal=0),"",P{CAT_RESERVA}/PresupuestoTotal)')
    ws.cell(CAT_RESERVA, 18, 0)
    for row in range(CAT_FIRST, CAT_RESERVA + 1):
        ws.cell(row, 15).alignment = align(indent=1)
        ws.cell(row, 15).border = box(HAIR)
        for col, fmt in ((16, MONEY), (17, "0.0%"), (18, MONEY)):
            cell = ws.cell(row, col)
            mark_formula(cell, fmt)
            cell.border = box(HAIR)
        if row in (CAT_OTRA, CAT_RESERVA):
            ws.cell(row, 15).font = font(11, bold=True)

    add_list_validation(
        ws,
        f"A{PRES_FIRST}:A{PRES_LAST}",
        rangos["categorias"],
        "Puedes elegir una categoría o escribir otra.",
        strict=False,
    )
    add_list_validation(ws, f"C{PRES_FIRST}:C{PRES_LAST}", rangos["si_no"], "Elige Sí o No.")
    add_list_validation(ws, f"K{PRES_FIRST}:K{PRES_LAST}", rangos["estado_gasto"], "Elige un estado de la lista.")
    add_number_validation(ws, f"D{PRES_FIRST}:D{PRES_LAST}", "decimal", "El ajuste tiene que ser un número igual o mayor que cero.")
    add_number_validation(ws, f"F{PRES_FIRST}:F{PRES_LAST}", "decimal", "El costo unitario tiene que ser igual o mayor que cero.")
    add_number_validation(ws, f"H{PRES_FIRST}:I{PRES_LAST}", "decimal", "El monto tiene que ser igual o mayor que cero.")
    paint_status(
        ws,
        f"K{PRES_FIRST}:K{PRES_LAST}",
        "K",
        {
            "Pagado": (SAGE_BG, SAGE),
            "Pagado parcial": (GOLD_BG, GOLD),
            "Contratado": (SAGE_BG, SAGE),
            "Cancelado": ("F0EBE6", MUTED),
        },
    )
    ws.conditional_formatting.add(
        f"L{PRES_FIRST}:L{PRES_LAST}",
        FormulaRule(
            formula=[f'AND(L{PRES_FIRST}<>"",L{PRES_FIRST}<TODAY(),J{PRES_FIRST}>0)'],
            fill=fill(RED_BG),
            font=font(11, color=RED),
        ),
    )
    ws.conditional_formatting.add(
        f"L{PRES_FIRST}:L{PRES_LAST}",
        FormulaRule(
            formula=[f'AND(L{PRES_FIRST}<>"",L{PRES_FIRST}>=TODAY(),L{PRES_FIRST}<=TODAY()+14,J{PRES_FIRST}>0)'],
            fill=fill(GOLD_BG),
            font=font(11, color=GOLD),
        ),
    )
    ws.conditional_formatting.add(
        f"J{PRES_FIRST}:J{PRES_TOTAL}",
        FormulaRule(formula=[f"J{PRES_FIRST}<0"], fill=fill(RED_BG), font=font(11, color=RED)),
    )
    ws.freeze_panes = "A8"
    apply_widths(
        ws,
        {
            "A": 24,
            "B": 42,
            "C": 14,
            "D": 12,
            "E": 12,
            "F": 16,
            "G": 16,
            "H": 16,
            "I": 14,
            "J": 14,
            "K": 18,
            "L": 16,
            "M": 36,
            "N": 3,
            "O": 24,
            "P": 16,
            "Q": 18,
            "R": 14,
        },
    )
    ws.auto_filter.ref = f"A{PRES_HEADER}:M{PRES_LAST}"
    ws.page_setup.fitToHeight = 0
    ws.oddHeader.left.text = "Presupuesto"


def construir_invitados(ws, rangos: dict) -> None:
    banner(
        ws,
        "Invitados",
        "Borra las filas que empiezan con EJEMPLO. Una fila puede ser una persona o una familia: anota adultos y niños. Si en la misma fila hay menús distintos, sepárala.",
        15,
        SAGE,
    )
    headers = [
        "Nombre",
        "Grupo o familia",
        "Lado",
        "Relación",
        "Teléfono",
        "Correo",
        "Adultos",
        "Niños",
        "Total",
        "Invitación",
        "RSVP",
        "Asisten",
        "Menú",
        "Mesa",
        "Notas",
    ]
    write_headers(ws, INV_HEADER, headers)
    ws.cell(INV_HEADER, 12).comment = comment("Confirmado copia el total. Rechazado queda en cero. Pendiente se deja vacío.")
    for offset in range(INV_FILAS):
        row = INV_FIRST + offset
        ws.row_dimensions[row].height = 20
        ejemplo = EJEMPLOS[offset] if offset < len(EJEMPLOS) else None
        valores = {}
        if ejemplo:
            valores = {
                1: ejemplo["nombre"],
                2: ejemplo["grupo"],
                3: ejemplo["lado"],
                4: ejemplo["relacion"],
                7: ejemplo["adultos"],
                8: ejemplo["ninos"],
                10: ejemplo["invitacion"],
                11: ejemplo["rsvp"],
                13: ejemplo["menu"],
                14: ejemplo["mesa"],
            }
        for col in range(1, 16):
            cell = ws.cell(row, col, valores.get(col))
            if col in (9, 12):
                mark_formula(cell, INT)
            elif col in (7, 8, 14):
                mark_input(cell, INT, "right")
            elif col in (5, 6):
                mark_input(cell)
                if col == 5:
                    cell.number_format = "@"
            else:
                mark_input(cell)
        ws.cell(row, 9).value = f'=IF(AND(G{row}="",H{row}=""),"",N(G{row})+N(H{row}))'
        ws.cell(row, 12).value = (
            f'=IF(OR(K{row}="",K{row}="Pendiente"),"",IF(K{row}="Rechazado",0,IF(K{row}="Confirmado",IF(I{row}="","",I{row}),"")))'
        )
        if ejemplo and valores.get(14) is None:
            ws.cell(row, 14).value = None
        if ejemplo:
            ws.cell(row, 1).fill = fill(GOLD_BG)

    add_list_validation(ws, f"C{INV_FIRST}:C{INV_LAST}", rangos["lados"], "Elige el lado de la invitación.")
    add_list_validation(ws, f"J{INV_FIRST}:J{INV_LAST}", rangos["invitacion"], "Elige el estado de la invitación.")
    add_list_validation(ws, f"K{INV_FIRST}:K{INV_LAST}", rangos["rsvp"], "Elige Pendiente, Confirmado o Rechazado.")
    add_list_validation(ws, f"M{INV_FIRST}:M{INV_LAST}", rangos["menus"], "Elige el menú de esa fila.")
    add_list_validation(ws, f"N{INV_FIRST}:N{INV_LAST}", rangos["mesas"], "Elige el número de mesa.")
    add_number_validation(ws, f"G{INV_FIRST}:H{INV_LAST}", "whole", "Escribe un número entero o deja la celda vacía.")
    paint_status(
        ws,
        f"K{INV_FIRST}:K{INV_LAST}",
        "K",
        {"Confirmado": (SAGE_BG, SAGE), "Pendiente": (GOLD_BG, GOLD), "Rechazado": (RED_BG, RED)},
    )
    ws.auto_filter.ref = f"A{INV_HEADER}:O{INV_LAST}"
    ws.freeze_panes = "A8"
    ws.print_title_rows = "1:7"
    apply_widths(
        ws,
        {
            "A": 28,
            "B": 22,
            "C": 14,
            "D": 24,
            "E": 16,
            "F": 28,
            "G": 12,
            "H": 12,
            "I": 12,
            "J": 16,
            "K": 16,
            "L": 12,
            "M": 16,
            "N": 10,
            "O": 28,
        },
    )


def construir_mesas(ws) -> None:
    banner(
        ws,
        "Mesas",
        "Escribe la capacidad solo de las mesas que vas a usar. Asigna ese mismo número en Invitados. Apartados no cuenta a quien rechazó. Las mesas 1 y 2 traen una capacidad de ejemplo.",
        7,
        SAGE,
    )
    resumen = [
        (4, 1, "Lugares", f"=SUM(C{MESA_FIRST}:C{MESA_LAST})"),
        (4, 3, "Apartados", f"=SUM(D{MESA_FIRST}:D{MESA_LAST})"),
        (4, 5, "Confirmados", f"=SUM(E{MESA_FIRST}:E{MESA_LAST})"),
        (5, 1, "Mesas en uso", f'=COUNTIF(C{MESA_FIRST}:C{MESA_LAST},">0")'),
        (5, 3, "Libres", f"=SUM(F{MESA_FIRST}:F{MESA_LAST})"),
    ]
    for row, col, label, formula in resumen:
        lab = ws.cell(row, col, label)
        lab.font = font(10, color=MUTED)
        lab.alignment = align(indent=1)
        val = ws.cell(row, col + 1, formula)
        val.font = font(14, bold=True)
        val.number_format = INT
        val.alignment = align("right")
    for col in range(1, 8):
        ws.cell(4, col).fill = fill(BLUSH)
        ws.cell(5, col).fill = fill(BLUSH)
        ws.cell(4, col).border = Border()
        ws.cell(5, col).border = Border()
    ws.row_dimensions[4].height = 24
    ws.row_dimensions[5].height = 24
    ws.row_dimensions[6].height = 8

    write_headers(ws, MESA_HEADER, ["Mesa", "Nombre", "Capacidad", "Apartados", "Confirmados", "Libres", "Notas"])
    for index in range(MESAS):
        row = MESA_FIRST + index
        numero = index + 1
        ws.row_dimensions[row].height = 20
        ws.cell(row, 1, numero)
        mark_formula(ws.cell(row, 1), INT)
        mark_input(ws.cell(row, 2))
        mark_input(ws.cell(row, 3), INT, "right")
        mark_formula(ws.cell(row, 4), INT)
        mark_formula(ws.cell(row, 5), INT)
        mark_formula(ws.cell(row, 6), INT)
        mark_input(ws.cell(row, 7))
        if numero in (1, 2):
            ws.cell(row, 3).value = 8
            ws.cell(row, 7).value = "Capacidad de ejemplo. Cámbiala o bórrala."
        ws.cell(row, 4).value = (
            f'=SUMIF(Invitados!$N${INV_FIRST}:$N${INV_LAST},A{row},Invitados!$I${INV_FIRST}:$I${INV_LAST})'
            f'-SUMIFS(Invitados!$I${INV_FIRST}:$I${INV_LAST},Invitados!$N${INV_FIRST}:$N${INV_LAST},A{row},Invitados!$K${INV_FIRST}:$K${INV_LAST},"Rechazado")'
        )
        ws.cell(row, 5).value = (
            f'=SUMIFS(Invitados!$I${INV_FIRST}:$I${INV_LAST},Invitados!$N${INV_FIRST}:$N${INV_LAST},A{row},Invitados!$K${INV_FIRST}:$K${INV_LAST},"Confirmado")'
        )
        ws.cell(row, 6).value = f'=IF(C{row}="","",C{row}-D{row})'
    add_number_validation(ws, f"C{MESA_FIRST}:C{MESA_LAST}", "whole", "La capacidad es un número entero, o queda vacía si no usas la mesa.")
    ws.conditional_formatting.add(
        f"F{MESA_FIRST}:F{MESA_LAST}",
        FormulaRule(formula=[f"F{MESA_FIRST}<0"], fill=fill(RED_BG), font=font(11, bold=True, color=RED)),
    )
    ws.freeze_panes = "A8"
    ws.print_title_rows = "1:7"
    apply_widths(ws, {"A": 12, "B": 28, "C": 14, "D": 14, "E": 16, "F": 12, "G": 48})
    ws.auto_filter.ref = f"A{MESA_HEADER}:G{MESA_LAST}"


def construir_menu(ws) -> None:
    banner(
        ws,
        "Menú",
        "Las porciones usan a las personas confirmadas. Si todavía no hay confirmados, usan los invitados previstos. El dinero de la comida se anota en Presupuesto, no aquí.",
        10,
        WINE,
    )
    write_headers(ws, MENU_HEADER, ["Momento", "Qué se sirve", "Descripción", "Ajuste", "Porciones", "Notas"])
    ws.cell(MENU_HEADER, 4).comment = comment("Opcional. Si lo llenas, sustituye el cálculo de porciones.")
    for offset in range(MENU_LAST - MENU_FIRST + 1):
        row = MENU_FIRST + offset
        ws.row_dimensions[row].height = 20
        if offset < len(MENU_FILAS):
            momento, plato, descripcion = MENU_FILAS[offset]
            ws.cell(row, 1, momento)
            ws.cell(row, 2, plato)
            ws.cell(row, 3, descripcion)
        for col in (1, 2, 3, 4, 6):
            mark_input(ws.cell(row, col), '#,##0.00' if col == 4 else None, "right" if col == 4 else "left")
        mark_formula(ws.cell(row, 5), INT)
        ws.cell(row, 5).value = (
            f'=IF(AND(A{row}="",B{row}=""),"",IF(D{row}<>"",D{row},IF(PersonasConfirmadas>0,PersonasConfirmadas,IF(InvitadosPrevistos="","",InvitadosPrevistos))))'
        )
    add_number_validation(ws, f"D{MENU_FIRST}:D{MENU_LAST}", "decimal", "El ajuste de porciones tiene que ser un número igual o mayor que cero.")

    ws.cell(MENU_HEADER, 8, "Menú")
    ws.cell(MENU_HEADER, 9, "Confirmadas")
    ws.cell(MENU_HEADER, 10, "En la lista")
    for col in range(8, 11):
        cell = ws.cell(MENU_HEADER, col)
        cell.font = font(10, bold=True, color=WHITE)
        cell.fill = fill(WINE)
        cell.alignment = align("center", wrap=True)
        cell.border = box(WINE)
    filas_menu = MENUS + ["Sin menú elegido"]
    for index, nombre in enumerate(filas_menu):
        row = MENU_FIRST + index
        ws.cell(row, 8, nombre).font = font(11, bold=nombre.startswith("Sin"))
        ws.cell(row, 8).alignment = align(indent=1)
        ws.cell(row, 8).border = box(HAIR)
        if nombre == "Sin menú elegido":
            confirmadas = (
                f'=SUMIFS(Invitados!$I${INV_FIRST}:$I${INV_LAST},Invitados!$M${INV_FIRST}:$M${INV_LAST},"",Invitados!$K${INV_FIRST}:$K${INV_LAST},"Confirmado")'
            )
            en_lista = f'=SUMIF(Invitados!$M${INV_FIRST}:$M${INV_LAST},"",Invitados!$I${INV_FIRST}:$I${INV_LAST})'
        else:
            confirmadas = (
                f'=SUMIFS(Invitados!$I${INV_FIRST}:$I${INV_LAST},Invitados!$M${INV_FIRST}:$M${INV_LAST},H{row},Invitados!$K${INV_FIRST}:$K${INV_LAST},"Confirmado")'
            )
            en_lista = f'=SUMIF(Invitados!$M${INV_FIRST}:$M${INV_LAST},H{row},Invitados!$I${INV_FIRST}:$I${INV_LAST})'
        mark_formula(ws.cell(row, 9, confirmadas), INT)
        mark_formula(ws.cell(row, 10, en_lista), INT)
    ws.freeze_panes = "A8"
    ws.print_title_rows = "1:7"
    apply_widths(ws, {"A": 16, "B": 28, "C": 52, "D": 12, "E": 14, "F": 28, "G": 3, "H": 20, "I": 16, "J": 14})
    ws.auto_filter.ref = f"A{MENU_HEADER}:F{MENU_LAST}"


def construir_proveedores(ws, rangos: dict) -> None:
    banner(
        ws,
        "Proveedores",
        "Aquí van contactos y cotizaciones, también las que no vas a contratar. Si escribes Pagado, el saldo usa ese total. Si Pagado está vacío, resta solo el anticipo. El monto elegido se copia a Presupuesto.",
        13,
        "8C6A3D",
    )
    headers = [
        "Categoría",
        "Proveedor",
        "Contacto",
        "Teléfono",
        "Correo",
        "Qué incluye",
        "Cotización",
        "Anticipo",
        "Pagado",
        "Saldo",
        "Fecha límite",
        "Estado",
        "Notas",
    ]
    write_headers(ws, PROV_HEADER, headers)
    for offset in range(PROV_LAST - PROV_FIRST + 1):
        row = PROV_FIRST + offset
        ws.row_dimensions[row].height = 20
        if offset < len(CATEGORIAS):
            ws.cell(row, 1, CATEGORIAS[offset])
        for col in range(1, 14):
            cell = ws.cell(row, col)
            if col == 10:
                mark_formula(cell, MONEY)
            elif col in (7, 8, 9):
                mark_input(cell, MONEY, "right")
            elif col == 11:
                mark_input(cell, DATE_FMT, "right")
            elif col == 4:
                mark_input(cell)
                cell.number_format = "@"
            else:
                mark_input(cell)
        ws.cell(row, 10).value = (
            f'=IF(AND(G{row}="",H{row}="",I{row}=""),"",N(G{row})-IF(I{row}="",N(H{row}),N(I{row})))'
        )
    add_list_validation(ws, f"A{PROV_FIRST}:A{PROV_LAST}", rangos["categorias"], "Elige una categoría o escribe otra.", strict=False)
    add_list_validation(ws, f"L{PROV_FIRST}:L{PROV_LAST}", rangos["estado_proveedor"], "Elige un estado de la lista.")
    add_number_validation(ws, f"G{PROV_FIRST}:I{PROV_LAST}", "decimal", "El monto tiene que ser igual o mayor que cero.")
    paint_status(
        ws,
        f"L{PROV_FIRST}:L{PROV_LAST}",
        "L",
        {
            "Contratado": (SAGE_BG, SAGE),
            "Cotizado": (GOLD_BG, GOLD),
            "Descartado": ("F0EBE6", MUTED),
            "En conversación": (GOLD_BG, GOLD),
        },
    )
    ws.conditional_formatting.add(
        f"K{PROV_FIRST}:K{PROV_LAST}",
        FormulaRule(
            formula=[f'AND(K{PROV_FIRST}<>"",K{PROV_FIRST}<TODAY(),J{PROV_FIRST}>0,L{PROV_FIRST}<>"Descartado")'],
            fill=fill(RED_BG),
            font=font(11, color=RED),
        ),
    )
    ws.auto_filter.ref = f"A{PROV_HEADER}:M{PROV_LAST}"
    ws.freeze_panes = "A8"
    ws.print_title_rows = "1:7"
    apply_widths(
        ws,
        {
            "A": 24,
            "B": 28,
            "C": 22,
            "D": 16,
            "E": 28,
            "F": 36,
            "G": 14,
            "H": 14,
            "I": 14,
            "J": 14,
            "K": 16,
            "L": 20,
            "M": 32,
        },
    )


def construir_tareas(ws, rangos: dict) -> None:
    banner(
        ws,
        "Tareas",
        "La fecha límite resta los días a la fecha de la fiesta. Cambia Días antes si quieres mover una tarea. Inicio cuenta como avance las que marcas Hecho.",
        8,
        INK,
    )
    headers = ["Fase", "Tarea", "Responsable", "Días antes", "Fecha límite", "Prioridad", "Estado", "Notas"]
    write_headers(ws, TASK_HEADER, headers)
    fases_orden = list(dict.fromkeys(fase for fase, *_ in TAREAS))
    for offset in range(TASK_LAST - TASK_FIRST + 1):
        row = TASK_FIRST + offset
        ws.row_dimensions[row].height = 22
        if offset < len(TAREAS):
            fase, tarea, dias, prioridad = TAREAS[offset]
            ws.cell(row, 1, fase)
            ws.cell(row, 2, tarea)
            ws.cell(row, 4, dias)
            ws.cell(row, 6, prioridad)
            ws.cell(row, 7, "Por hacer")
            banda = BLUSH if fases_orden.index(fase) % 2 else WHITE
        else:
            banda = CREAM
        for col in (1, 2, 3, 4, 6, 7, 8):
            cell = ws.cell(row, col)
            mark_input(cell, INT if col == 4 else None, "right" if col == 4 else "left")
            if col in (1, 2) and offset < len(TAREAS):
                cell.fill = fill(banda)
        mark_formula(ws.cell(row, 5), DATE_FMT)
        ws.cell(row, 5).value = f'=IF(OR(FechaFiesta="",D{row}=""),"",FechaFiesta-D{row})'
    add_list_validation(ws, f"F{TASK_FIRST}:F{TASK_LAST}", rangos["prioridad"], "Elige Alta, Media o Baja.")
    add_list_validation(ws, f"G{TASK_FIRST}:G{TASK_LAST}", rangos["estado_tarea"], "Elige Por hacer, En curso o Hecho.")
    add_number_validation(ws, f"D{TASK_FIRST}:D{TASK_LAST}", "whole", "Escribe cuántos días antes de la fiesta vence la tarea.")
    paint_status(
        ws,
        f"G{TASK_FIRST}:G{TASK_LAST}",
        "G",
        {"Hecho": (SAGE_BG, SAGE), "En curso": (GOLD_BG, GOLD), "Por hacer": (WHITE, INK)},
    )
    paint_status(
        ws,
        f"F{TASK_FIRST}:F{TASK_LAST}",
        "F",
        {"Alta": (RED_BG, RED), "Media": (GOLD_BG, GOLD), "Baja": (SAGE_BG, SAGE)},
    )
    ws.conditional_formatting.add(
        f"E{TASK_FIRST}:E{TASK_LAST}",
        FormulaRule(
            formula=[f'AND(E{TASK_FIRST}<>"",E{TASK_FIRST}<TODAY(),G{TASK_FIRST}<>"Hecho")'],
            fill=fill(RED_BG),
            font=font(11, color=RED),
        ),
    )
    ws.conditional_formatting.add(
        f"E{TASK_FIRST}:E{TASK_LAST}",
        FormulaRule(
            formula=[f'AND(E{TASK_FIRST}<>"",E{TASK_FIRST}>=TODAY(),E{TASK_FIRST}<=TODAY()+14,G{TASK_FIRST}<>"Hecho")'],
            fill=fill(GOLD_BG),
            font=font(11, color=GOLD),
        ),
    )
    ws.auto_filter.ref = f"A{TASK_HEADER}:H{TASK_LAST}"
    ws.freeze_panes = "A8"
    ws.print_title_rows = "1:7"
    apply_widths(ws, {"A": 22, "B": 62, "C": 22, "D": 14, "E": 16, "F": 14, "G": 14, "H": 36})


def construir_horario(ws, rangos: dict) -> None:
    banner(
        ws,
        "Horario de la fiesta",
        "Cambia la hora de inicio y los minutos. Termina se calcula sola. Las horas de inicio no se empujan entre sí: si mueves una, revisa la siguiente. Listo sirve para ir marcando el día.",
        8,
        WINE,
    )
    write_headers(ws, HORA_HEADER, ["Empieza", "Momento", "Minutos", "Termina", "Quién lo cuida", "Lugar", "Listo", "Notas"])
    for offset in range(HORA_LAST - HORA_FIRST + 1):
        row = HORA_FIRST + offset
        ws.row_dimensions[row].height = 22
        if offset < len(HORARIO):
            empieza, momento, minutos = HORARIO[offset]
            ws.cell(row, 1, empieza)
            ws.cell(row, 2, momento)
            ws.cell(row, 3, minutos)
        mark_input(ws.cell(row, 1), TIME_FMT, "right")
        mark_input(ws.cell(row, 2))
        mark_input(ws.cell(row, 3), INT, "right")
        mark_formula(ws.cell(row, 4), TIME_FMT)
        mark_input(ws.cell(row, 5))
        mark_input(ws.cell(row, 6))
        mark_input(ws.cell(row, 7), horizontal="center")
        mark_input(ws.cell(row, 8))
        ws.cell(row, 4).value = f'=IF(OR(A{row}="",C{row}=""),"",A{row}+C{row}/1440)'
    add_list_validation(ws, f"G{HORA_FIRST}:G{HORA_LAST}", rangos["si_no"], "Elige Sí cuando ese momento ya pasó.")
    add_number_validation(ws, f"C{HORA_FIRST}:C{HORA_LAST}", "whole", "Escribe la duración en minutos.")
    paint_status(ws, f"G{HORA_FIRST}:G{HORA_LAST}", "G", {"Sí": (SAGE_BG, SAGE)})
    ws.freeze_panes = "A8"
    ws.print_title_rows = "1:7"
    apply_widths(ws, {"A": 14, "B": 36, "C": 12, "D": 14, "E": 24, "F": 28, "G": 12, "H": 36})
    ws.auto_filter.ref = f"A{HORA_HEADER}:H{HORA_LAST}"


def construir_guia(ws) -> None:
    banner(
        ws,
        "Cómo usar este plan",
        "Ocho hojas para armar la fiesta. Los números se calculan; las celdas claras son las que se llenan.",
        1,
        "8C6A3D",
    )
    ws.page_setup.orientation = "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    bloques = [
        ("Empieza en Inicio", "Escribe la pareja, la fecha, los invitados que esperas y el presupuesto. La moneda es una etiqueta: los números no se convierten. La reserva aparta un porcentaje del presupuesto, 10% al abrir el archivo. Días restantes usa la fecha de la fiesta."),
        ("Presupuesto", "Cada fila es un gasto. Si Por persona está en Sí y Ajuste está vacío, la cantidad son los invitados previstos. Estimado es cantidad por costo unitario. Si escribes Contratado, el saldo usa ese monto; si no, usa el estimado. Pagado es lo que ya entregaste. Una fecha de pago en los próximos 14 días se marca en ámbar, y en rojo si ya venció y todavía hay saldo."),
        ("Invitados", "Hay cuatro filas de ejemplo. Bórralas antes de usar la lista de verdad. Adultos más niños es el total de esa fila. Asisten copia el total solo cuando el RSVP es Confirmado. La lista cuadra cuando todas las personas tienen RSVP. El filtro de la primera fila sirve para ver, por ejemplo, solo pendientes."),
        ("Mesas", "Numera las mesas y escribe su capacidad. En Invitados elige ese número. Apartados suma a quien no ha rechazado, para no soltar el lugar demasiado pronto. Confirmados cuenta solo los sí. Si Libres sale negativo, esa mesa está por encima de su capacidad."),
        ("Menú", "Define qué se sirve en cada momento. Las porciones siguen a las personas confirmadas y, si aún no hay, a los invitados previstos. A la derecha está el conteo por tipo de menú. Comida, barra y pastel se pagan en Presupuesto, para no sumar dos veces el mismo gasto."),
        ("Proveedores", "Puedes tener varias cotizaciones de la misma categoría y marcar Descartado o Contratado. El saldo es la cotización menos lo pagado. Si solo registraste el anticipo, se resta el anticipo. Cuando elijas un proveedor, pasa ese monto a Presupuesto."),
        ("Tareas y horario", "Cambia Días antes si tu calendario es distinto: la fecha límite se mueve sola en cuanto Inicio tiene fecha. En el horario, Termina suma los minutos a la hora de inicio. Listo es la marca para el día de la fiesta. Si alargas un momento, la siguiente hora no se corre sola."),
        ("Más filas", "Cada hoja trae filas vacías con fórmulas. Cuando se acaben, copia la última fila y pégala debajo. En Excel también puedes insertar una fila en medio de la lista: las sumas se ajustan."),
    ]
    row = 4
    for titulo, texto in bloques:
        ws.cell(row, 1, titulo).font = font(14, bold=True, color=WINE)
        ws.cell(row, 1).alignment = align(indent=1)
        ws.row_dimensions[row].height = 24
        row += 1
        body = ws.cell(row, 1, texto)
        body.font = font(12, color=INK)
        body.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True, indent=1)
        lineas = max(2, (len(texto) + 95) // 96)
        ws.row_dimensions[row].height = 18 + lineas * 16
        row += 2
    ws.column_dimensions["A"].width = 118
    ws.sheet_view.zoomScale = 120
    ws.page_setup.fitToWidth = 1
    ws.row_dimensions[2].height = 22


def agregar_grafico(inicio, presupuesto) -> None:
    chart = BarChart()
    chart.type = "bar"
    chart.grouping = "clustered"
    chart.title = "Estimado y pagado por categoría"
    chart.y_axis.title = None
    chart.x_axis.title = "Monto"
    chart.x_axis.numFmt = "#,##0"
    chart.y_axis.scaling.orientation = "maxMin"
    chart.style = 10
    chart.gapWidth = 70
    chart.overlap = -8
    data_estimado = Reference(presupuesto, min_col=16, min_row=CAT_HEADER, max_row=CAT_RESERVA)
    data_pagado = Reference(presupuesto, min_col=18, min_row=CAT_HEADER, max_row=CAT_RESERVA)
    categorias = Reference(presupuesto, min_col=15, min_row=CAT_FIRST, max_row=CAT_RESERVA)
    chart.add_data(data_estimado, titles_from_data=True)
    chart.add_data(data_pagado, titles_from_data=True)
    chart.set_categories(categorias)
    chart.shape = 4
    chart.legend.position = "b"
    chart.legend.overlay = False
    chart.series[0].graphicalProperties.solidFill = WINE
    chart.series[1].graphicalProperties.solidFill = SAGE
    chart.series[0].graphicalProperties.line.solidFill = WINE
    chart.series[1].graphicalProperties.line.solidFill = SAGE
    chart.width = 22
    chart.height = 10
    inicio.add_chart(chart, "A19")
    inicio.merge_cells("A38:H38")
    nota = inicio["A38"]
    nota.value = "Fuente: hoja Presupuesto. El estimado incluye la reserva para imprevistos. Pagado es lo registrado en cada concepto, sin contar la reserva."
    nota.font = font(10, color=MUTED)
    nota.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    inicio.row_dimensions[38].height = 28


def definir_nombres(wb) -> None:
    nombres = {
        "FechaFiesta": "Inicio!$B$6",
        "InvitadosPrevistos": "Inicio!$B$11",
        "PresupuestoTotal": "Inicio!$B$12",
        "PorcentajeReserva": "Inicio!$B$14",
        "PersonasConfirmadas": "Inicio!$E$6",
    }
    for name, ref in nombres.items():
        wb.defined_names.add(DefinedName(name=name, attr_text=ref))


def parentesis_balanceados(formula: str) -> bool:
    cuenta = 0
    for char in formula:
        if char == "(":
            cuenta += 1
        elif char == ")":
            cuenta -= 1
            if cuenta < 0:
                return False
    return cuenta == 0


def verificar(path: Path) -> None:
    import warnings

    with warnings.catch_warnings(record=True) as avisos:
        warnings.simplefilter("always")
        wb = load_workbook(path)
    rotos = [str(aviso.message) for aviso in avisos if "header" in str(aviso.message).lower() or "footer" in str(aviso.message).lower()]
    if rotos:
        raise SystemExit("El encabezado o el pie no se puede leer: " + "; ".join(rotos))
    esperadas = [
        "Inicio",
        "Presupuesto",
        "Invitados",
        "Mesas",
        "Menú",
        "Proveedores",
        "Tareas",
        "Horario",
        "Guía",
        "Listas",
    ]
    if wb.sheetnames != esperadas:
        raise SystemExit(f"Hojas inesperadas: {wb.sheetnames}")
    if wb["Listas"].sheet_state != "hidden":
        raise SystemExit("La hoja Listas debería estar oculta.")

    for name in ("FechaFiesta", "InvitadosPrevistos", "PresupuestoTotal", "PorcentajeReserva", "PersonasConfirmadas"):
        if name not in wb.defined_names:
            raise SystemExit(f"Falta el nombre {name}")

    inicio = wb["Inicio"]
    if inicio["B13"].value != "MXN" or inicio["B14"].value != 0.10:
        raise SystemExit("Los valores iniciales de moneda o reserva no quedaron bien.")
    if not str(inicio["E6"].value).startswith("=SUMIF"):
        raise SystemExit("El conteo de confirmados no está en Inicio.")
    if "B12-N(H8)" not in str(inicio["H11"].value):
        raise SystemExit("Disponible no resta el estimado al presupuesto.")
    if inicio._charts[0].title.tx.rich.p[0].r[0].t != "Estimado y pagado por categoría":
        raise SystemExit("El gráfico no tiene el título esperado.")

    presupuesto = wb["Presupuesto"]
    fila_persona = None
    for row in range(PRES_FIRST, PRES_FIRST + len(CONCEPTOS)):
        if presupuesto.cell(row, 2).value == "Alimentos por persona":
            fila_persona = row
            break
    if fila_persona is None:
        raise SystemExit("Falta el concepto de alimentos por persona.")
    cantidad = str(presupuesto.cell(fila_persona, 5).value)
    if 'C{0}="Sí"'.format(fila_persona) not in cantidad or "InvitadosPrevistos" not in cantidad:
        raise SystemExit(f"La cantidad por persona no usa los invitados previstos: {cantidad}")
    saldo = str(presupuesto.cell(fila_persona, 10).value)
    if f'IF(H{fila_persona}="",N(G{fila_persona}),N(H{fila_persona}))' not in saldo:
        raise SystemExit(f"El saldo no prioriza el monto contratado: {saldo}")
    if presupuesto.cell(CAT_RESERVA, 16).value != "=Inicio!H7":
        raise SystemExit("La reserva del resumen no sale de Inicio.")

    invitados = wb["Invitados"]
    if not str(invitados.cell(INV_FIRST, 1).value).startswith("EJEMPLO"):
        raise SystemExit("La primera fila de invitados debería ser un ejemplo.")
    resumen = resumen_ejemplos()
    if resumen != {"lista": 7, "confirmadas": 5, "pendientes": 1, "rechazadas": 1}:
        raise SystemExit(f"El ejemplo de invitados no cuadra: {resumen}")
    if not str(invitados.cell(INV_FIRST, 9).value).startswith("=IF(AND(G"):
        raise SystemExit("Falta la fórmula de total de invitados.")

    mesas = wb["Mesas"]
    if mesas["C8"].value != 8 or not str(mesas["D8"].value).startswith("=SUMIF") or "Rechazado" not in str(mesas["D8"].value):
        raise SystemExit("La mesa de ejemplo no resta a quien rechazó.")

    menu = wb["Menú"]
    if "PersonasConfirmadas" not in str(menu["E8"].value):
        raise SystemExit("Las porciones no siguen a las personas confirmadas.")
    if menu.cell(MENU_FIRST + len(MENUS), 8).value != "Sin menú elegido":
        raise SystemExit("Falta el conteo de personas sin menú.")

    tareas = wb["Tareas"]
    if "FechaFiesta" not in str(tareas.cell(TASK_FIRST, 5).value):
        raise SystemExit("Las tareas no calculan la fecha límite.")
    if tareas.cell(TASK_FIRST, 7).value != "Por hacer":
        raise SystemExit("Las tareas deberían empezar por hacer.")

    horario = wb["Horario"]
    if horario["A8"].value != time(15, 0) or "1440" not in str(horario["D8"].value):
        raise SystemExit("El horario no calcula la hora en que termina.")

    hojas_validas = set(wb.sheetnames)
    formulas = 0
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                if isinstance(cell.value, str) and cell.value.startswith("="):
                    formulas += 1
                    if not parentesis_balanceados(cell.value):
                        raise SystemExit(f"Paréntesis desbalanceados en {ws.title}!{cell.coordinate}: {cell.value}")
                    if "EJEMPLO" in cell.value:
                        raise SystemExit(f"Una fórmula no debería mencionar el ejemplo: {cell.value}")
    if formulas < 200:
        raise SystemExit(f"Muy pocas fórmulas: {formulas}")

    casos_cantidad = [
        ((None, "Sí", 80), 80),
        ((50, "Sí", 80), 50),
        ((None, "No", 80), ""),
        ((3, "No", 80), 3),
        ((None, "Sí", None), ""),
    ]
    for args, esperado in casos_cantidad:
        if cantidad_usada(*args) != esperado:
            raise SystemExit(f"Cantidad inesperada para {args}")
    casos_saldo = [
        ((100, "", 40), 60),
        ((100, 90, 40), 50),
        (("", "", ""), ""),
        (("", 90, ""), 90),
        ((100, None, None), 100),
    ]
    for args, esperado in casos_saldo:
        if saldo_concepto(*args) != esperado:
            raise SystemExit(f"Saldo inesperado para {args}")
    if saldo_proveedor(100, 30, "") != 70 or saldo_proveedor(100, 30, 100) != 0:
        raise SystemExit("El saldo del proveedor no respeta anticipo y pagado.")

    usadas = {item[0] for item in CONCEPTOS}
    if not usadas <= set(CATEGORIAS):
        raise SystemExit(f"Hay conceptos fuera de las categorías: {usadas - set(CATEGORIAS)}")
    if wb["Guía"]["A4"].value != "Empieza en Inicio":
        raise SystemExit("La guía no abre con el primer paso.")
    print(f"Verificación lista: {formulas} fórmulas, {len(wb.sheetnames)} hojas.")


def main() -> None:
    destino = Path(__file__).with_name("Plan-fiesta-de-boda.xlsx")
    construir().save(destino)
    verificar(destino)
    print(destino)


if __name__ == "__main__":
    main()
