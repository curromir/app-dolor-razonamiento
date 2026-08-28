#!/bin/bash
# ==============================================================================
# 📦 GENERADOR DE BACKUP AUTOMÁTICO DE 1-CLIC — APP DOLOR
# ==============================================================================

cd "$(dirname "$0")"

echo "========================================================"
echo "📦 GENERANDO BACKUP LOCAL DE LA VERSIÓN..."
echo "========================================================"

python3 -c "
import os, zipfile, datetime, shutil, stat

base_dir = os.getcwd()
backups_dir = os.path.join(base_dir, 'backups')
os.makedirs(backups_dir, exist_ok=True)

now = datetime.datetime.now()
now_str = now.strftime('%Y%m%d_%H%M%S')
version_tag = 'v4.1'

# 1. Crear Carpeta Ejecutable
runnable_folder_name = f'VERSION_{version_tag}_{now_str}'
runnable_folder_path = os.path.join(backups_dir, runnable_folder_name)
os.makedirs(runnable_folder_path, exist_ok=True)

exclude_dirs = {'.git', 'backups', '__pycache__', '.gemini', 'node_modules', '.agents'}
exclude_exts = {'.pyc', '.DS_Store'}

# Copiar archivos a la carpeta ejecutable
for item in os.listdir(base_dir):
    if item in exclude_dirs or item.endswith('.pyc') or item == '.DS_Store':
        continue
    src = os.path.join(base_dir, item)
    dst = os.path.join(runnable_folder_path, item)
    if os.path.isdir(src):
        if os.path.exists(dst): shutil.rmtree(dst)
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)

# Asegurar que ABRIR_APP_LOCAL.command tenga permisos de ejecucion
launcher_path = os.path.join(runnable_folder_path, 'ABRIR_APP_LOCAL.command')
if os.path.exists(launcher_path):
    os.chmod(launcher_path, os.stat(launcher_path).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

# 2. Crear Archivo ZIP comprimido
zip_filename = f'APP_DOLOR_BACKUP_{version_tag}_{now_str}.zip'
zip_path = os.path.join(backups_dir, zip_filename)

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(runnable_folder_path):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, runnable_folder_path)
            zf.write(full_path, rel_path)

file_size_kb = os.path.getsize(zip_path) / 1024
print(f'✅ Backup creado exitosamente:')
print(f'📂 Carpeta Ejecutable: backups/{runnable_folder_name}/')
print(f'   👉 Contiene ABRIR_APP_LOCAL.command listo para abrir con doble clic.')
print(f'📦 Archivo Comprimido: backups/{zip_filename} ({file_size_kb:.1f} KB)')
"

echo "========================================================"
echo "🎉 Tu copia de seguridad está lista y es 100% ejecutable en local."
echo "========================================================"
