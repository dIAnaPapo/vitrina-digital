// =========================================================
// config.js — datos de configuración del sitio (los lee todo el sitio)
//
// URL_PUBLICA: la dirección de GitHub Pages. De aquí sale el QR de la placa,
// así el QR apunta al sitio publicado aunque abras la placa en tu compu.
// Si algún día cambia la dirección (otro usuario, dominio propio), se cambia SOLO aquí.
// Debe terminar en «/».
// =========================================================

export const URL_PUBLICA = 'https://dianapapo.github.io/vitrina-digital/';

/** Dirección que abre la placa. origen: 'qr' (el código impreso) o 'nfc' (el chip, más adelante). */
export function urlDeLaPlaca(origen) {
  return `${URL_PUBLICA}index.html?src=${origen}`;
}
