// ============================================================================
// LMS-Credit-Core: Modulo de Reportes Excel
// Archivo: lib/reports/cartera-vigente-excel.ts
// Descripcion: Generador XLSX para Cartera Vigente usando ExcelJS
// ============================================================================

import ExcelJS from 'exceljs';
import { CarteraVigenteData } from '../services/cartera-vigente.service';

// --- Paleta de colores (ARGB para ExcelJS) ---
const XL_COLORS = {
  headerBg: 'FF1A365D',      // azul oscuro
  headerFg: 'FFFFFFFF',      // blanco
  totalsBg: 'FF2B6CB0',      // azul medio
  totalsFg: 'FFFFFFFF',      // blanco
  rowAlt: 'FFF7FAFC',        // gris muy claro
  rowWhite: 'FFFFFFFF',      // blanco
  overdueRow: 'FFFFF5F5',    // rojo muy suave
  overdueRowAlt: 'FFFEE2E2', // rojo suave alternado
  activeFg: 'FF38A169',      // verde
  overdueFg: 'FFE53E3E',     // rojo
  kpiHeaderBg: 'FF2B6CB0',   // azul medio para resumen
  kpiBg: 'FFEBF8FF',         // azul muy claro
  border: 'FFBEE3F8',        // borde azul claro
} as const;

// --- Utilidades ---

function currencyFormat(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
}

// ============================================================================
// GENERADOR PRINCIPAL
// ============================================================================

