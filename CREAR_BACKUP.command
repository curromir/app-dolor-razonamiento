#!/bin/bash
# ==============================================================================
# 📦 GENERADOR DE BACKUP AUTOMÁTICO DE 1-CLIC — APP DOLOR
# ==============================================================================

cd "$(dirname "$0")"

echo "========================================================"
echo "📦 GENERANDO BACKUP LOCAL DE LA VERSIÓN..."
echo "========================================================"

python3 -c "
import os, zipfile, datetime

base_dir = os.getcwd()
backups_dir = os.path.join(base_dir, 'backups')
os.makedirs(backups_dir, exist_ok=True)

now_str = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
zip_filename = f'APP_DOLOR_BACKUP_v4.0_{now_str}.zip'
zip_path = os.path.join(backups_dir, zip_filename)

exclude_dirs = {'.git', 'backups', '__pycache__', '.gemini', 'node_modules', '.agents'}
exclude_exts = {'.pyc', '.DS_Store'}

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in exclude_exts or file == '.DS_Store':
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, base_dir)
            zf.write(full_path, rel_path)

file_size_kb = os.path.getsize(zip_path) / 1024
print(f'✅ Backup creado exitosamente:')
print(f'📁 Archivo: backups/{zip_filename}')
print(f'📊 Tamaño: {file_size_kb:.1f} KB')
"

echo "========================================================"
echo "🎉 Tu copia de seguridad está lista en la carpeta 'backups'."
echo "========================================================"
