-- =========================================
-- MIGRACIÓN SQL: FORM 606 - COMPRAS DGII
-- =========================================
-- Sistema Multi-Tenant Fiscal-Aware para República Dominicana
-- Conforme a: NG-07-2018, NG-10-2018, NG-05-2019, Ley 32-23, Decreto 587-24

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- ENUMERACIONES (ENUM TYPES)
-- =========================================

CREATE TYPE regimen_itbis_enum AS ENUM (
    'EXENTO',           -- Entidades sin IVA (hospitales, bancos de sangre, servicios médicos)
    'GRAVADO_TOTAL',    -- Comercio gravado (papelería, comercializadora, retail)
    'PROPORCIONAL'      -- Insumos comunes no discriminables (mixto)
);

CREATE TYPE estado_registro_enum AS ENUM (
    'pendiente',        -- Cargado pero no validado
    'validado',         -- Pasó auditoría fiscal y listo para exportar
    'rechazado',        -- Falló validación
    'reportado'         -- Enviado a DGII
);

CREATE TYPE tipo_retencion_isr_enum AS ENUM (
    '01',   -- Servicios Profesionales (10% ISR)
    '02',   -- Alquileres (10% ISR)
    '03',   -- Servicios Técnicos (2% ISR)
    '04',   -- Transporte (2% ISR)
    '05',   -- Otros Servicios (2% ISR)
    '06',   -- Servicios de Telecomunicaciones (2% ISR)
    '07',   -- Servicios de Construcción (2% ISR)
    '08',   -- Servicios Financieros (1% ISR)
    '09',   -- Compra de Bienes (0% ISR)
    NULL    -- Sin retención ISR
);

-- =========================================
-- TABLA 1: CLIENTES (MULTI-TENANT)
-- =========================================

CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identidad Legal
    razon_social VARCHAR(255) NOT NULL,
    rnc_cedula VARCHAR(11) NOT NULL UNIQUE,
    
    -- Régimen Fiscal DGII
    regimen_itbis regimen_itbis_enum NOT NULL DEFAULT 'GRAVADO_TOTAL',
    
    -- Auditoria
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    
    -- Validaciones
    CONSTRAINT chk_rnc_cliente_len CHECK (length(rnc_cedula) IN (9, 11)),
    CONSTRAINT chk_razon_social_not_empty CHECK (length(trim(razon_social)) > 0)
);

CREATE INDEX idx_clientes_rnc ON clientes(rnc_cedula);
CREATE INDEX idx_clientes_activo ON clientes(activo);

-- =========================================
-- TABLA 2: REGLAS DE CATEGORIZACIÓN DINÁMICA
-- Machine Teaching Store para Proveedores
-- =========================================

CREATE TABLE reglas_categorizacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relación Multi-Tenant
    id_cliente UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Identificación del Proveedor
    rnc_proveedor VARCHAR(11) NOT NULL,
    
    -- Valores por Defecto (Máquina de Aprendizaje)
    tipo_bien_servicio_defecto VARCHAR(2) NOT NULL CHECK (tipo_bien_servicio_defecto ~ '^(01|02|03|04|05|06|07|08|09|10|11)$'),
    forma_pago_defecto VARCHAR(2) NOT NULL CHECK (forma_pago_defecto ~ '^(01|02|03|04|05|06|07)$'),
    tipo_retencion_isr_defecto VARCHAR(2) CHECK (tipo_retencion_isr_defecto ~ '^(01|02|03|04|05|06|07|08|09)$'),
    
    -- Concepto Personalizado
    concepto_defecto TEXT,
    
    -- Auditoría
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_rnc_proveedor_len CHECK (length(rnc_proveedor) IN (9, 11)),
    CONSTRAINT unique_cliente_proveedor UNIQUE (id_cliente, rnc_proveedor)
);

CREATE INDEX idx_reglas_cliente_proveedor ON reglas_categorizacion(id_cliente, rnc_proveedor);

-- =========================================
-- TABLA 3: REGISTROS 606 (MAESTRO)
-- 23 Campos Oficiales DGII en Orden Estricto
-- =========================================