export async function generateCarteraVigenteExcel(data: CarteraVigenteData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.empresaNombre;
  workbook.created = new Date();

  // ==========================================================================
  // HOJA 1: CARTERA VIGENTE
  // ==========================================================================
  const sheet = workbook.addWorksheet('Cartera Vigente', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // --- Fila de título ---
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `CARTERA VIGENTE — ${data.empresaNombre}`;
  titleCell.font = { bold: true, size: 14, color: { argb: XL_COLORS.headerFg } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COLORS.headerBg } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  // --- Fila de subtítulo ---
  sheet.mergeCells('A2:I2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Fecha de generación: ${data.fechaGeneracion}   |   Préstamos activos: ${data.totales.cantidadActivos}   |   En mora: ${data.totales.cantidadEnMora}`;
  subCell.font = { size: 9, color: { argb: 'FF4A5568' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COLORS.kpiBg } };
  sheet.getRow(2).height = 18;

  // --- Fila en blanco separadora ---
  sheet.getRow(3).height = 8;

  // --- Encabezados de columna ---
  const headers = [
    { header: 'Cliente', key: 'clienteNombre', width: 28 },
    { header: 'Cédula', key: 'clienteCedula', width: 16 },
    { header: 'Monto Original', key: 'montoOriginal', width: 20 },
    { header: 'Capital Restante', key: 'capitalRestante', width: 20 },
    { header: 'Capital Recuperado', key: 'capitalRecuperado', width: 20 },
    { header: 'Cuotas Pagadas', key: 'cuotasPagadas', width: 15 },
    { header: 'Total Cuotas', key: 'totalCuotas', width: 14 },
    { header: 'Próx. Vencimiento', key: 'proximoVencimiento', width: 18 },
    { header: 'Estado', key: 'estado', width: 12 },
  ];

  sheet.columns = headers.map(h => ({ key: h.key, width: h.width }));

  const headerRow = sheet.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.header;
    cell.font = { bold: true, color: { argb: XL_COLORS.headerFg }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COLORS.headerBg } };
    cell.alignment = { horizontal: i >= 2 && i <= 4 ? 'right' : 'center', vertical: 'middle' };
    applyBorder(cell);
  });
  headerRow.height = 22;

  // --- Filas de datos ---
  const moneyFmt = '"RD$"#,##0.00';
  let dataRowIdx = 5;

  data.prestamos.forEach((prestamo, idx) => {
    const isOverdue = prestamo.estado === 'OVERDUE';
    const isAlt = idx % 2 !== 0;

    let bgArgb: string;
    if (isOverdue) {
      bgArgb = isAlt ? XL_COLORS.overdueRowAlt : XL_COLORS.overdueRow;
    } else {
      bgArgb = isAlt ? XL_COLORS.rowAlt : XL_COLORS.rowWhite;
    }

    const row = sheet.getRow(dataRowIdx);
    const values = [
      prestamo.clienteNombre,
      prestamo.clienteCedula,
      currencyFormat(prestamo.montoOriginal),
      currencyFormat(prestamo.capitalRestante),
      currencyFormat(prestamo.capitalRecuperado),
      prestamo.cuotasPagadas,
      prestamo.totalCuotas,
      prestamo.proximoVencimiento ?? 'N/A',
      prestamo.estado === 'ACTIVE' ? 'Activo' : 'En Mora',
    ];

    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.alignment = {
        horizontal: i >= 2 && i <= 4 ? 'right' : 'center',
        vertical: 'middle',
      };
      applyBorder(cell);

      // Formato moneda
      if (i >= 2 && i <= 4) {
        cell.numFmt = moneyFmt;
      }
      // Color de estado
      if (i === 8) {
        cell.font = {
          bold: true,
          color: { argb: isOverdue ? XL_COLORS.overdueFg : XL_COLORS.activeFg },
        };
      }
      // Alineación izquierda para nombre y cédula
      if (i === 0) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    row.height = 18;
    dataRowIdx++;
  });

  // --- Fila de totales ---
  const totalesRow = sheet.getRow(dataRowIdx);
  const totalesValues = [
    `TOTALES (${data.prestamos.length} préstamos)`,
    '',
    currencyFormat(data.totales.totalCapitalOriginal),
    currencyFormat(data.totales.totalCapitalEnLaCalle),
    currencyFormat(data.totales.totalCapitalRecuperado),
    data.prestamos.reduce((sum, p) => sum + p.cuotasPagadas, 0),
    data.prestamos.reduce((sum, p) => sum + p.totalCuotas, 0),
    '',
    '',
  ];

  totalesValues.forEach((v, i) => {
    const cell = totalesRow.getCell(i + 1);
    cell.value = v;
    cell.font = { bold: true, color: { argb: XL_COLORS.totalsFg }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COLORS.totalsBg } };
    cell.alignment = {
      horizontal: i >= 2 && i <= 4 ? 'right' : 'center',
      vertical: 'middle',
    };
    applyBorder(cell);
    if (i >= 2 && i <= 4) {
      cell.numFmt = moneyFmt;
    }
    if (i === 0) {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });
  totalesRow.height = 22;

  // Freeze header rows
  sheet.views = [{ state: 'frozen', ySplit: 4 }];

  // ==========================================================================
  // HOJA 2: RESUMEN
  // ==========================================================================
  const resumenSheet = workbook.addWorksheet('Resumen');
  resumenSheet.columns = [
    { key: 'label', width: 32 },
    { key: 'value', width: 24 },
  ];

  // Título del resumen
  resumenSheet.mergeCells('A1:B1');
  const resTitleCell = resumenSheet.getCell('A1');
  resTitleCell.value = 'RESUMEN — CARTERA VIGENTE';
  resTitleCell.font = { bold: true, size: 13, color: { argb: XL_COLORS.headerFg } };
  resTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COLORS.headerBg } };
  resTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  resumenSheet.getRow(1).height = 26;

  resumenSheet.mergeCells('A2:B2');
  const resSubCell = resumenSheet.getCell('A2');
  resSubCell.value = `${data.empresaNombre}  |  Generado: ${data.fechaGeneracion}`;
  resSubCell.font = { size: 9, color: { argb: 'FF4A5568' } };
  resSubCell.alignment = { horizontal: 'center', vertical: 'middle' };
  resSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COLORS.kpiBg } };
  resumenSheet.getRow(2).height = 16;

  resumenSheet.getRow(3).height = 8;

  // Encabezado de la tabla resumen
  const resHeaderRow = resumenSheet.getRow(4);
  ['Indicador', 'Valor'].forEach((h, i) => {
    const cell = resHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: XL_COLORS.headerFg }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyBorder(cell);
  });
  resHeaderRow.height = 20;

  // Filas de KPIs
  const kpiRows: Array<{ label: string; value: number | string; isMoney: boolean }> = [
    { label: 'Capital Total en la Calle (Capital Restante)', value: currencyFormat(data.totales.totalCapitalEnLaCalle), isMoney: true },
    { label: 'Capital Original Prestado', value: currencyFormat(data.totales.totalCapitalOriginal), isMoney: true },
    { label: 'Capital Recuperado', value: currencyFormat(data.totales.totalCapitalRecuperado), isMoney: true },
    { label: 'Total en Riesgo (Capital Restante en Mora)', value: currencyFormat(data.totales.totalEnRiesgo), isMoney: true },
    { label: 'Cantidad de Préstamos Activos', value: data.totales.cantidadActivos, isMoney: false },
    { label: 'Cantidad de Préstamos en Mora', value: data.totales.cantidadEnMora, isMoney: false },
    { label: 'Total de Préstamos en Cartera', value: data.prestamos.length, isMoney: false },
    { label: 'Fecha de Generación', value: data.fechaGeneracion, isMoney: false },
  ];

  kpiRows.forEach((kpi, idx) => {
    const row = resumenSheet.getRow(5 + idx);
    const isAlt = idx % 2 !== 0;
    const bg = isAlt ? XL_COLORS.rowAlt : XL_COLORS.rowWhite;

    const labelCell = row.getCell(1);
    labelCell.value = kpi.label;
    labelCell.font = { size: 10 };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    applyBorder(labelCell);

    const valueCell = row.getCell(2);
    valueCell.value = kpi.value;
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    valueCell.alignment = { horizontal: kpi.isMoney ? 'right' : 'center', vertical: 'middle' };
    valueCell.font = { bold: true, size: 10 };
    applyBorder(valueCell);

    if (kpi.isMoney && typeof kpi.value === 'number') {
      valueCell.numFmt = '"RD$"#,##0.00';
    }

    row.height = 20;
  });

  // ==========================================================================
  // ESCRIBIR BUFFER Y RETORNAR
  // ==========================================================================
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
