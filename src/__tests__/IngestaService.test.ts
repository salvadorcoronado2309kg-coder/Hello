import { describe, it, expect, beforeEach } from 'vitest';
import { IngestaService, ErrorFiscalDGII } from '@/services/IngestaService';
import { RegimenITBIS, TipoID, EstadoRegistro, OrigenIngesta, TipoEventoAuditoria } from '@/types';
import type { Cliente, CreateRegistro606DTO, Registro606 } from '@/types';

const clienteGravado: Cliente = {
  id: 'cli-001',
  razonSocial: 'PAPELERÍA EL ESTUDIANTE SRL',
  rncCedula: '101234567',
  regimenITBIS: RegimenITBIS.GRAVADO_TOTAL,
  fechaCreacion: new Date('2025-01-01'),
  fechaActualizacion: new Date('2025-01-01'),
  activo: true,
};

const clienteExento: Cliente = {
  ...clienteGravado,
  id: 'cli-002',
  rncCedula: '102345678',
  regimenITBIS: RegimenITBIS.EXENTO,
};

const clienteProporcional: Cliente = {
  ...clienteGravado,
  id: 'cli-003',
  rncCedula: '103456789',
  regimenITBIS: RegimenITBIS.PROPORCIONAL,
};

const dtoBase: CreateRegistro606DTO = {
  rncCedula: '101234567',
  tipoID: TipoID.RNC,
  tipoBienServicio: '05',
  ncf: 'B0100000001',
  fechaComprobante: '20260101',
  montoServicios: 1000,
  montoBienes: 0,
  itbisFacturado: 180,
  formaPago: '02',
  origenIngesta: OrigenIngesta.MANUAL,
};

function makeRegistro(overrides: Partial<Registro606> = {}): Registro606 {
  return {
    id: 'reg-001',
    idCliente: 'cli-001',
    rncCedula: '101234567',
    tipoID: TipoID.RNC,
    tipoBienServicio: '05',
    ncf: 'B0100000001',
    ncfModificado: undefined,
    fechaComprobante: '20260101',
    fechaPago: undefined,
    montoServicios: 1000,
    montoBienes: 0,
    totalFacturado: 1000,
    itbisFacturado: 180,
    itbisRetenido: 0,
    itbisProporcional: 0,
    itbisCosto: 0,
    itbisAdelantar: 0,
    itbisPercibido: 0,
    tipoRetencionISR: undefined,
    montoRetencionISR: 0,
    isrPercibido: 0,
    isc: 0,
    otrosImpuestos: 0,
    propinaLegal: 0,
    formaPago: '02',
    conceptoPersonalizado: undefined,
    estado: EstadoRegistro.PENDIENTE,
    erroresValidacion: undefined,
    fechaCreacion: new Date('2026-01-01'),
    fechaActualizacion: new Date('2026-01-01'),
    fechaValidacion: undefined,
    origenIngesta: OrigenIngesta.MANUAL,
    esSegundoEnvio: false,
    idRegistroOriginal: undefined,
    ...overrides,
  };
}

