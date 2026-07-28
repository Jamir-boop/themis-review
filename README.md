# Themis Review

**https://jamir-boop.github.io/themis-review/**

Code review estático para bots de Automation Anywhere (A360), 100% en el navegador.

Sube uno o varios `.zip` exportados del Control Room y obtén:

- **Mapa de nodos** estilo Blender: cada taskbot es un nodo con sus métricas (líneas, comentarios, logs, variables); las llamadas Run Task se dibujan como conexiones y cada variable pasada entre taskbots como un cable individual coloreado por tipo.
- **Vista de editor** por taskbot: código línea por línea con hallazgos en el margen, tabla de variables y paquetes.
- **Reglas de revisión**: convención de nombres `<alcance><Tipo><NombreCamel>` del core_framework, Message Boxes que no se cierran solos (los que tienen timeout no se marcan) o que quedaron en código muerto, taskbots anidados a partir del nivel 3 (`utilidad_mensajeria` exenta), catch vacíos, rutas hardcodeadas, código deshabilitado, variables sin usar o sin descripción (las de entrada/salida pesan más que las locales), dependencias faltantes, cobertura de logs y comentarios.
- **Puntaje 0–100** por taskbot y por proyecto, y **reporte exportable a PDF** (botón Exportar → imprimir) con cada hallazgo y su corrección sugerida. UI en español e inglés.

Nada se sube a ningún servidor: los zip se procesan íntegramente en el front-end.

## Desarrollo

```bash
npm install
npm run dev    # servidor local
npm test       # tests del motor de análisis (requiere zips de ejemplo en .data/)
npm run build  # build estático (se despliega a GitHub Pages vía Actions)
```

Estructura: `src/core` es el motor de análisis (TypeScript puro, sin React); `src/ui` la interfaz (React + React Flow). Ver [plan.md](plan.md) para el diseño completo.
