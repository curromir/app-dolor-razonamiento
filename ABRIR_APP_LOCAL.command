#!/bin/bash
# ==============================================================================
# 🩺 LANZADOR LOCAL DE 1-CLIC — APP TEST DE EXPLORACIÓN FÍSICA EN DOLOR
# ==============================================================================

cd "$(dirname "$0")"

# Encontrar un puerto libre dinámicamente para evitar conflictos con otras versiones abiertas
PORT=8080
for p in 8080 8081 8082 8083 8084 8085 8000 8001 8002 3000 5000; do
    if ! lsof -Pi :$p -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        PORT=$p
        break
    fi
done

echo "========================================================"
echo "🩺 INICIANDO APP DE DOLOR (VERSIÓN LOCAL)"
echo "📍 Dirección: http://localhost:$PORT"
echo "📂 Carpeta: $(basename "$(pwd)")"
echo "========================================================"
echo "Abriendo tu navegador en http://localhost:$PORT..."

python3 -m http.server $PORT &
SERVER_PID=$!

sleep 1

open "http://localhost:$PORT"

echo ""
echo "✅ App iniciada con éxito en el puerto $PORT."
echo "💡 Para detener el servidor cuando termines, simplemente cierra esta ventana."
echo ""

wait $SERVER_PID
