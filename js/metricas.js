// =========================================================
// metricas.js — registro ANÓNIMO de lo que pasa en la vitrina
//
// registrar('letra_ocultada', { proyecto: 'cuentos-y-espias', segundo: 12 })
//
// Por ahora (Fase 3) solo lo escribe en la consola del navegador
// (nivel «debug», no es un error). En la Fase 6 este archivo se conecta
// a Supabase y guarda cada evento en la tabla «eventos».
// Pase lo que pase, NUNCA rompe la página: si algo falla, falla en silencio.
// =========================================================

export function registrar(tipo, datos = {}) {
  try {
    console.debug('[métrica]', tipo, datos);
  } catch {
    // en silencio
  }
}
