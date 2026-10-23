# Hello
Hello code

## Importar compras desde la app de práctica contable

`POST /api/importar/606` con sesión iniciada y el cuerpo:

```json
{ "filas": [ { "rnc": "101234567", "ncf": "B0100000001", "tipo_bien": "05",
               "fecha": "2026-10-03", "concepto": "Compra de mercancía", "monto": 80000, "itbis": 14400 } ] }
```

Crea registros 606 en estado `pendiente`. Las filas incompletas se devuelven en `omitidos` con el motivo.
La clasificación de montos (bienes o servicios) es un borrador y debe revisarla un contador.
