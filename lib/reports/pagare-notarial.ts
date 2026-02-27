// ============================================================================
// LMS-Credit-Core: Modulo de Reportes PDF
// Archivo: lib/reports/pagare-notarial.ts
// Descripcion: Generador PDF para Pagare Notarial con intervención de Abogado/Notario
// ============================================================================

import PDFDocument from 'pdfkit';

// --- Tipos ---

export interface AcreedorData {
  nombre: string;
  cedula: string;
  estadoCivil: string;
  domicilio: string;
}

export interface NotarioData {
  nombre: string;         // Ej: LIC. RAMÓN H. GÓMEZ ALMONTE
  cedula: string;         // Ej: 043-0000010-8
  matricula: string;      // Ej: 3206
  estudio: string;        // Dirección del estudio notarial
}

export interface PagareNotarialData {
  // Número de acto (generado por el sistema)
  numeroActo: string;     // Formato: AÑO-XXXX, ej: 2025-0001

  // Lugar y fecha del acto
  ciudad: string;         // Ej: Santo Domingo, Distrito Nacional
  diaLetras: string;      // Ej: Veinticuatro (24)
  mesLetras: string;      // Ej: Diciembre
  anioLetras: string;     // Ej: Dos Mil Veinticinco (2025)

  // Notario
  notario: NotarioData;

  // Deudor (cliente del sistema)
  deudorNombre: string;
  deudorCedula: string;
  deudorEstadoCivil: string;
  deudorDomicilio: string;

  // Acreedores (siempre ambos)
  acreedores: [AcreedorData, AcreedorData];

  // Condiciones del préstamo
  montoPrestado: number;          // Capital entregado
  totalAPagar: number;            // Monto total a devolver
  numeroCuotas: number;           // Cantidad de cuotas
  montoCuota: number;             // Valor de cada cuota
  frecuenciaPago: string;         // Ej: "todos los viernes"
  porcentajeMora: number;         // Ej: 10 (para 10%)

  // Garantías (opcional)
  garantias?: string;
}

// --- Colores (consistentes con el resto del sistema) ---
const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  lightBg: '#ebf8ff',
  border: '#bee3f8',
  textDark: '#1a202c',
  textGray: '#4a5568',
  divider: '#e2e8f0',
  white: '#ffffff',
  lightGray: '#f7fafc',
} as const;

// --- Utilidades ---

