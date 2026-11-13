import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Download, Pencil, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetTrabundaReportes, apiGetTrabundaReporteDetalle } from '../api/gateway';
import { exportReporteDetallePDF } from '../utils/exportUtils';
import { calcularPlazo } from '../utils/plazoCorreccion';

const TIPO_LABELS = {
  APOYO_HORAS: { label: 'Apoyo Horas', color: 'bg-blue-100 text-blue-700' },
  SANEAMIENTO: { label: 'Saneamiento', color: 'bg-emerald-100 text-emerald-700' },
};

const ESTADO_COLORS = {
  ABIERTO: 'bg-blue-100 text-blue-700',
  CERRADO: 'bg-slate-100 text-slate-600',
};

function hoy() {
  return new Date().toISOString().split('T')[0];
}

function VersionBadge({ version }) {
  const v = version ?? 1;
  if (v <= 1) return <span className="text-xs text-slate-400">v{v}</span>;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
      v{v} · corregido
    </span>
  );
}

export default function MisReportesPage() {
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(hoy());
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(null);

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const data = await apiGetTrabundaReportes({ fecha, page: 1, limit: 50 });
      setReportes(data?.reportes ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  async function descargarPDF(reporte) {
    setDescargando(reporte.id);
    try {
      const detalle = await apiGetTrabundaReporteDetalle(reporte.id);
      exportReporteDetallePDF(detalle.cabecera, detalle.contenido, detalle.tipo);
    } catch (err) {
      alert('Error: ' + (err?.message ?? 'No se pudo generar el PDF'));
    } finally {
      setDescargando(null);
    }
  }

  function accionPara(reporte) {
    if (reporte.estado === 'ABIERTO') {
      return { label: 'Editar', estilo: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' };
    }
    const { vencido } = calcularPlazo(reporte);
    if (vencido) {
      return { label: 'Solicitar a supervisor', estilo: 'bg-amber-50 text-amber-700 hover:bg-amber-100', solicitar: true };
    }
    return { label: 'Corregir', estilo: 'bg-blue-600 text-white hover:bg-blue-700' };
  }

  return (
    <Layout title="Mis reportes" subtitle="Solo ves los reportes que tú creaste">
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <button onClick={cargar} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw size={28} className="mx-auto mb-2 animate-spin opacity-40" />
              Cargando...
            </div>
          ) : reportes.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              Sin reportes para esta fecha.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">ID</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Turno</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Versión</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Plazo de corrección</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportes.map((r) => {
                  const accion = accionPara(r);
                  const { texto: plazoTexto } = calcularPlazo(r);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">#{r.id}</td>
                      <td className="px-4 py-3 text-slate-600">{r.turno}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TIPO_LABELS[r.tipo_reporte]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                          {TIPO_LABELS[r.tipo_reporte]?.label ?? r.tipo_reporte}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLORS[r.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3"><VersionBadge version={r.version} /></td>
                      <td className="px-4 py-3 text-slate-500">{plazoTexto}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            disabled={descargando === r.id}
                            onClick={() => descargarPDF(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all disabled:opacity-50"
                          >
                            {descargando === r.id ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                            PDF
                          </button>
                          <button
                            onClick={() => accion.solicitar
                              ? alert('TODO: falta el flujo de "solicitar a supervisor" — todavía no hay endpoint para esto.')
                              : navigate(`/trabunda/mis-reportes/${r.id}/corregir`)
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${accion.estilo}`}
                          >
                            {!accion.solicitar && <Pencil size={11} />}
                            {accion.label}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