CREATE TABLE registros_606 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- ===== MULTI-TENANT =====
    id_cliente UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- ===== CASILLA 1: RNC o Cédula del Proveedor (9 o 11 caracteres) =====
    rnc_cedula VARCHAR(11) NOT NULL,
    
    -- ===== CASILLA 2: Tipo ID (1=RNC, 2=Cédula) =====
    tipo_id INT NOT NULL CHECK (tipo_id IN (1, 2)),
    
    -- ===== CASILLA 3: Tipo de Bienes y Servicios Comprados ('01' al '11') =====
    tipo_bien_servicio VARCHAR(2) NOT NULL 
        CHECK (tipo_bien_servicio ~ '^(01|02|03|04|05|06|07|08|09|10|11)$'),
    
    -- ===== CASILLA 4: NCF (11 posiciones serie B, 13 para e-CF serie E) =====
    ncf VARCHAR(13) NOT NULL,
    
    -- ===== CASILLA 5: NCF o Documento Modificado (Solo B04/E34) =====
    ncf_modificado VARCHAR(13),
    
    -- ===== CASILLA 6: Fecha Comprobante (Formato AAAAMMDD) =====
    fecha_comprobante VARCHAR(8) NOT NULL,
    
    -- ===== CASILLA 7: Fecha Pago (Formato AAAAMMDD - Obligatoria si hay retenciones) =====
    fecha_pago VARCHAR(8),
    
    -- ===== CASILLA 8: Monto Facturado en Servicios =====
    monto_servicios NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (monto_servicios >= 0),
    
    -- ===== CASILLA 9: Monto Facturado en Bienes =====
    monto_bienes NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (monto_bienes >= 0),
    
    -- ===== CASILLA 10: CALCULADO - Total Facturado (Suma Automática) =====
    total_facturado NUMERIC(15, 2) GENERATED ALWAYS AS (monto_servicios + monto_bienes) STORED,
    
    -- ===== CASILLAS 11-22: IMPUESTOS Y RETENCIONES =====
    
    -- CASILLA 11: ITBIS Facturado
    itbis_facturado NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (itbis_facturado >= 0),
    
    -- CASILLA 12: ITBIS Retenido (Proveedor Informal B11/E41)
    itbis_retenido NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (itbis_retenido >= 0),
    
    -- CASILLA 13: ITBIS Proporcional (Régimen Proporcional)
    itbis_proporcional NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (itbis_proporcional >= 0),
    
    -- CASILLA 14: ITBIS al Costo (Régimen Exento - ISR Deductible)
    itbis_costo NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (itbis_costo >= 0),
    
    -- CASILLA 15: ITBIS a Adelantar (Régimen Gravado - Crédito IT-1)
    itbis_adelantar NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (itbis_adelantar >= 0),
    
    -- CASILLA 16: ITBIS Percibido (Siempre 0.00 - INHABILITADO por DGII)
    itbis_percibido NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (itbis_percibido = 0.00),
    
    -- CASILLA 17: Tipo de Retención de ISR ('01' al '09' o NULL)
    tipo_retencion_isr VARCHAR(2) CHECK (tipo_retencion_isr ~ '^(01|02|03|04|05|06|07|08|09)$' OR tipo_retencion_isr IS NULL),
    
    -- CASILLA 18: Monto de Retención de ISR
    monto_retencion_isr NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (monto_retencion_isr >= 0),
    
    -- CASILLA 19: ISR Percibido (Siempre 0.00 - INHABILITADO por DGII)
    isr_percibido NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (isr_percibido = 0.00),
    
    -- CASILLA 20: ISC (Impuesto Selectivo al Consumo)
    isc NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (isc >= 0),
    
    -- CASILLA 21: Otros Impuestos
    otros_impuestos NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (otros_impuestos >= 0),
    
    -- CASILLA 22: Propina Legal
    propina_legal NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (propina_legal >= 0),
    
    -- ===== CASILLA 23: Forma de Pago ('01' al '07') =====
    forma_pago VARCHAR(2) NOT NULL 
        CHECK (forma_pago ~ '^(01|02|03|04|05|06|07)$'),
    
    -- CAMPO PERSONALIZADO
    concepto_personalizado TEXT,
    
    -- ===== ESTADO Y AUDITORÍA =====
    estado estado_registro_enum NOT NULL DEFAULT 'pendiente',
    
    errores_validacion TEXT[], -- Array de errores de validación
    
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_validacion TIMESTAMP WITH TIME ZONE,
    
    -- Trazabilidad OCR/QR
    origen_ingesta VARCHAR(20) CHECK (origen_ingesta IN ('OCR', 'QR_CODE', 'MANUAL')),
    documento_fuente_url TEXT,
    
    -- Flag para "Segundo Envío" (Compras a Crédito con Retenciones Posteriores)
    es_segundo_envio BOOLEAN DEFAULT FALSE,
    id_registro_original UUID REFERENCES registros_606(id) ON DELETE SET NULL,
    
    -- Constraints Fiscales
    CONSTRAINT chk_rnc_reg_len CHECK (length(rnc_cedula) IN (9, 11)),
    CONSTRAINT chk_ncf_len CHECK (length(ncf) IN (11, 13)),
    CONSTRAINT chk_ncf_modificado_len CHECK (ncf_modificado IS NULL OR length(ncf_modificado) IN (11, 13)),
    CONSTRAINT chk_fecha_comprobante_format CHECK (fecha_comprobante ~ '^\d{8}$'),
    CONSTRAINT chk_fecha_pago_format CHECK (fecha_pago IS NULL OR fecha_pago ~ '^\d{8}$'),
    CONSTRAINT chk_itbis_percibido_zero CHECK (itbis_percibido = 0.00),
    CONSTRAINT chk_isr_percibido_zero CHECK (isr_percibido = 0.00)
);

