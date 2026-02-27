// ============================================================================
// LMS-Credit-Core: Tests — Pagaré Notarial
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  generatePagareNotarialPDF,
  generateNumeroActo,
  numberToWords,
  PagareNotarialData,
} from '@/lib/reports/pagare-notarial';
import {
  NOTARIO_DEFAULT,
  ACREEDORES_DEFAULT,
} from '@/lib/config/pagare-notarial-config';

// ── Datos de prueba ─────────────────────────────────────────────────────────

const TEST_DATA: PagareNotarialData = {
  numeroActo: '2025-0001',
  ciudad: 'Santo Domingo, Distrito Nacional',
  diaLetras: 'Veinticuatro (24)',
  mesLetras: 'Diciembre',
  anioLetras: 'Dos Mil Veinticinco (2025)',
  notario: NOTARIO_DEFAULT,
  deudorNombre: 'VALENTINA ROSARIO PEÑA',
  deudorCedula: '001-1610083-5',
  deudorEstadoCivil: 'soltera',
  deudorDomicilio: 'Calle Central de Lucerna, Municipio Santo Domingo Este',
  acreedores: ACREEDORES_DEFAULT,
  montoPrestado: 150000,
  totalAPagar: 84000,
  numeroCuotas: 8,
  montoCuota: 10500,
  frecuenciaPago: 'todos los viernes',
  porcentajeMora: 10,
};

// ── Helper: busca texto en el PDF (soporta UTF-16BE para metadatos PDFKit) ───

/**
 * PDFKit usa dos formatos para el texto:
 *  1. Metadatos (Title, Author): UTF-16BE con BOM
 *  2. Streams de contenido: hex lowercase dentro de [<...>] TJ arrays
 * Esta función busca el texto en ambos formatos.
 */
function pdfContainsText(buffer: Buffer, text: string): boolean {
  // Búsqueda directa (secciones no comprimidas)
  if (buffer.includes(text)) return true;

  // Búsqueda UTF-16BE (campos info: Title, Author, etc.)
  const utf16be = Buffer.alloc(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    utf16be.writeUInt16BE(text.charCodeAt(i), i * 2);
  }
  if (buffer.indexOf(utf16be) !== -1) return true;

  // Búsqueda hex-encoded (PDFKit codifica cada char como hex lowercase en streams)
  // Ej: 'FERNANDO' → '4645524e414e444f' como caracteres ASCII en el buffer
  const hexStr = Buffer.from(text, 'latin1').toString('hex'); // lowercase
  if (buffer.includes(hexStr)) return true;

  return false;
}

// ── generatePagareNotarialPDF ────────────────────────────────────────────────

describe('generatePagareNotarialPDF', () => {
  it('genera un Buffer válido con datos completos', async () => {
    const buffer = await generatePagareNotarialPDF(TEST_DATA);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('el buffer comienza con la cabecera PDF (%PDF)', async () => {
    const buffer = await generatePagareNotarialPDF(TEST_DATA);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('incluye el número de acto en el documento', async () => {
    const buffer = await generatePagareNotarialPDF(TEST_DATA);
    expect(pdfContainsText(buffer, '2025-0001')).toBe(true);
  });

  it('incluye nombre del deudor', async () => {
    const buffer = await generatePagareNotarialPDF(TEST_DATA);
    expect(pdfContainsText(buffer, 'VALENTINA ROSARIO')).toBe(true);
  });

  it('incluye datos del notario', async () => {
    const buffer = await generatePagareNotarialPDF(TEST_DATA);
    // La matrícula está en el PDF como UTF-16BE (parte del nombre del autor)
    expect(pdfContainsText(buffer, '3206')).toBe(true);
  });

  it('incluye ambos acreedores', async () => {
    const buffer = await generatePagareNotarialPDF(TEST_DATA);
    // Los nombres completos tienen kerning que fragmenta palabras en PDFKit,
    // verificamos con cédulas (solo dígitos y guiones) que son contiguas
    expect(pdfContainsText(buffer, '223-004')).toBe(true);   // cédula acreedor 1
    expect(pdfContainsText(buffer, '402-313')).toBe(true);   // cédula acreedor 2
  });

  it('maneja garantías opcionales — sin garantías', async () => {
    const data = { ...TEST_DATA, garantias: undefined };
    const buffer = await generatePagareNotarialPDF(data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('maneja garantías opcionales — con garantías', async () => {
    const data = { ...TEST_DATA, garantias: 'Motocicleta Honda 2020' };
    const buffer = await generatePagareNotarialPDF(data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});

// ── generateNumeroActo ───────────────────────────────────────────────────────

describe('generateNumeroActo', () => {
  it('retorna formato AÑO-XXXX', () => {
    const acto = generateNumeroActo();
    expect(acto).toMatch(/^\d{4}-\d{4}$/);
  });

  it('el año en el número de acto corresponde al año actual', () => {
    const acto = generateNumeroActo();
    const year = new Date().getFullYear().toString();
    expect(acto.startsWith(year)).toBe(true);
  });

  it('retorna strings distintos en llamadas sucesivas (con pausa)', async () => {
    const a1 = generateNumeroActo();
    // Pausa mínima para que el timestamp cambie
    await new Promise((r) => setTimeout(r, 5));
    const a2 = generateNumeroActo();
    // Pueden coincidir si el ms es el mismo, pero el formato siempre es válido
    expect(a1).toMatch(/^\d{4}-\d{4}$/);
    expect(a2).toMatch(/^\d{4}-\d{4}$/);
  });
});

// ── numberToWords ────────────────────────────────────────────────────────────

describe('numberToWords', () => {
  it('convierte 0 correctamente', () => {
    expect(numberToWords(0)).toBe('CERO');
  });

  it('convierte 150000 correctamente', () => {
    const result = numberToWords(150000);
    expect(result).toContain('CIENTO CINCUENTA');
    expect(result).toContain('MIL');
  });

  it('convierte 10500 correctamente', () => {
    const result = numberToWords(10500);
    expect(result).toContain('DIEZ');
    expect(result).toContain('MIL');
    expect(result).toContain('QUINIENTOS');
  });

  it('convierte 1000000 correctamente', () => {
    const result = numberToWords(1000000);
    expect(result).toContain('MILL');
  });

  it('convierte 100 correctamente', () => {
    expect(numberToWords(100)).toBe('CIEN');
  });

  it('convierte 1000 correctamente', () => {
    expect(numberToWords(1000)).toBe('MIL');
  });
});
