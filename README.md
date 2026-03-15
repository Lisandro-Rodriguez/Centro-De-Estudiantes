# Sistema de Gestión — Centro de Estudiantes

Sistema de escritorio offline para la gestión integral de un Centro de Estudiantes universitario.

## Stack

- **Electron** — app de escritorio multiplataforma
- **sql.js** — SQLite corriendo en memoria, persistido en disco localmente
- **HTML/CSS/JS vanilla** — sin frameworks

## Módulos

- **Turnos** — gestión de turnos con sesiones duales (hasta 2 usuarios simultáneos), estados automáticos y reemplazos
- **Préstamos** — préstamos de materiales con control de morosos, incumplimientos y bloqueos por cuatrimestre
- **Desayuno / Merienda** — registro con límite diario por alumno
- **Fotocopias** — cuota gratuita + excedente pago configurable
- **Inventario** — materiales para préstamo + mercadería con movimientos de stock
- **Gente** — alumnos y personal con carreras y roles
- **Agenda** — turnos programados con notificaciones desktop
- **Informes** — exportación a PDF y CSV/Excel
- **Configuración** — parámetros del sistema, carreras, PIN admin, backups

## Desarrollo

```bash
npm install
npm run dev
```

## Build (Windows)

```bash
npm run build:local   # genera instalador sin publicar
npm run build         # genera y publica en GitHub Releases
```

Requiere configurar `owner` y `repo` en `package.json` antes de publicar.

## Base de datos

La base de datos se guarda localmente en `%AppData%/centro-estudiantes/.appdata/store.bin`.  
Los backups automáticos diarios se almacenan en `.appdata/bk/` (últimos 7 días).  
El archivo queda protegido en solo lectura cuando la app está cerrada.
