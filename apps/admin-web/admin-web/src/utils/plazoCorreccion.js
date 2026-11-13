// Regla de negocio: 48h después del cierre para corregir sin ser supervisor.
// TODO: hoy está hardcodeado — cuando el backend lo haga configurable
// (tabla de configuración, Fase 1), hay que traerlo desde ahí en vez de
// calcularlo en el navegador.
const PLAZO_CORRECCION_HORAS = 48;

export function calcularPlazo(reporte) {
  if (reporte.estado === 'ABIERTO') {
    return { texto: 'Edición libre (abierto, igual queda auditado)', vencido: false };
  }
  if (!reporte.cerrado_en) {
    return { texto: '—', vencido: false };
  }
  const cierre = new Date(reporte.cerrado_en);
  const limite = new Date(cierre.getTime() + PLAZO_CORRECCION_HORAS * 60 * 60 * 1000);
  const vencido = new Date() > limite;
  const fecha = limite.toLocaleDateString('es-PE');
  const hora  = limite.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return {
    texto: vencido ? 'Vencido — solo un supervisor puede corregir' : `Puedes corregir hasta el ${fecha} a las ${hora}`,
    vencido,
  };
}
