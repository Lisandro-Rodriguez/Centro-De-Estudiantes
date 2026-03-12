# Centro de Estudiantes — Sistema de Gestión

Sistema de escritorio para centros de estudiantes.
Electron + **sql.js** (SQLite puro JS, sin compilación) — funciona 100% offline.

---

## Requisitos

- **Node.js 18 o superior**: https://nodejs.org  
  ⚠️ Instalar la versión **LTS** (no la "Current")
- No se necesita Python, Visual C++, ni nada extra

---

## Instalación

```bash
# Estás en la carpeta Centro-De-Estudiantes (donde está package.json)
# NO hacer cd centro-estudiantes — ya estás en el lugar correcto

npm install
npm start
```

Si todo va bien, la app abre directamente.

---

## Si Node.js es muy nuevo (v22+) y hay problemas

```bash
# Opción A: usar la versión LTS de Node.js (recomendado)
# Descargar de https://nodejs.org la versión 20 LTS

# Opción B: forzar compatibilidad
npm install --legacy-peer-deps
npm start
```

---

## Generar instalador .exe

```bash
npm run build:local
# El instalador queda en la carpeta: dist/
```

---

## Configurar actualizaciones automáticas vía GitHub

1. Crear repo en GitHub
2. Editar `package.json` → `build.publish` → poner tu usuario y nombre de repo
3. Crear token en GitHub: Settings → Developer settings → Personal access tokens (permisos: `repo`)
4. En PowerShell antes de buildear:
   ```powershell
   $env:GH_TOKEN="tu_token_aqui"
   npm run build
   ```
5. Cada nueva versión: actualizar `"version"` en `package.json`, luego `npm run build`

El programa **chequea actualizaciones al iniciar** y cada 2 horas.
Cuando detecta una nueva versión, muestra un banner y el usuario instala con un clic.

---

## Dónde se guarda la base de datos

```
Windows: C:\Users\TU_USUARIO\AppData\Roaming\centro-estudiantes\centro.db
```

Para **backup**: copiar ese archivo `.db`.  
Para **migrar a otra PC**: copiar el `.db` a la misma ruta.

---

## Módulos

| Módulo | Función |
|--------|---------|
| Dashboard | Resumen del día — stats, agenda, préstamos activos |
| Turno actual | Iniciar/cerrar turno, registrar personal, calcular horas |
| Agenda | Vista semanal de turnos programados |
| Préstamos | Prestar y devolver materiales con control de stock |
| Pan / Merienda | 1 pan por alumno, detecta duplicados automáticamente |
| Hojas | 3 gratis + hasta 7 pagas, precio y desglose en tiempo real |
| Alumnos | ABM con búsqueda por nombre y DNI |
| Personal | Becarios y directivos + control de horas de beca |
| Materiales | Inventario de materiales prestables |
| Configuración | Nombre del centro, límites de hojas, precio por hoja |