function formatCurrency(amount: number): string {
  return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getTimestamp(): string {
  const now = new Date();
  return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Genera el número de acto notarial en formato AÑO-XXXX
 * Basado en timestamp para garantizar unicidad
 */
export function generateNumeroActo(): string {
  const now = new Date();
  const year = now.getFullYear();
  // Usa los últimos 4 dígitos del timestamp en ms como secuencial único
  const seq = (now.getTime() % 10000).toString().padStart(4, '0');
  return `${year}-${seq}`;
}

/**
 * Convierte número a palabras en español (mayúsculas dominicanas)
 */
export function numberToWords(n: number): string {
  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (n === 0) return 'CERO';
  if (n === 100) return 'CIEN';
  if (n === 1000) return 'MIL';

  const intPart = Math.floor(n);
  const parts: string[] = [];

  if (intPart >= 1000000) {
    const millions = Math.floor(intPart / 1000000);
    parts.push(millions === 1 ? 'UN MILLÓN' : `${numberToWords(millions)} MILLONES`);
  }

  const rem1 = intPart % 1000000;
  if (rem1 >= 1000) {
    const thousands = Math.floor(rem1 / 1000);
    parts.push(thousands === 1 ? 'MIL' : `${numberToWords(thousands)} MIL`);
  }

  const lastThree = rem1 % 1000;
  if (lastThree >= 100) {
    parts.push(hundreds[Math.floor(lastThree / 100)]);
  }

  const lastTwo = lastThree % 100;
  if (lastTwo >= 10 && lastTwo < 20) {
    parts.push(teens[lastTwo - 10]);
  } else {
    if (lastTwo >= 20) {
      const t = tens[Math.floor(lastTwo / 10)];
      const u = units[lastTwo % 10];
      parts.push(u ? `${t} Y ${u}` : t);
    } else if (lastTwo > 0) {
      parts.push(units[lastTwo]);
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function formatMontoEnLetras(amount: number): string {
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  const words = numberToWords(intPart);
  if (decPart > 0) {
    return `${words} CON ${decPart.toString().padStart(2, '0')}/100 PESOS DOMINICANOS`;
  }
  return `${words} PESOS DOMINICANOS`;
}

// --- Generador Principal ---

export function generatePagareNotarialPDF(data: PagareNotarialData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        compress: false,
        margins: { top: 50, bottom: 50, left: 65, right: 65 },
        info: {
          Title: `Pagare Notarial - ${data.deudorNombre} - Acto No. ${data.numeroActo}`,
          Author: data.notario.nombre,
          Subject: 'Pagare Notarial',
          Creator: 'LMS Credit Core',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginL = 65;
      const marginR = 65;
      const contentWidth = pageWidth - marginL - marginR;
      let y = 50;

      // =========================================================
      // HEADER — Número de Acto + Título formal
      // =========================================================
      const headerH = 70;
      doc.roundedRect(marginL, y, contentWidth, headerH, 6).fill(COLORS.primary);

      // Título centrado
      doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.white)
        .text('PAGARÉ NOTARIAL', marginL + 15, y + 10, { width: contentWidth - 30, align: 'center' });

      // Número de acto alineado derecha
      doc.font('Helvetica').fontSize(8.5).fillColor('#a0c4e8')
        .text(`Acto No. ${data.numeroActo}`, marginL + 15, y + 36, {
          width: contentWidth - 30, align: 'right',
        });

      // Ciudad y fecha debajo del título
      doc.font('Helvetica').fontSize(8).fillColor('#a0c4e8')
        .text(
          `${data.ciudad}  |  ${data.diaLetras} días del mes de ${data.mesLetras} del año ${data.anioLetras}`,
          marginL + 15, y + 50,
          { width: contentWidth - 30, align: 'center' },
        );

      y += headerH + 20;

      // =========================================================
      // CUERPO LEGAL — Texto del Pagaré Notarial
      // =========================================================

      // Párrafo de comparecencia (el bloque introductorio formal)
      const acreedores = data.acreedores;
      const acreedorTexto = acreedores
        .map(a => `**${a.nombre}**, ${a.estadoCivil}, portador(a) de la cédula de identidad y electoral No. **${a.cedula}**, domiciliado(a) en ${a.domicilio}`)
        .join('; y ');

      // Helper para escribir párrafo justificado con padding inferior
      const writeParagraph = (text: string, extraGap = 12) => {
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.textDark)
          .text(text, marginL, y, { width: contentWidth, align: 'justify', lineGap: 3 });
        y = doc.y + extraGap;
      };

      // Helper para escribir título de cláusula subrayado
      const writeClauseTitle = (title: string) => {
        if (y + 40 > pageHeight - 70) { doc.addPage(); y = 50; }
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.primary)
          .text(title, marginL, y, { width: contentWidth, underline: true });
        y = doc.y + 6;
      };

      // --- Párrafo de apertura del Notario ---
      const introText =
        `En la Ciudad de ${data.ciudad}, República Dominicana, a los ${data.diaLetras} días del mes de ${data.mesLetras} del año ${data.anioLetras}. Por ante mí, **${data.notario.nombre}**, dominicano, mayor de edad, Abogado Notario Público de los del número del Distrito Nacional, debidamente inscrito en el Colegio Dominicano de Notarios, con la matrícula núm. (${data.notario.matricula}), portador de la cédula de identidad y electoral Núm.: ${data.notario.cedula}, con mi estudio profesional abierto en ${data.notario.estudio}; **COMPARECIÓ LIBRE Y VOLUNTARIAMENTE** la señora/el señor: **${data.deudorNombre}**, dominicano(a), mayor de edad, ${data.deudorEstadoCivil}, portador(a) de la cédula de identidad y electoral No. **${data.deudorCedula}**, domiciliado(a) y residente en ${data.deudorDomicilio}, quien me ha declarado **BAJO LA FE DEL JURAMENTO** lo que a continuación se describe:`;

      writeParagraph(introText, 16);

      // --- PRIMERO ---
      writeClauseTitle('PRIMERO:');
      const primerTexto =
        `Que reconoce ser **LA DEUDORA/EL DEUDOR** de los señores ${acreedores[0].nombre} y ${acreedores[1].nombre}, por la suma de **${formatCurrency(data.montoPrestado).replace('RD$ ', 'RD$')} (${formatMontoEnLetras(data.montoPrestado)}),** que serán pagados en **${data.numeroCuotas}** cuotas de **${formatCurrency(data.montoCuota)}** cada una, ${data.frecuenciaPago}, hasta completar la suma de **${formatCurrency(data.totalAPagar)} (${formatMontoEnLetras(data.totalAPagar)})** en su totalidad.`;
      writeParagraph(primerTexto, 10);

      // --- PÁRRAFO de mora ---
      if (y + 30 > pageHeight - 70) { doc.addPage(); y = 50; }
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.primary)
        .text('PÁRRAFO:', marginL, y, { underline: true, continued: false });
      y = doc.y + 6;
      writeParagraph(
        `**LA DEUDORA/EL DEUDOR** acepta que si se retrasa en los pagos del préstamo deberá pagar los réditos por el **${data.porcentajeMora} por Ciento (${data.porcentajeMora}%)** sobre el monto vencido por cada período de retraso.`,
        14,
      );

      // --- SEGUNDO ---
      writeClauseTitle('SEGUNDO:');
      writeParagraph(
        `Que para el fiel cumplimiento del presente pagaré, **LA DEUDORA/EL DEUDOR** se compromete frente a **LOS ACREEDORES**, en garantía la universalidad de todos sus bienes presentes y futuros, tanto muebles como inmuebles.${data.garantias ? ` Adicionalmente, ofrece como garantía específica: ${data.garantias}.` : ''}`,
        14,
      );

      // --- TERCERO ---
      writeClauseTitle('TERCERO:');
      writeParagraph(
        `**LA DEUDORA/EL DEUDOR** acepta que el presente pagaré posee la fuerza ejecutoria de una sentencia con Autoridad de la Cosa irrevocablemente juzgada, en virtud de lo que establece el **Artículo No. 545 del Código de Procedimiento Civil de la República Dominicana**, el cual dice: "TIENE FUERZA EJECUTORIA LAS PRIMERAS COPIAS DE SENTENCIAS, OTRAS DECISIONES JUDICIALES Y LA DE ACTOS NOTARIALES QUE CONTENGAN OBLIGACIONES DE PAGAR CANTIDADES DE DINERO YA SEA PERIÓDICAMENTE O EN ÉPOCA FIJA".`,
        14,
      );

      // --- CUARTO ---
      writeClauseTitle('CUARTO:');
      writeParagraph(
        `Asimismo, se hace constar que en caso de que se tenga que ejecutar el presente pagaré, todos los gastos tales como pago de notificaciones, protesto, honorarios, gastos de ejecución y cualquier otro costo y gasto que hubiese de lugar correrán por cuenta de **LA DEUDORA/EL DEUDOR**, en el entendido de que el tenor del presente pagaré podrá ejecutarse en fecha de pago con o sin aviso del mismo.`,
        14,
      );

      // --- QUINTO ---
      writeClauseTitle('QUINTO:');
      writeParagraph(
        `Que dicho testimonio lo han manifestado de forma libre y voluntaria y que lo mismo obedece a la verdad; que el mismo acto le fue leído en su presencia, previo a que fuera firmado junto conmigo Notario Público que **CERTIFICO Y DOY FE.**`,
        20,
      );

      // =========================================================
      // RESUMEN DEL PRÉSTAMO — Cuadro informativo
      // =========================================================
      if (y + 70 > pageHeight - 80) { doc.addPage(); y = 50; }

      const summaryH = 60;
      doc.roundedRect(marginL, y, contentWidth, summaryH, 5).fill(COLORS.lightBg);
      doc.roundedRect(marginL, y, contentWidth, summaryH, 5)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.primary)
        .text('RESUMEN DEL PAGARÉ', marginL + 12, y + 8);
      doc.moveTo(marginL + 12, y + 21).lineTo(marginL + contentWidth - 12, y + 21)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      const col1 = marginL + 12;
      const col2 = marginL + contentWidth / 2 + 10;
      const lw = 110;
      const sRowY = y + 28;

      const drawSummaryField = (x: number, fy: number, label: string, value: string) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray).text(label, x, fy);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark).text(value, x + lw, fy);
      };

      drawSummaryField(col1, sRowY, 'Capital prestado:', formatCurrency(data.montoPrestado));
      drawSummaryField(col1, sRowY + 15, 'Total a devolver:', formatCurrency(data.totalAPagar));
      drawSummaryField(col2, sRowY, 'Cuotas:', `${data.numeroCuotas} x ${formatCurrency(data.montoCuota)}`);
      drawSummaryField(col2, sRowY + 15, 'Frecuencia de pago:', data.frecuenciaPago);

      y += summaryH + 35;

      // =========================================================
      // FIRMAS
      // =========================================================
      if (y + 100 > pageHeight - 60) { doc.addPage(); y = 50; }

      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textGray)
        .text(
          `En fe de lo anterior, se firma en ${data.ciudad}, a los ${data.diaLetras} días del mes de ${data.mesLetras} del año ${data.anioLetras}.`,
          marginL, y, { width: contentWidth, align: 'center' },
        );

      y += 35;

      // Layout: Deudor (izquierda) | Acreedores (derecha, apilados)
      const sigW = contentWidth / 2 - 30;

      // --- Firma Deudor ---
      const sig1X = marginL + 10;
      doc.moveTo(sig1X, y).lineTo(sig1X + sigW, y)
        .strokeColor(COLORS.divider).lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text('LA DEUDORA / EL DEUDOR', sig1X, y + 5, { width: sigW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark)
        .text(data.deudorNombre, sig1X, y + 17, { width: sigW, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text(`Cédula: ${data.deudorCedula}`, sig1X, y + 28, { width: sigW, align: 'center' });

      // --- Firmas Acreedores (columna derecha, apiladas) ---
      const sig2X = marginL + contentWidth / 2 + 20;

      // Acreedor 1
      doc.moveTo(sig2X, y).lineTo(sig2X + sigW, y)
        .strokeColor(COLORS.divider).lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text('ACREEDOR', sig2X, y + 5, { width: sigW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark)
        .text(acreedores[0].nombre, sig2X, y + 17, { width: sigW, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text(`Cédula: ${acreedores[0].cedula}`, sig2X, y + 28, { width: sigW, align: 'center' });

      y += 58;

      // Acreedor 2
      doc.moveTo(sig2X, y).lineTo(sig2X + sigW, y)
        .strokeColor(COLORS.divider).lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text('ACREEDOR', sig2X, y + 5, { width: sigW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark)
        .text(acreedores[1].nombre, sig2X, y + 17, { width: sigW, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text(`Cédula: ${acreedores[1].cedula}`, sig2X, y + 28, { width: sigW, align: 'center' });

      y += 70;

      // --- Firma Notario (centrada) ---
      if (y + 60 > pageHeight - 60) { doc.addPage(); y = 50; }

      const notarioSigW = contentWidth * 0.5;
      const notarioSigX = marginL + (contentWidth - notarioSigW) / 2;

      doc.moveTo(notarioSigX, y).lineTo(notarioSigX + notarioSigW, y)
        .strokeColor(COLORS.divider).lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text('ABOGADO, NOTARIO PÚBLICO', notarioSigX, y + 5, { width: notarioSigW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark)
        .text(data.notario.nombre, notarioSigX, y + 17, { width: notarioSigW, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text(`Matrícula No. ${data.notario.matricula}  |  Cédula: ${data.notario.cedula}`, notarioSigX, y + 28, { width: notarioSigW, align: 'center' });

      // =========================================================
      // FOOTER
      // =========================================================
      const footerY = pageHeight - 50 - 10;
      doc.moveTo(marginL, footerY + 5).lineTo(pageWidth - marginR, footerY + 5)
        .strokeColor(COLORS.divider).lineWidth(0.5).stroke();

      doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.textGray)
        .text(
          `Documento generado por LMS Credit Core  |  Acto No. ${data.numeroActo}  |  ${getTimestamp()}`,
          marginL, footerY - 5,
          { width: contentWidth, align: 'center' },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