-- Índices de Performance para Queries Fiscales
CREATE INDEX idx_registros_cliente ON registros_606(id_cliente);
CREATE INDEX idx_registros_cliente_periodo ON registros_606(id_cliente, substring(fecha_comprobante, 1, 6));
CREATE INDEX idx_registros_estado ON registros_606(estado);
CREATE INDEX idx_registros_ncf ON registros_606(ncf);
CREATE INDEX idx_registros_rnc_proveedor ON registros_606(rnc_cedula);
CREATE INDEX idx_registros_segundo_envio ON registros_606(id_registro_original, es_segundo_envio);

-- =========================================
-- TABLA 4: AUDITORÍA Y LOGS DE VALIDACIÓN
-- =========================================

CREATE TABLE auditoria_registros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    id_registro_606 UUID NOT NULL REFERENCES registros_606(id) ON DELETE CASCADE,
    id_cliente UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Tipo de evento
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN (
        'CREACION',
        'VALIDACION_EXITOSA',
        'VALIDACION_FALLIDA',
        'MODIFICACION',
        'EXPORTACION',
        'SEGUNDO_ENVIO',
        'RECHAZO_FISCAL'
    )),
    
    -- Descripción del evento
    descripcion TEXT,
    
    -- Datos de validación
    reglas_aplicadas TEXT[],
    errores_detectados TEXT[],
    
    -- Auditoría
    usuario_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    fecha_evento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_registro ON auditoria_registros(id_registro_606);
CREATE INDEX idx_auditoria_cliente ON auditoria_registros(id_cliente);
CREATE INDEX idx_auditoria_fecha ON auditoria_registros(fecha_evento);

-- =========================================
-- TABLA 5: EXPORTACIONES (HISTORIAL)
-- =========================================

CREATE TABLE exportaciones_606 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    id_cliente UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Período reportado (AAAAMMM)
    periodo VARCHAR(6) NOT NULL CHECK (periodo ~ '^\d{6}$'),
    
    -- Cantidad de registros exportados
    cantidad_registros INT NOT NULL CHECK (cantidad_registros > 0),
    
    -- Sumas de validación
    suma_total_facturado NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    suma_itbis_adelantar NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    suma_itbis_costo NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    suma_itbis_retenido NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    suma_isr_retenido NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Archivo generado
    nombre_archivo VARCHAR(255) NOT NULL,
    hash_md5 VARCHAR(32),
    url_descarga TEXT,
    
    -- Estado de envío a DGII
    enviado_dgii BOOLEAN DEFAULT FALSE,
    fecha_envio_dgii TIMESTAMP WITH TIME ZONE,
    confirmacion_dgii TEXT,
    
    -- Auditoría
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id VARCHAR(255),
    
    CONSTRAINT unique_cliente_periodo UNIQUE (id_cliente, periodo)
);

CREATE INDEX idx_exportaciones_cliente ON exportaciones_606(id_cliente);
CREATE INDEX idx_exportaciones_periodo ON exportaciones_606(periodo);

-- =========================================
-- FUNCIÓN TRIGGER: UPDATE TIMESTAMP
-- =========================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas editables
CREATE TRIGGER update_clientes_timestamp BEFORE UPDATE ON clientes
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_reglas_timestamp BEFORE UPDATE ON reglas_categorizacion
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_registros_timestamp BEFORE UPDATE ON registros_606
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- =========================================
-- FUNCIÓN: VALIDACIÓN AUTOMÁTICA DE MONTOS
-- =========================================

