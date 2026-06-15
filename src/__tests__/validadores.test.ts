import { describe, it, expect } from 'vitest';
import {
  validarRNC,
  validarNCF,
  validarFechaDGII,
  validarPeriodo,
  validarMonto,
  validarITBIS,
  esNCFConsumidorFinal,
  esNCFNotaCredito,
  esNCFNotaDebito,
  esNCFProveedorInformal,
  esNCFGastosMenores,
  esNCFPagoExterior,
  inferirTipoID,
} from '@/utils/validadores';

describe('validarRNC', () => {
  it('acepta RNC de 9 dígitos', () => {
    expect(validarRNC('101234567').valido).toBe(true);
  });
  it('acepta cédula de 11 dígitos', () => {
    expect(validarRNC('00100123456').valido).toBe(true);
  });
  it('acepta RNC con guiones (normaliza)', () => {
    expect(validarRNC('1-01-23456-7').valido).toBe(true);
  });
  it('rechaza RNC con menos de 9 dígitos', () => {
    const r = validarRNC('12345');
    expect(r.valido).toBe(false);
    expect(r.mensaje).toContain('9 o 11');
  });
  it('rechaza RNC con 10 dígitos', () => {
    expect(validarRNC('1234567890').valido).toBe(false);
  });
});

describe('validarNCF', () => {
  it('acepta NCF físico de 11 caracteres', () => {
    expect(validarNCF('B0100000001').valido).toBe(true);
  });
  it('acepta e-CF de 13 caracteres', () => {
    expect(validarNCF('E3100000000001').valido).toBe(false); // 14 chars
    expect(validarNCF('E310000000001').valido).toBe(true);   // 13 chars
  });
  it('rechaza NCF vacío', () => {
    expect(validarNCF('').valido).toBe(false);
  });
  it('rechaza NCF con longitud incorrecta', () => {
    const r = validarNCF('B01000');
    expect(r.valido).toBe(false);
    expect(r.mensaje).toContain('11');
  });
  it('normaliza a mayúsculas antes de validar longitud', () => {
    expect(validarNCF('b0100000001').valido).toBe(true);
  });
});

describe('validarFechaDGII', () => {
  it('acepta fecha AAAAMMDD válida', () => {
    expect(validarFechaDGII('20260115').valido).toBe(true);
  });
  it('rechaza fecha vacía', () => {
    expect(validarFechaDGII('').valido).toBe(false);
  });
  it('rechaza formato no numérico', () => {
    expect(validarFechaDGII('2026-01-15').valido).toBe(false);
  });
  it('rechaza mes inválido (13)', () => {
    const r = validarFechaDGII('20261301');
    expect(r.valido).toBe(false);
    expect(r.mensaje).toContain('Mes');
  });
  it('rechaza día inválido (00)', () => {
    expect(validarFechaDGII('20260100').valido).toBe(false);
  });
  it('rechaza año fuera de rango', () => {
    expect(validarFechaDGII('19990101').valido).toBe(false);
  });
});

describe('validarPeriodo', () => {
  it('acepta período AAAAMM válido', () => {
    expect(validarPeriodo('202601').valido).toBe(true);
  });
  it('rechaza período con formato incorrecto', () => {
    expect(validarPeriodo('2026-01').valido).toBe(false);
  });
  it('rechaza mes 00', () => {
    expect(validarPeriodo('202600').valido).toBe(false);
  });
  it('rechaza mes 13', () => {
    expect(validarPeriodo('202613').valido).toBe(false);
  });
});

describe('validarMonto', () => {
  it('acepta monto positivo', () => {
    expect(validarMonto(100.50).valido).toBe(true);
  });
  it('acepta monto cero', () => {
    expect(validarMonto(0).valido).toBe(true);
  });
  it('acepta undefined (campo opcional)', () => {
    expect(validarMonto(undefined).valido).toBe(true);
  });
  it('rechaza monto negativo', () => {
    const r = validarMonto(-1, 'Total');
    expect(r.valido).toBe(false);
    expect(r.mensaje).toContain('negativo');
  });
  it('rechaza NaN', () => {
    expect(validarMonto(NaN).valido).toBe(false);
  });
});

describe('validarITBIS', () => {
  it('válido cuando ITBIS es exactamente 18%', () => {
    const r = validarITBIS(18, 100);
    expect(r.valido).toBe(true);
    expect(r.advertencia).toBeUndefined();
  });
  it('emite advertencia cuando ITBIS supera 18%', () => {
    const r = validarITBIS(19, 100);
    expect(r.valido).toBe(true);
    expect(r.advertencia).toContain('19.00%');
  });
  it('no emite advertencia con ITBIS menor a 18%', () => {
    const r = validarITBIS(10, 100);
    expect(r.advertencia).toBeUndefined();
  });
  it('válido cuando totalFacturado es 0', () => {
    expect(validarITBIS(0, 0).valido).toBe(true);
  });
});

describe('clasificadores NCF', () => {
  it('esNCFConsumidorFinal detecta B02 y E32', () => {
    expect(esNCFConsumidorFinal('B0200000001')).toBe(true);
    expect(esNCFConsumidorFinal('E320000000001')).toBe(true);
    expect(esNCFConsumidorFinal('B0100000001')).toBe(false);
  });
  it('esNCFNotaCredito detecta B04 y E34', () => {
    expect(esNCFNotaCredito('B0400000001')).toBe(true);
    expect(esNCFNotaCredito('E340000000001')).toBe(true);
    expect(esNCFNotaCredito('B0300000001')).toBe(false);
  });
  it('esNCFNotaDebito detecta B03 y E33', () => {
    expect(esNCFNotaDebito('B0300000001')).toBe(true);
    expect(esNCFNotaDebito('E330000000001')).toBe(true);
  });
  it('esNCFProveedorInformal detecta B11 y E41', () => {
    expect(esNCFProveedorInformal('B1100000001')).toBe(true);
    expect(esNCFProveedorInformal('E410000000001')).toBe(true);
    expect(esNCFProveedorInformal('B0100000001')).toBe(false);
  });
  it('esNCFGastosMenores detecta B13 y E43', () => {
    expect(esNCFGastosMenores('B1300000001')).toBe(true);
    expect(esNCFGastosMenores('E430000000001')).toBe(true);
  });
  it('esNCFPagoExterior detecta B17 y E47', () => {
    expect(esNCFPagoExterior('B1700000001')).toBe(true);
    expect(esNCFPagoExterior('E470000000001')).toBe(true);
  });
  it('clasificadores son case-insensitive (normalizan a uppercase)', () => {
    expect(esNCFConsumidorFinal('b0200000001')).toBe(true);
    expect(esNCFProveedorInformal('e410000000001')).toBe(true);
  });
});

describe('inferirTipoID', () => {
  it('infiere RNC (1) para 9 dígitos', () => {
    expect(inferirTipoID('101234567')).toBe(1);
  });
  it('infiere Cédula (2) para 11 dígitos', () => {
    expect(inferirTipoID('00100123456')).toBe(2);
  });
  it('normaliza guiones antes de inferir', () => {
    expect(inferirTipoID('1-01-23456-7')).toBe(1);
  });
});
