/** Espacio duro (non-breaking space). Se construye por código para no escribirlo literal. */
const NBSP = String.fromCharCode(160);

/**
 * Reemplaza los espacios duros por espacios normales en el HTML de una noticia.
 *
 * El editor del panel (Quill 2.0.3, a través de getSemanticHTML) guarda todos los
 * espacios como `&nbsp;`. Un párrafo sin espacios normales no se puede cortar en
 * líneas y desborda su contenedor al mostrarse. Se normaliza en el servidor para
 * cubrir a cualquier cliente, no solo al panel.
 *
 * @param html - Contenido HTML de la noticia
 * @returns El mismo HTML con espacios normales
 */
export function normalizeSpaces(html: string): string {
  return html
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, ' ')
    .split(NBSP)
    .join(' ');
}
