#!/usr/bin/env bash
set -e

AZUL='\033[0;34m'
VERDE='\033[0;32m'
ROJO='\033[0;31m'
NC='\033[0m'

echo -e "${AZUL}"
echo "╔════════════════════════════════════════╗"
echo "║  Form 606 DGII — Instalador Remoto    ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${ROJO}✗ Node.js no encontrado.${NC}"
  echo "  Instálalo desde https://nodejs.org (versión 18+)"
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo -e "${ROJO}✗ Git no encontrado.${NC}"
  echo "  Instálalo desde https://git-scm.com"
  exit 1
fi

DESTINO="form606-dgii"
echo -e "${AZUL}▶ Descargando proyecto...${NC}"
git clone --depth 1 https://github.com/salvadorcoronado2309kg-coder/Hello.git "$DESTINO"
cd "$DESTINO"
echo -e "${VERDE}✓ Descargado en carpeta: ${DESTINO}${NC}"

bash setup.sh