describe('IngestaService', () => {
  let svc: IngestaService;
  beforeEach(() => { svc = new IngestaService(); });

  // ──────────────────────────────────────────────
  // REGLA A: Bloqueo consumidor final
  // ──────────────────────────────────────────────
  describe('Regla A — Bloqueo consumidor final (B02/E32)', () => {
    it('bloquea NCF físico B02', async () => {
      const dto = { ...dtoBase, ncf: 'B0200000001' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.esValido).toBe(false);
      expect(r.errores.some(e => e.codigo === 'ERR_B02_E32_BLOQUEADO')).toBe(true);
    });
    it('bloquea e-CF E32', async () => {
      const dto = { ...dtoBase, ncf: 'E320000000001' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.esValido).toBe(false);
      expect(r.errores[0].codigo).toBe('ERR_B02_E32_BLOQUEADO');
    });
    it('aplica regla REGLA_A_BLOQUEO_CONSUMIDOR_FINAL', async () => {
      const dto = { ...dtoBase, ncf: 'B0200000001' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.reglasAplicadas).toContain('REGLA_A_BLOQUEO_CONSUMIDOR_FINAL');
    });
    it('no bloquea NCF de crédito fiscal B01', async () => {
      const r = await svc.validarRegistroFiscal(dtoBase, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_B02_E32_BLOQUEADO')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // REGLA B: Bifurcación ITBIS por régimen
  // ──────────────────────────────────────────────
  describe('Regla B — Bifurcación ITBIS', () => {
    it('GRAVADO_TOTAL: advierte si itbisCosto > 0', async () => {
      const reg = makeRegistro({ itbisCosto: 180 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'itbisCosto')).toBe(true);
    });
    it('GRAVADO_TOTAL: no advierte si itbisCosto = 0', async () => {
      const reg = makeRegistro({ itbisCosto: 0, itbisAdelantar: 180 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'itbisCosto')).toBe(false);
    });
    it('EXENTO: advierte si itbisAdelantar > 0', async () => {
      const reg = makeRegistro({ itbisAdelantar: 180 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteExento });
      expect(r.advertencias.some(a => a.campo === 'itbisAdelantar')).toBe(true);
    });
    it('EXENTO: no advierte si itbisAdelantar = 0', async () => {
      const reg = makeRegistro({ itbisAdelantar: 0, itbisCosto: 180 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteExento });
      expect(r.advertencias.some(a => a.campo === 'itbisAdelantar')).toBe(false);
    });
    it('PROPORCIONAL: advierte sobre itbisProporcional', async () => {
      const reg = makeRegistro({ itbisCosto: 90, itbisProporcional: 90 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteProporcional });
      expect(r.advertencias.some(a => a.campo === 'itbisCosto')).toBe(true);
    });
    it('aplica regla REGLA_B_BIFURCACION_ITBIS', async () => {
      const r = await svc.validarRegistroFiscal(dtoBase, { cliente: clienteGravado });
      expect(r.reglasAplicadas).toContain('REGLA_B_BIFURCACION_ITBIS');
    });
  });

  // ──────────────────────────────────────────────
  // REGLA C1: Proveedor informal B11/E41
  // ──────────────────────────────────────────────
  describe('Regla C1 — Proveedor informal (B11/E41)', () => {
    it('bloquea si rncCedula no tiene 11 dígitos', async () => {
      const dto = { ...dtoBase, ncf: 'B1100000001', rncCedula: '101234567' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_B11_E41_CEDULA_REQUERIDA')).toBe(true);
    });
    it('bloquea si tipoID es RNC (1) en vez de Cédula (2)', async () => {
      const dto = { ...dtoBase, ncf: 'B1100000001', rncCedula: '00100123456', tipoID: TipoID.RNC };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_B11_E41_TIPO_ID')).toBe(true);
    });
    it('no bloquea con cédula de 11 dígitos y tipoID=2', async () => {
      const dto = { ...dtoBase, ncf: 'B1100000001', rncCedula: '00100123456', tipoID: TipoID.CEDULA };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => ['ERR_B11_E41_CEDULA_REQUERIDA', 'ERR_B11_E41_TIPO_ID'].includes(e.codigo))).toBe(false);
    });
    it('advierte sobre retención ITBIS al 100%', async () => {
      const reg = makeRegistro({ ncf: 'B1100000001', rncCedula: '00100123456', tipoID: TipoID.CEDULA, itbisFacturado: 180, itbisRetenido: 0 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'itbisRetenido')).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // REGLA C2: Gastos menores B13/E43
  // ──────────────────────────────────────────────
  describe('Regla C2 — Gastos menores (B13/E43)', () => {
    it('bloquea si rncCedula no es el RNC del cliente', async () => {
      const dto = { ...dtoBase, ncf: 'B1300000001', rncCedula: '999999999' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_B13_E43_RNC_CLIENTE')).toBe(true);
    });
    it('pasa si rncCedula coincide con cliente', async () => {
      const dto = { ...dtoBase, ncf: 'B1300000001', rncCedula: clienteGravado.rncCedula };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_B13_E43_RNC_CLIENTE')).toBe(false);
    });
    it('advierte si itbisFacturado > 0', async () => {
      const reg = makeRegistro({ ncf: 'B1300000001', rncCedula: clienteGravado.rncCedula, itbisFacturado: 100 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'itbisFacturado')).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // REGLA C3: Pagos al exterior B17/E47
  // ──────────────────────────────────────────────
  describe('Regla C3 — Pagos al exterior (B17/E47)', () => {
    it('bloquea si rncCedula no es el RNC del cliente', async () => {
      const dto = { ...dtoBase, ncf: 'B1700000001', rncCedula: '999999999' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_B17_E47_RNC_CLIENTE')).toBe(true);
    });
    it('emite advertencia sobre liquidación en Formato 609', async () => {
      const dto = { ...dtoBase, ncf: 'B1700000001', rncCedula: clienteGravado.rncCedula };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'montoRetencionISR' && a.mensaje.includes('609'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // REGLA C4: Notas de crédito/débito (B04/E34)
  // ──────────────────────────────────────────────
  describe('Regla C4 — Notas de crédito/débito', () => {
    it('bloquea nota de crédito sin ncfModificado', async () => {
      const dto = { ...dtoBase, ncf: 'B0400000001', ncfModificado: undefined };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_NOTA_CREDITO_NCF_MODIFICADO')).toBe(true);
    });
    it('acepta nota de crédito con ncfModificado de 11 caracteres', async () => {
      const dto = { ...dtoBase, ncf: 'B0400000001', ncfModificado: 'B0100000001' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_NOTA_CREDITO_NCF_MODIFICADO')).toBe(false);
    });
    it('acepta nota de crédito con ncfModificado de 13 caracteres (e-CF)', async () => {
      const dto = { ...dtoBase, ncf: 'B0400000001', ncfModificado: 'E310000000001' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_NOTA_CREDITO_NCF_MODIFICADO')).toBe(false);
    });
    it('error CRITICO si ncfModificado tiene longitud incorrecta', async () => {
      const dto = { ...dtoBase, ncf: 'B0400000001', ncfModificado: 'B01001' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_NOTA_CREDITO_NCF_FORMAT')).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // Validación de estructura (campos obligatorios)
  // ──────────────────────────────────────────────
  describe('Validación de estructura', () => {
    it('falla cuando rncCedula está vacío', async () => {
      const dto = { ...dtoBase, rncCedula: '' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.esValido).toBe(false);
      expect(r.errores.some(e => e.campo === 'rncCedula' && e.codigo.includes('OBLIGATORIO'))).toBe(true);
    });
    it('falla cuando formaPago está vacío', async () => {
      const dto = { ...dtoBase, formaPago: '' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.campo === 'formaPago')).toBe(true);
    });
    it('pasa con todos los campos obligatorios presentes', async () => {
      const r = await svc.validarRegistroFiscal(dtoBase, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo.includes('OBLIGATORIO'))).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // Validación de formatos
  // ──────────────────────────────────────────────
  describe('Validación de formatos', () => {
    it('falla con NCF de longitud incorrecta', async () => {
      const dto = { ...dtoBase, ncf: 'B010001' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_NCF_LONGITUD')).toBe(true);
    });
    it('falla con RNC de longitud incorrecta', async () => {
      const dto = { ...dtoBase, rncCedula: '123456' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_RNC_CEDULA_LONGITUD')).toBe(true);
    });
    it('falla con fecha en formato incorrecto', async () => {
      const dto = { ...dtoBase, fechaComprobante: '2026-01-01' };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.errores.some(e => e.codigo === 'ERR_FECHA_COMPROBANTE_FORMAT')).toBe(true);
    });
    it('pasa con formatos correctos', async () => {
      const r = await svc.validarRegistroFiscal(dtoBase, { cliente: clienteGravado });
      const codigosFormato = ['ERR_NCF_LONGITUD', 'ERR_RNC_CEDULA_LONGITUD', 'ERR_FECHA_COMPROBANTE_FORMAT'];
      expect(r.errores.some(e => codigosFormato.includes(e.codigo))).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // Validación aritmética
  // ──────────────────────────────────────────────
  describe('Validación aritmética', () => {
    it('advierte si totalFacturado no coincide con la suma', async () => {
      const reg = makeRegistro({ montoServicios: 1000, montoBienes: 0, totalFacturado: 999 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'totalFacturado')).toBe(true);
    });
    it('no advierte si totalFacturado coincide exactamente', async () => {
      const reg = makeRegistro({ montoServicios: 1000, montoBienes: 0, totalFacturado: 1000 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'totalFacturado')).toBe(false);
    });
    it('tolera diferencia de $0.01 (redondeo)', async () => {
      const reg = makeRegistro({ montoServicios: 1000.00, montoBienes: 0, totalFacturado: 1000.01 });
      const r = await svc.validarRegistroFiscal(reg, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'totalFacturado')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // Validación semáforo ITBIS (>18%)
  // ──────────────────────────────────────────────
  describe('Validación semáforo ITBIS', () => {
    it('advierte cuando ITBIS excede 18%', async () => {
      const dto = { ...dtoBase, montoServicios: 1000, itbisFacturado: 200 };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'itbisFacturado')).toBe(true);
    });
    it('no advierte con ITBIS de 18%', async () => {
      const dto = { ...dtoBase, montoServicios: 1000, itbisFacturado: 180 };
      const r = await svc.validarRegistroFiscal(dto, { cliente: clienteGravado });
      expect(r.advertencias.some(a => a.campo === 'itbisFacturado')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // Segundo Envío
  // ──────────────────────────────────────────────
  describe('procesarSegundoEnvio', () => {
    it('lanza error si formaPago del original no es crédito (04)', async () => {
      const original = makeRegistro({ formaPago: '02' });
      await expect(svc.procesarSegundoEnvio(original, {})).rejects.toMatchObject({ codigo: 'ERR_SEGUNDO_ENVIO_NO_CREDITO' });
    });
    it('crea DTO de segundo envío para compras a crédito', async () => {
      const original = makeRegistro({ formaPago: '04', ncf: 'B0100000001' });
      const dto = await svc.procesarSegundoEnvio(original, { formaPago: '02', fechaPago: '20260201' });
      expect(dto.formaPago).toBe('02');
      expect(dto.fechaPago).toBe('20260201');
      expect(dto.conceptoPersonalizado).toContain('[SEGUNDO ENVÍO]');
    });
    it('mantiene los datos del registro original', async () => {
      const original = makeRegistro({ formaPago: '04', rncCedula: '101234567', ncf: 'B0100000001' });
      const dto = await svc.procesarSegundoEnvio(original, {});
      expect(dto.rncCedula).toBe('101234567');
      expect(dto.ncf).toBe('B0100000001');
    });
  });

  // ──────────────────────────────────────────────
  // crearEventoAuditoria
  // ──────────────────────────────────────────────
  describe('crearEventoAuditoria', () => {
    it('crea evento con UUID y fecha actuales', () => {
      const evento = svc.crearEventoAuditoria('reg-001', 'cli-001', TipoEventoAuditoria.CREACION, 'Test');
      expect(evento.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(evento.fechaEvento).toBeInstanceOf(Date);
    });
    it('persiste el tipo de evento', () => {
      const evento = svc.crearEventoAuditoria('reg-001', 'cli-001', TipoEventoAuditoria.EXPORTACION, 'export');
      expect(evento.tipoEvento).toBe(TipoEventoAuditoria.EXPORTACION);
    });
    it('incluye reglas aplicadas y errores detectados', () => {
      const evento = svc.crearEventoAuditoria('r', 'c', TipoEventoAuditoria.VALIDACION_FALLIDA, 'd', ['REGLA_A'], ['err1']);
      expect(evento.reglasAplicadas).toContain('REGLA_A');
      expect(evento.erroresDetectados).toContain('err1');
    });
  });

  // ──────────────────────────────────────────────
  // ErrorFiscalDGII
  // ──────────────────────────────────────────────
  describe('ErrorFiscalDGII', () => {
    it('es instancia de Error', () => {
      const e = new ErrorFiscalDGII('COD', 'mensaje');
      expect(e).toBeInstanceOf(Error);
    });
    it('tiene severidad BLOQUEANTE por defecto', () => {
      const e = new ErrorFiscalDGII('COD', 'msg');
      expect(e.severidad).toBe('BLOQUEANTE');
    });
    it('permite especificar severidad', () => {
      const e = new ErrorFiscalDGII('COD', 'msg', 'CRITICO');
      expect(e.severidad).toBe('CRITICO');
    });
  });
});