CREATE OR REPLACE FUNCTION validar_montos_registros_606()
RETURNS TRIGGER AS $$
BEGIN
    -- Total facturado = monto_servicios + monto_bienes (CALCULADO)
    -- Esta columna es GENERATED, así que se calcula automáticamente
    
    -- Validación: ITBIS facturado no debe exceder 18% del total
    IF NEW.total_facturado > 0 AND (NEW.itbis_facturado / NEW.total_facturado) > 0.18 THEN
        RAISE WARNING 'ITBIS facturado (%) excede el 18% del neto imponible', 
            ROUND((NEW.itbis_facturado / NEW.total_facturado) * 100, 2);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_montos_registros BEFORE INSERT OR UPDATE ON registros_606
FOR EACH ROW EXECUTE PROCEDURE validar_montos_registros_606();

-- =========================================
-- VISTAS ÚTILES PARA REPORTES
-- =========================================

-- Vista: Resumen Mensual por Cliente
CREATE VIEW v_resumen_mensual AS
SELECT 
    c.id as id_cliente,
    c.razon_social,
    c.rnc_cedula,
    c.regimen_itbis,
    LEFT(r.fecha_comprobante, 6) as periodo,
    COUNT(*) as cantidad_registros,
    SUM(r.total_facturado) as total_facturado,
    SUM(r.itbis_adelantar) as total_itbis_adelantar,
    SUM(r.itbis_costo) as total_itbis_costo,
    SUM(r.itbis_retenido) as total_itbis_retenido,
    SUM(r.monto_retencion_isr) as total_isr_retenido,
    COUNT(CASE WHEN r.estado = 'validado' THEN 1 END) as registros_validados,
    COUNT(CASE WHEN r.estado = 'pendiente' THEN 1 END) as registros_pendientes
FROM clientes c
LEFT JOIN registros_606 r ON c.id = r.id_cliente
GROUP BY c.id, c.razon_social, c.rnc_cedula, c.regimen_itbis, LEFT(r.fecha_comprobante, 6);

-- Vista: Proveedores por Cliente
CREATE VIEW v_proveedores_cliente AS
SELECT DISTINCT
    id_cliente,
    rnc_cedula as rnc_proveedor,
    COUNT(*) as cantidad_compras,
    SUM(total_facturado) as monto_total,
    MAX(fecha_comprobante) as ultima_compra
FROM registros_606
WHERE estado IN ('validado', 'reportado')
GROUP BY id_cliente, rnc_cedula
ORDER BY monto_total DESC;

-- =========================================
-- COMENTARIOS INFORMATIVOS PARA DEVS
-- =========================================

COMMENT ON TABLE registros_606 IS 'Formato 606: Registro de Compras de Bienes y Servicios según DGII. 23 campos oficiales conforme NG-07-2018, NG-10-2018, NG-05-2019, Ley 32-23, Decreto 587-24';

COMMENT ON COLUMN registros_606.forma_pago IS 'Códigos: 01=Efectivo, 02=Cheque/Transferencia, 03=Tarjeta Crédito, 04=Crédito, 05=Permuta, 06=Venta a Plazo, 07=Otro';

COMMENT ON COLUMN registros_606.tipo_bien_servicio IS 'Códigos: 01=Combustibles, 02=Materias Primas, 03=Repuestos y Accesorios, 04=Equipos, 05=Servicios, 06=Activos Fijos, 07=Gastos Menores, 08=Pagos al Exterior, 09=Telecomunicaciones, 10=Pagos por Alquileres, 11=Otros';

COMMENT ON COLUMN registros_606.tipo_retencion_isr IS 'Códigos ISR: 01=Profesionales (10%), 02=Alquileres (10%), 03=Servicios Técnicos (2%), 04=Transporte (2%), 05=Otros Servicios (2%), 06=Telecomunicaciones (2%), 07=Construcción (2%), 08=Financieros (1%), 09=Compra de Bienes (0%)';

COMMENT ON COLUMN registros_606.es_segundo_envio IS 'Flag para mecánica "Segundo Envío": Forma de Pago=04 (Crédito) requiere reporte cuando se paga. Este registro duplicado contiene las retenciones finales.';

-- =========================================
-- POLÍTICA RLS (Row Level Security) - OPCIONAL
-- Para sistemas multi-tenant strict, descomentar:
-- =========================================

/*
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_606 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_categorizacion ENABLE ROW LEVEL SECURITY;

-- Políticas serían definidas según user auth context
-- CREATE POLICY client_isolation ON registros_606 FOR SELECT
--     USING (id_cliente = current_setting('app.id_cliente')::uuid);
*/

-- =========================================
-- FIN DE MIGRACIÓN
-- =========================================
