#!/usr/bin/env bash
set -e

AZUL='\033[0;34m'
VERDE='\033[0;32m'
ROJO='\033[0;31m'
AMARILLO='\033[1;33m'
NC='\033[0m'

echo -e "${AZUL}"
echo "╔════════════════════════════════════════╗"
echo "║     Form 606 DGII — Instalación       ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"
echo "  No necesitas Supabase ni ninguna cuenta externa."
echo "  La base de datos se crea automáticamente en tu equipo."
echo ""

# ── Verificar Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${ROJO}✗ Node.js no encontrado.${NC}"
  echo "  Instálalo desde https://nodejs.org  (versión 18 o superior)"
  exit 1
fi

NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>&1 && echo "ok" || echo "viejo")
if [[ "$NODE_VER" == "viejo" ]]; then
  echo -e "${ROJO}✗ Node.js $(node -v) es muy antiguo. Necesitas v18+.${NC}"
  exit 1
fi
echo -e "${VERDE}✓ Node.js $(node -v)${NC}"

# ── Instalar dependencias ──────────────────────────────────────────────────────
echo ""
echo -e "${AZUL}▶ Instalando dependencias...${NC}"
npm install
echo -e "${VERDE}✓ Dependencias instaladas${NC}"

# ── Crear .env.local si no existe ─────────────────────────────────────────────
echo ""
if [[ -f .env.local ]]; then
  echo -e "${AMARILLO}⚠  .env.local ya existe — se omite.${NC}"
else
  # Genera un secreto JWT aleatorio
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cat > .env.local <<EOF
JWT_SECRET=${JWT_SECRET}
DATABASE_PATH=./data/form606.db
EOF
  echo -e "${VERDE}✓ .env.local creado con clave JWT segura${NC}"
fi

# ── Crear carpeta de datos ─────────────────────────────────────────────────────
mkdir -p data
echo -e "${VERDE}✓ Carpeta data/ lista${NC}"

# ── Construir o arrancar dev ───────────────────────────────────────────────────
echo ""
echo -e "${AZUL}▶ ¿Qué quieres hacer?${NC}"
echo "  1) Arrancar servidor de desarrollo (npm run dev)"
echo "  2) Construir para producción (npm run build)"
echo "  3) Solo instalar (salir)"
echo ""
read -p "  Opción [1]: " OPCION
OPCION=${OPCION:-1}

case "$OPCION" in
  1)
    echo ""
    echo -e "${VERDE}✓ Iniciando servidor en http://localhost:3000${NC}"
    echo -e "  Abre el navegador en ${AZUL}http://localhost:3000${NC}"
    echo -e "  Presiona ${AZUL}Ctrl+C${NC} para detener."
    echo ""
    npm run dev
    ;;
  2)
    echo ""
    echo -e "${AZUL}▶ Construyendo...${NC}"
    npm run build
    echo ""
    echo -e "${VERDE}✓ Build completado. Para arrancar: npm start${NC}"
    ;;
  3)
    echo ""
    echo -e "${VERDE}✓ Instalación completa.${NC}"
    echo "  Para arrancar después: npm run dev"
    ;;
  *)
    echo -e "${ROJO}Opción inválida.${NC}"
    exit 1
    ;;
esac
