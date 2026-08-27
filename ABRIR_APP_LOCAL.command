#!/bin/bash
# ==============================================================================
# 🩺 LANZADOR LOCAL DE 1-CLIC — APP TEST DE EXPLORACIÓN FÍSICA EN DOLOR
# ==============================================================================

cd "$(dirname "$0")"

PORT=8080

# Verificar si el puerto 8080 está ocupado, usar 8000 como alternativa si es necesario
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    PORT=8000
fi

echo "========================================================"
echo "🩺 INICIANDO APP DE DOLOR EN LOCAL (MODO OFFLINE / SERVIDOR LOCAL)"
echo "📍 Dirección: http://localhost:$PORT"
echo "========================================================"
echo "Abriendo tu navegador..."

# Iniciar servidor local ligero en segundo plano
python3 -m http.server $PORT &
SERVER_PID=$!

sleep 1

# Abrir en el navegador predeterminado
open "http://localhost:$PORT"

echo ""
echo "✅ App iniciada con éxito."
echo "💡 Para detener el servidor local cuando termines, simplemente cierra esta ventana del Terminal."
echo ""

# Esperar a que el proceso termine
wait $SERVER_PID
