// ============================================================================
// LMS-Credit-Core: Modulo de Reportes PDF
// Archivo: lib/reports/plan-pagos.ts
// Descripcion: Generador PDF para Plan de Pagos (Tabla de Amortizacion)
// ============================================================================

import PDFDocument from 'pdfkit';

// --- Tipos ---

export interface PlanPagosData {
  // Empresa
  empresaNombre: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaRnc: string;

  // Cliente
  clienteNombre: string;
  clienteDocumento: string;

  // Prestamo
  montoOriginal: number;
  totalFinanceCharge?: number;
  frecuencia: string;
  frecuenciaEnum: string; // DAILY | WEEKLY | BIWEEKLY | MONTHLY
  totalCuotas: number;
  montoCuota: number;
  fechaInicio: string;
  estado: string;
}

// --- Colores ---
const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  accent: '#3182ce',
  lightBg: '#ebf8ff',
  border: '#bee3f8',
  textDark: '#1a202c',
  textGray: '#4a5568',
  danger: '#e53e3e',
  success: '#38a169',
  lightGray: '#f7fafc',
  divider: '#e2e8f0',
  white: '#ffffff',
} as const;

// --- Utilidades ---

function formatCurrency(amount: number): string {
  return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getTimestamp(): string {
  const now = new Date();
  return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function addPeriod(date: Date, freq: string): Date {
  const d = new Date(date);
  switch (freq) {
    case 'DAILY':
      d.setDate(d.getDate() + 1);
      break;
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      break;
    case 'BIWEEKLY':
      d.setDate(d.getDate() + 14);
      break;
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

function formatDateShort(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

// --- Generador ---

export function generatePlanPagosPDF(data: PlanPagosData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `Plan de Pagos - ${data.clienteNombre}`,
          Author: data.empresaNombre,
          Subject: 'Tabla de Amortizacion',
          Creator: 'LMS Credit Core',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // =========================================================
      // HEADER
      // =========================================================
      const headerHeight = 75;
      doc.roundedRect(margin, y, contentWidth, headerHeight, 6).fill(COLORS.primary);

      doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white)
        .text(data.empresaNombre, margin + 15, y + 12, { width: contentWidth * 0.55 });
      doc.font('Helvetica').fontSize(8)
        .text(data.empresaDireccion, margin + 15, y + 32);
      doc.text(`Tel: ${data.empresaTelefono}  |  RNC: ${data.empresaRnc}`, margin + 15, y + 44);

      doc.font('Helvetica-Bold').fontSize(13)
        .text('PLAN DE PAGOS', margin + contentWidth * 0.55, y + 12, {
          width: contentWidth * 0.42, align: 'right',
        });
      doc.font('Helvetica').fontSize(8)
        .text(`Fecha: ${new Date().toLocaleDateString('es-DO')}`, margin + contentWidth * 0.55, y + 32, {
          width: contentWidth * 0.42, align: 'right',
        });

      y += headerHeight + 15;

      // =========================================================
      // DATOS DEL PRESTAMO
      // =========================================================
      const infoHeight = 70;
      doc.roundedRect(margin, y, contentWidth, infoHeight, 5).fill(COLORS.lightBg);
      doc.roundedRect(margin, y, contentWidth, infoHeight, 5)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      const col1X = margin + 12;
      const col2X = margin + contentWidth / 2 + 10;
      const labelW = 95;

      const drawField = (x: number, fy: number, label: string, value: string) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray).text(label, x, fy);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.textDark).text(value, x + labelW, fy);
      };

      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.primary)
        .text('DETALLES DEL PRESTAMO', col1X, y + 10);
      doc.moveTo(col1X, y + 24).lineTo(margin + contentWidth - 12, y + 24)
        .strokeColor(COLORS.border).stroke();

      let rowY = y + 32;
      drawField(col1X, rowY, 'Cliente:', data.clienteNombre);
      drawField(col1X, rowY + 15, 'Documento:', data.clienteDocumento);

      drawField(col2X, rowY, 'Monto:', formatCurrency(data.montoOriginal));
      drawField(
        col2X, rowY + 15,
        'Cargo Financiero:',
        `${formatCurrency(data.totalFinanceCharge ?? 0)} | ${data.frecuencia} | ${data.totalCuotas} cuotas`
      );

      y += infoHeight + 15;

      // =========================================================
      // TABLA DE PAGOS
      // =========================================================
      const rowH = 18;

      // Flat Rate: simplified table — No. | Fecha | Cuota
      const flatHeaders = ['No.', 'Fecha Vencimiento', 'Cuota'];
      const flatColWidths = [50, 200, 280];

      const thH = 24;
      doc.rect(margin, y, contentWidth, thH).fill(COLORS.primary);
      let hx = margin;
      flatHeaders.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
          .text(h, hx + 6, y + 8, { width: flatColWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
        hx += flatColWidths[i];
      });
      y += thH;

      let dueDate = new Date(data.fechaInicio);
      for (let i = 1; i <= data.totalCuotas; i++) {
        if (y + rowH > pageHeight - 60) {
          doc.addPage();
          y = margin;
          doc.rect(margin, y, contentWidth, thH).fill(COLORS.primary);
          let nhx = margin;
          flatHeaders.forEach((h, j) => {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
              .text(h, nhx + 6, y + 8, { width: flatColWidths[j] - 12, align: j >= 2 ? 'right' : 'left' });
            nhx += flatColWidths[j];
          });
          y += thH;
        }

        dueDate = addPeriod(dueDate, data.frecuenciaEnum);
        const bg = i % 2 === 0 ? COLORS.lightGray : COLORS.white;
        doc.rect(margin, y, contentWidth, rowH).fill(bg);

        let rx = margin;
        const vals = [String(i), formatDateShort(dueDate), formatCurrency(data.montoCuota)];
        vals.forEach((v, j) => {
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.textDark)
            .text(v, rx + 6, y + 5, { width: flatColWidths[j] - 12, align: j >= 2 ? 'right' : 'left' });
          rx += flatColWidths[j];
        });

        doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH)
          .strokeColor(COLORS.divider).lineWidth(0.3).stroke();
        y += rowH;
      }

      // Totals row
      if (y + 24 > pageHeight - 60) { doc.addPage(); y = margin; }
      doc.rect(margin, y, contentWidth, 24).fill(COLORS.primary);
      let tx = margin;
      const flatTotals = ['', 'TOTALES', formatCurrency(data.montoCuota * data.totalCuotas)];
      flatTotals.forEach((v, i) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
          .text(v, tx + 6, y + 8, { width: flatColWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
        tx += flatColWidths[i];
      });

      // Info row: capital + cargo
      y += 30;
      doc.roundedRect(margin, y, contentWidth, 30, 4).fill(COLORS.lightBg);
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textGray)
        .text(
          `Capital: ${formatCurrency(data.montoOriginal)}   +   Cargo Financiero: ${formatCurrency(data.totalFinanceCharge ?? 0)}   =   Total a Pagar: ${formatCurrency(data.montoCuota * data.totalCuotas)}`,
          margin + 12, y + 10,
          { width: contentWidth - 24, align: 'center' }
        );

      // =========================================================
      // FOOTER
      // =========================================================
      const footerY = pageHeight - margin - 10;
      doc.moveTo(margin, footerY + 5).lineTo(pageWidth - margin, footerY + 5)
        .strokeColor(COLORS.divider).lineWidth(0.5).stroke();

      doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.textGray)
        .text(
          `Documento generado por LMS Credit Core  |  ${data.empresaNombre}  |  ${getTimestamp()}`,
          margin, footerY - 5,
          { width: contentWidth, align: 'center' },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
