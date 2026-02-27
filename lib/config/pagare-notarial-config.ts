// ============================================================================
// LMS-Credit-Core: Configuración fija del Pagaré Notarial
// Archivo: lib/config/pagare-notarial-config.ts
// ============================================================================

import { NotarioData, AcreedorData } from '@/lib/reports/pagare-notarial';

export const NOTARIO_DEFAULT: NotarioData = {
  nombre: 'LIC. RAMÓN H. GÓMEZ ALMONTE',
  cedula: '043-0000010-8',
  matricula: '3206',
  estudio:
    'Calle Barahona No. 229, Edificio Sara, Local 204, próximo a la Avenida 27 de Febrero, Villa Consuelo, Santo Domingo de Guzmán, Distrito Nacional',
};

export const ACREEDORES_DEFAULT: [AcreedorData, AcreedorData] = [
  {
    nombre: 'FERNANDO VALENZUELA',
    cedula: '223-00436168-5',
    estadoCivil: 'soltero',
    domicilio:
      'Calle Universo #65, sector Lucerna, Municipio Santo Domingo Este, Provincia Santo Domingo',
  },
  {
    nombre: 'MELVIN LUIS DE LA CRUZ CONCEPCIÓN',
    cedula: '402-3136543-0',
    estadoCivil: 'soltero',
    domicilio: 'Santo Domingo Este, Provincia Santo Domingo',
  },
];

export const CIUDAD_DEFAULT = 'Santo Domingo, Distrito Nacional';
