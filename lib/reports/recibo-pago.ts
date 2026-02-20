// ============================================================================
// LMS-Credit-Core: Módulo de Reportes PDF
// Archivo: lib/reports/recibo-pago.ts
// Descripción: Servicio de generación de PDF para Recibo de Pago
// ============================================================================

import PDFDocument from 'pdfkit';

// --- Tipos ---

export interface ReciboPagoData {
  // Empresa
  empresaNombre: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaRnc: string;

  // Recibo
  folio: number;
  fechaExpedicion: string; // formato DD/MM/YYYY
  fechaPago: string;

  // Cliente
  clienteNombre: string;
  clienteNumero: string;
  clienteDomicilio: string;

  // Préstamo
  esquemaPago: string;
  pagoNumero: number;
  totalPagos: number;

  // Desglose
  cuotaNormal: number;
  diasRetraso: number;
  cargoAtraso: number;
  saldoVencido: number;
  liquidacionPendiente: number;
  liquidacionTotal: number;

  // Totales
  totalAPagar: number;
  pagoRecibido: number;
  saldoPendienteExcedente: number;
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

function formatFolio(folio: number): string {
  return folio.toString().padStart(6, '0');
}

// --- Generador ---

export function generateReciboPagoPDF(data: ReciboPagoData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `Recibo de Pago - ${data.clienteNombre} - Folio ${formatFolio(data.folio)}`,
          Author: data.empresaNombre,
          Subject: 'Comprobante de Pago',
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
      doc
        .roundedRect(margin, y, contentWidth, headerHeight, 6)
        .fill(COLORS.primary);

      // Nombre empresa
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(COLORS.white)
        .text(data.empresaNombre, margin + 15, y + 12, { width: contentWidth * 0.55 });

      // Dirección y teléfono
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(data.empresaDireccion, margin + 15, y + 32);
      doc.text(`Tel: ${data.empresaTelefono}  |  RNC: ${data.empresaRnc}`, margin + 15, y + 44);

      // Título derecha
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('COMPROBANTE DE PAGO', margin + contentWidth * 0.55, y + 12, {
          width: contentWidth * 0.42,
          align: 'right',
        });

      // Folio
      doc
        .fontSize(10)
        .text(`Folio: ${formatFolio(data.folio)}`, margin + contentWidth * 0.55, y + 32, {
          width: contentWidth * 0.42,
          align: 'right',
        });

      // Fecha
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(`Fecha: ${data.fechaExpedicion}`, margin + contentWidth * 0.55, y + 48, {
          width: contentWidth * 0.42,
          align: 'right',
        });

      y += headerHeight + 15;

      // =========================================================
      // DATOS DEL CLIENTE
      // =========================================================
      const clientHeight = 85;

      // Fondo
      doc
        .roundedRect(margin, y, contentWidth, clientHeight, 5)
        .fill(COLORS.lightBg);
      doc
        .roundedRect(margin, y, contentWidth, clientHeight, 5)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      // Título sección
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.primary)
        .text('DATOS DEL CLIENTE', margin + 12, y + 10);

      // Línea divisora
      doc
        .moveTo(margin + 12, y + 24)
        .lineTo(margin + contentWidth - 12, y + 24)
        .strokeColor(COLORS.border)
        .stroke();

      const col1X = margin + 12;
      const col2X = margin + contentWidth / 2 + 10;
      const labelWidth = 90;
      let rowY = y + 32;

