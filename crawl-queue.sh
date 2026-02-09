#!/usr/bin/env bash
set -e

REGION="prov-panama-ciudad-de-panama-las-cumbres"
CMD="npx tsx src/index.ts crawl"

echo "============================================"
echo "Phase 1: Las Cumbres crawls"
echo "============================================"

echo ""
echo "[1/5] Las Cumbres - Casas (Venta)"
$CMD -c sale -s casas -r "$REGION" --full

echo ""
echo "[2/5] Las Cumbres - Lotes y Terrenos (Venta)"
$CMD -c sale -s lotes-y-terrenos -r "$REGION" --full

echo ""
echo "[3/5] Las Cumbres - Casas (Alquiler)"
$CMD -c rental -s casas -r "$REGION" --full

echo ""
echo "[4/5] Las Cumbres - Lotes y Terrenos (Alquiler)"
$CMD -c rental -s lotes-y-terrenos -r "$REGION" --full

echo ""
echo "============================================"
echo "Phase 2: Full crawl (all categories/regions)"
echo "============================================"

echo ""
echo "[5/5] Full crawl - everything"
$CMD --full

echo ""
echo "============================================"
echo "All crawls completed!"
echo "============================================"
