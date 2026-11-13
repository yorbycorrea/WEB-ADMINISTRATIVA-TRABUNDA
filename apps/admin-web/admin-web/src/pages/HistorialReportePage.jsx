import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, RotateCcw, RefreshCw, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetHistorialReporte, apiGetTrabundaReporteDetalle, apiRestaurarLinea } from '../api/gateway';
import { exportReporteDetallePDF } from '../utils/exportUtils';

const ACCION_INFO = {
  AGREGAR: { label: '+ Agregado', color: 'text-emerald-600', avatar: 'bg-emerald-100 text-emerald-700' },
  EDITAR:  { label: '~ Editado',  color: 'text-amber-600',   avatar: 'bg-amber-100 text-amber-700' },
  QUITAR:  { label: '- Quitado',  color: 'text-red-500',     avatar: 'bg-red-100 text-red-700' },
  REABRIR: { label: '↺ Restaurado', color: 'text-violet-600', avatar: 'bg-violet-100 text-violet-700' },
};

const ORIGEN_BADGE = {
  WEB: 'bg-blue-100 text-blue-700',
  APP: 'bg-slate-100 text-slate-600',
  BD:  'bg-amber-100 text-amber-700',
};

function parseJson(val) {
  if (!val) return null;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

function trabajadorDe(evento) {
  const antes = parseJson(evento.antes);
  const despues = parseJson(evento.despues);
  return despues?.trabajador_nombre || antes?.trabajador_nombre || evento.linea_trabajador_nombre || '—';
}

const ETIQUETAS_DIFF = { area_nombre: 'Área', hora_inicio: 'H. Ini', hora_fin: 'H. Fin', horas: 'Horas' };

function diffDe(evento) {
  if (evento.accion !== 'EDITAR') return [];
  const antes = parseJson(evento.antes) ?? {};
  const despues = parseJson(evento.despues) ?? {};
  const partes = [];
  for (const campo of Object.keys(ETIQUETAS_DIFF)) {
    if (antes[campo] !== despues[campo]) {
      partes.push(`${ETIQUETAS_DIFF[campo]} ${antes[campo] ?? '—'} → ${despues[campo] ?? '—'}`);
    }
  }
  return partes;
}

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

export default function HistorialReportePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [datos, setDatos] = useState(null);
  const [cabecera, setCabecera] = useState(null);
  const [contenido, setContenido] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restaurando, setRestaurando] = useState(null);

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const [historial, detalle] = await Promise.all([
        apiGetHistorialReporte(id),
        apiGetTrabundaReporteDetalle(id),
      ]);
      setDatos(historial);
      setCabecera(detalle.cabecera);
      setContenido(detalle.contenido);
      setTipo(detalle.tipo);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const ev of datos?.eventos ?? []) {
      if (!mapa.has(ev.version_rep)) mapa.set(ev.version_rep, []);
      mapa.get(ev.version_rep).push(ev);
    }
    return [...mapa.entries()].sort((a, b) => b[0] - a[0]);
  }, [datos]);

  async function handleRestaurar(lineaId) {
    if (!window.confirm('¿Restaurar a este trabajador en el reporte?')) return;
    setRestaurando(lineaId);
    try {
      const res = await apiRestaurarLinea(lineaId);
      if (res?.ok === false || res?.error) {
        alert('Error: ' + (res.error ?? 'No se pudo restaurar'));
        return;
      }
      await cargar();
    } catch (err) {
      alert('Error de red: ' + err.message);
    } finally {
      setRestaurando(null);
    }
  }

  function descargarPDFActual() {
    exportReporteDetallePDF(cabecera, contenido, tipo);
  }

  if (loading) {
    return (
      <Layout title="Historial" subtitle="Cargando...">
        <div className="p-12 text-center text-slate-400">
          <RefreshCw size={28} className="mx-auto mb-2 animate-spin opacity-40" />
          Cargando historial del reporte #{id}...
        </div>
      </Layout>
    );
  }

  if (error || !datos) {
    return (
      <Layout title="Historial" subtitle="Error">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error ?? 'No se pudo cargar el historial'}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Historial" subtitle={`Reporte #${datos.reporte_id} · versión actual v${datos.version_actual}`}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="bg-white border border-slate-200 w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-lg font-bold text-slate-800">Historial · reporte #{datos.reporte_id}</h1>
          </div>
          <div className="flex gap-2">
            <button
              disabled title="Requiere reconstruir el snapshot histórico (pendiente, Fase 3)"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-400 rounded-xl cursor-not-allowed"
            >
              <Download size={13} /> PDF original (v1)
            </button>
            <button
              onClick={descargarPDFActual}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              <Download size={13} /> PDF actual (v{datos.version_actual})
            </button>
          </div>
        </div>

        {grupos.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            Este reporte todavía no tiene correcciones registradas.
          </div>
        )}

        {grupos.map(([versionRep, eventos]) => (
          <div key={versionRep} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-4">
              Versión {versionRep}
            </div>
            <div className="space-y-5">
              {eventos.map((ev) => {
                const info = ACCION_INFO[ev.accion] ?? ACCION_INFO.EDITAR;
                const diff = diffDe(ev);
                const puedeRestaurar = ev.accion === 'QUITAR' && ev.linea_deleted_at;
                return (
                  <div key={ev.id} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${info.avatar}`}>
                      {(ev.usuario_nombre ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${info.color}`}>{info.label}</span>
                        <span className="text-sm font-semibold text-slate-800">{trabajadorDe(ev)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ORIGEN_BADGE[ev.origen] ?? 'bg-slate-100 text-slate-600'}`}>
                          {ev.origen}
                        </span>
                        <span className="text-xs text-slate-400">{fmtFecha(ev.created_at)} · {ev.usuario_nombre ?? 'Sistema'}</span>
                      </div>
                      {diff.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">{diff.join(' · ')}</p>
                      )}
                      {(ev.motivo_tipo || ev.motivo_texto) && (
                        <p className="text-xs text-slate-400 mt-1">
                          Motivo: {ev.motivo_tipo ?? '—'}{ev.motivo_texto ? ` — ${ev.motivo_texto}` : ''}
                        </p>
                      )}
                      {puedeRestaurar && (
                        <button
                          disabled={restaurando === ev.linea_id}
                          onClick={() => handleRestaurar(ev.linea_id)}
                          className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          {restaurando === ev.linea_id
                            ? <RefreshCw size={12} className="animate-spin" />
                            : <RotateCcw size={12} />
                          }
                          Restaurar línea
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