      // Columna 1
      const drawField = (x: number, fy: number, label: string, value: string) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray).text(label, x, fy);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.textDark).text(value, x + labelWidth, fy);
      };

      drawField(col1X, rowY, 'Recibo del Sr./Sra.:', data.clienteNombre);
      drawField(col1X, rowY + 15, 'No. de Cliente:', data.clienteNumero);
      drawField(col1X, rowY + 30, 'Domicilio:', data.clienteDomicilio);

      drawField(col2X, rowY, 'Esquema:', data.esquemaPago);
      drawField(col2X, rowY + 15, 'Pago Numero:', `${data.pagoNumero} de ${data.totalPagos}`);
      drawField(col2X, rowY + 30, 'Fecha de Pago:', data.fechaPago);

      y += clientHeight + 15;

      // =========================================================
      // TABLA DE CARGOS
      // =========================================================
      const rows = [
        { concepto: 'Cuota normal', monto: formatCurrency(data.cuotaNormal), highlight: false },
        { concepto: 'Dias de retraso', monto: data.diasRetraso.toString(), highlight: data.diasRetraso > 0 },
        { concepto: 'Cargo por atraso', monto: formatCurrency(data.cargoAtraso), highlight: data.cargoAtraso > 0 },
        { concepto: 'Saldo vencido', monto: formatCurrency(data.saldoVencido), highlight: false },
        { concepto: 'Liquidacion Pendiente o Excedente', monto: formatCurrency(data.liquidacionPendiente), highlight: false },
      ];

      // Header de tabla
      const tableHeaderH = 28;
      doc
        .rect(margin, y, contentWidth, tableHeaderH)
        .fill(COLORS.primary);
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(COLORS.white)
        .text('CONCEPTO', margin + 12, y + 9);
      doc.text('MONTO', margin + contentWidth - 100, y + 9, { width: 88, align: 'right' });

      y += tableHeaderH;

      // Filas
      const rowHeight = 24;
      rows.forEach((row, idx) => {
        const bg = idx % 2 === 0 ? COLORS.lightGray : COLORS.white;
        doc.rect(margin, y, contentWidth, rowHeight).fill(bg);

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(COLORS.textGray)
          .text(row.concepto, margin + 12, y + 7);

        const montoColor = row.highlight ? COLORS.danger : COLORS.textDark;
        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor(montoColor)
          .text(row.monto, margin + contentWidth - 150, y + 7, { width: 138, align: 'right' });

        // Línea inferior
        doc
          .moveTo(margin, y + rowHeight)
          .lineTo(margin + contentWidth, y + rowHeight)
          .strokeColor(COLORS.divider)
          .lineWidth(0.3)
          .stroke();

        y += rowHeight;
      });

      y += 15;

      // =========================================================
      // TOTAL A PAGAR
      // =========================================================
      const totalHeight = 50;
      doc
        .roundedRect(margin, y, contentWidth, totalHeight, 5)
        .fill(COLORS.primary);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(COLORS.white)
        .text('TOTAL A PAGAR', margin + 15, y + 12);

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text(formatCurrency(data.totalAPagar), margin + contentWidth * 0.4, y + 8, {
          width: contentWidth * 0.57,
          align: 'right',
        });

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#a0c4e8')
        .text(
          `Monto para liquidar prestamo: ${formatCurrency(data.liquidacionTotal)}`,
          margin + 15,
          y + 34,
        );

      y += totalHeight + 15;

      // =========================================================
      // PAGO RECIBIDO
      // =========================================================
      const pagoHeight = 55;
      doc
        .roundedRect(margin, y, contentWidth, pagoHeight, 5)
        .fill('#f0fff4');
      doc
        .roundedRect(margin, y, contentWidth, pagoHeight, 5)
        .strokeColor('#c6f6d5')
        .lineWidth(0.5)
        .stroke();

      // Check circle
      doc.circle(margin + 25, y + pagoHeight / 2, 9).fill(COLORS.success);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(COLORS.white)
        .text('✓', margin + 20, y + pagoHeight / 2 - 7);

      // Pago recibido
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLORS.success)
        .text('PAGO RECIBIDO', margin + 42, y + 12);
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(COLORS.textDark)
        .text(formatCurrency(data.pagoRecibido), margin + 42, y + 28);

      // Saldo
      const saldo = data.saldoPendienteExcedente;
      const saldoLabel = saldo >= 0 ? 'Saldo Pendiente' : 'Excedente a Favor';
      const saldoColor = saldo > 0 ? COLORS.danger : saldo < 0 ? COLORS.success : COLORS.textGray;

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.textGray)
        .text(saldoLabel, margin + contentWidth * 0.55, y + 14, {
          width: contentWidth * 0.42,
          align: 'right',
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(saldoColor)
        .text(formatCurrency(Math.abs(saldo)), margin + contentWidth * 0.55, y + 28, {
          width: contentWidth * 0.42,
          align: 'right',
        });

      y += pagoHeight + 15;

      // =========================================================
      // NOTA
      // =========================================================
      const noteHeight = 38;
      doc.roundedRect(margin, y, contentWidth, noteHeight, 3).fill('#fffbeb');
      doc
        .roundedRect(margin, y, contentWidth, noteHeight, 3)
        .strokeColor('#fbd38d')
        .lineWidth(0.5)
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor('#744210')
        .text('NOTA IMPORTANTE:', margin + 10, y + 6);
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .text(
          'El saldo pendiente o excedente se aplicara en su proximo pago. Un saldo negativo indica excedente a su favor, un saldo positivo indica un monto pendiente que se sumara a su siguiente cuota. Conserve este recibo como comprobante.',
          margin + 10,
          y + 16,
          { width: contentWidth - 20 },
        );

      y += noteHeight + 30;

      // =========================================================
      // FIRMAS
      // =========================================================
      const firmaWidth = contentWidth / 2 - 30;

      // Firma cliente
      doc
        .moveTo(margin + 30, y)
        .lineTo(margin + 30 + firmaWidth, y)
        .strokeColor(COLORS.divider)
        .lineWidth(0.8)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.textGray)
        .text('Firma del Cliente', margin + 30, y + 4, { width: firmaWidth, align: 'center' });
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(data.clienteNombre, margin + 30, y + 15, { width: firmaWidth, align: 'center' });

      // Firma autorizada
      const firma2X = margin + contentWidth / 2 + 30;
      doc
        .moveTo(firma2X, y)
        .lineTo(firma2X + firmaWidth, y)
        .strokeColor(COLORS.divider)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.textGray)
        .text('Firma Autorizada', firma2X, y + 4, { width: firmaWidth, align: 'center' });
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(data.empresaNombre, firma2X, y + 15, { width: firmaWidth, align: 'center' });

      // =========================================================
      // FOOTER
      // =========================================================
      const footerY = pageHeight - margin - 10;
      doc
        .moveTo(margin, footerY + 5)
        .lineTo(pageWidth - margin, footerY + 5)
        .strokeColor(COLORS.divider)
        .lineWidth(0.5)
        .stroke();

      const now = new Date();
      const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(COLORS.textGray)
        .text(
          `Documento generado por LMS Credit Core  |  ${data.empresaNombre}  |  ${timestamp}`,
          margin,
          footerY - 5,
          { width: contentWidth, align: 'center' },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
