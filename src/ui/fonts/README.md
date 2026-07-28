# Fuentes

Subconjuntos `latin` y `latin-ext` descargados de Google Fonts, todas bajo **SIL Open Font License 1.1**:

- **Cormorant** (variable 300–700) — rol *display*, sustituye a `Sigurd Variable`.
- **Archivo Narrow** (variable 400–700) — rol *UI*, sustituye a `Rules Variable`.
- **Courier Prime** (400/700) — rol *mono*, es la fuente que pide la especificación.

`Sigurd Variable` y `Rules Variable` son comerciales (Blaze Type) y no se incluyen. Los stacks en
`src/ui/styles.css` las declaran primero: si algún día se compran las licencias, basta con dejar los
`.woff2` en esta carpeta y añadir sus `@font-face` para que la app las use sin tocar nada más.

Los archivos viven en `src/` (no en `public/`) para que Vite les aplique hash y la base correcta al
desplegar en GitHub Pages.
