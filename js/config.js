// =========================================================
// config.js — datos de configuración del sitio (los lee todo el sitio)
//
// URL_PUBLICA: la dirección de GitHub Pages. De aquí sale el QR de la placa,
// así el QR apunta al sitio publicado aunque abras la placa en tu compu.
// Desde la Ronda 4 el sitio vive en la organización vitrina-digital-ecotec, en la RAÍZ del dominio.
// Si algún día cambia la dirección (otra organización, dominio propio), se cambia SOLO aquí.
// Debe terminar en «/».
// =========================================================

export const URL_PUBLICA = 'https://vitrina-digital-ecotec.github.io/';

/** Dirección que abre la placa. origen: 'qr' (el código impreso) o 'nfc' (el chip, más adelante). */
export function urlDeLaPlaca(origen) {
  return `${URL_PUBLICA}index.html?src=${origen}`;
}
