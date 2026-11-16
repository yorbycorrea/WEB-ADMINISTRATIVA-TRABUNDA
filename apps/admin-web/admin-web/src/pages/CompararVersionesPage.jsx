import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, RefreshCw, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetHistorialReporte, apiGetVersionReporte } from '../api/gateway';

const ESTADO_INFO = {
  NUEVO:   { label: 'nuevo en B',   bg: 'bg-emerald-50', texto: 'text-emerald-900', tachado: 'text-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  QUITADO: { label: 'quitado en B', bg: 'bg-red-50',     texto: 'text-red-900',     tachado: 'text-red-400',     badge: 'bg-red-100 text-red-700' },
  EDITADO: { label: 'editado',      bg: 'bg-amber-50',   texto: 'text-amber-900',   tachado: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700' },
  IGUAL:   { label: 'sin cambios',  bg: '',              texto: 'text-slate-800',   tachado: 'text-slate-400',   badge: 'bg-slate-100 text-slate-500' },
};

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function construirDiff(itemsA, itemsB) {
  const mapaA = new Map(itemsA.map((l) => [l.trabajador_codigo, l]));
  const mapaB = new Map(itemsB.map((l) => [l.trabajador_codigo, l]));
  const codigos = new Set([...mapaA.keys(), ...mapaB.keys()]);
  const filas = [];
  for (const codigo of codigos) {
    const a = mapaA.get(codigo);
    const b = mapaB.get(codigo);
    if (a && !b) {
      filas.push({ codigo, estado: 'QUITADO', a, b: null, ref: a });
    } else if (!a && b) {
      filas.push({ codigo, estado: 'NUEVO', a: null, b, ref: b });
    } else {
      const cambio = a.area_nombre !== b.area_nombre || a.hora_inicio !== b.hora_inicio || a.hora_fin !== b.hora_fin;
      filas.push({ codigo, estado: cambio ? 'EDITADO' : 'IGUAL', a, b, ref: b });
    }
  }
  filas.sort((x, y) => (x.ref.trabajador_nombre || '').localeCompare(y.ref.trabajador_nombre || ''));
  return filas;
}

function totalHoras(items) {
  return items.reduce((acc, l) => acc + (Number(l.horas) || 0), 0);
}

export default function CompararVersionesPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [versionActual, setVersionActual] = useState(null);
  const [versiones, setVersiones] = useState([]); // [{ version, label }]
  const [versionA, setVersionA] = useState(null);
  const [versionB, setVersionB] = useState(null);
  const [itemsA, setItemsA] = useState([]);
  const [itemsB, setItemsB] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    async function cargarVersiones() {
      setLoading(true); setError(null);
      try {
        const historial = await apiGetHistorialReporte(id);
        if (!activo) return;
        const actual = historial?.version_actual ?? 1;
        setVersionActual(actual);

        const porVersion = new Map();
        for (const ev of historial?.eventos ?? []) {
          if (!porVersion.has(ev.version_rep)) porVersion.set(ev.version_rep, ev);
        }

        const lista = [];
        for (let v = 1; v <= actual; v++) {
          if (v === 1) {
            lista.push({ version: 1, label: 'v1 · Original' });
          } else {
            const ev = porVersion.get(v);
            lista.push({
              version: v,
              label: ev
                ? `v${v} · ${ev.usuario_nombre ?? 'Sistema'} (${fmtFecha(ev.created_at)})`
                : `v${v}`,
            });
          }
        }
        setVersiones(lista);
        setVersionA(1);
        setVersionB(actual);
      } catch (e) {
        if (activo) setError(e.message);
      } finally {
        if (activo) setLoading(false);
      }
    }
    cargarVersiones();
    return () => { activo = false; };
  }, [id]);

  useEffect(() => {
    if (versionA == null || versionB == null) return;
    let activo = true;
    async function cargarDatos() {
      setCargandoDatos(true);
      try {
        const [dataA, dataB] = await Promise.all([
          apiGetVersionReporte(id, versionA),
          apiGetVersionReporte(id, versionB),
        ]);
        if (!activo) return;
        setItemsA(dataA?.contenido?.items ?? []);
        setItemsB(dataB?.contenido?.items ?? []);
      } catch (e) {
        if (activo) setError(e.message);
      } finally {
        if (activo) setCargandoDatos(false);
      }
    }
    cargarDatos();
    return () => { activo = false; };
  }, [id, versionA, versionB]);

  const filas = useMemo(() => construirDiff(itemsA, itemsB), [itemsA, itemsB]);
  const cambios = useMemo(() => filas.filter((f) => f.estado !== 'IGUAL'), [filas]);

  function handleSwap() {
    setVersionA(versionB);
    setVersionB(versionA);
  }

  if (loading) {
    return (
      <Layout title="Comparar versiones" subtitle="Cargando...">
        <div className="p-12 text-center text-slate-400">
          <RefreshCw size={28} className="mx-auto mb-2 animate-spin opacity-40" />
          Cargando versiones del reporte #{id}...
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Comparar versiones" subtitle="Error">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Comparar versiones" subtitle={`Reporte #${id}`}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="bg-white border border-slate-200 w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-50">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold text-slate-800">Comparar versiones · reporte #{id}</h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Versión A</label>
            <select
              value={versionA ?? ''}
              onChange={(e) => setVersionA(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              {versiones.map((v) => <option key={v.version} value={v.version}>{v.label}</option>)}
            </select>
          </div>
          <button
            onClick={handleSwap}
            title="Intercambiar"
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
          >
            <ArrowLeftRight size={14} />
          </button>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Versión B</label>
            <select
              value={versionB ?? ''}
              onChange={(e) => setVersionB(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              {versiones.map((v) => <option key={v.version} value={v.version}>{v.label}{v.version === versionActual ? ' — actual' : ''}</option>)}
            </select>
          </div>
          <div className="ml-auto text-xs text-slate-500">
            {cargandoDatos ? 'Calculando diferencias...' : (
              <span><span className="font-semibold text-amber-700">{cambios.length}</span> cambio{cambios.length !== 1 ? 's' : ''} entre estas dos versiones</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Código</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Trabajador</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Área</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">H.Ini</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">H.Fin</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Tot.Hrs</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f) => {
                const info = ESTADO_INFO[f.estado];
                const quitado = f.estado === 'QUITADO';
                const mostrar = quitado ? f.a : f.b;
                return (
                  <tr key={f.codigo} className={info.bg}>
                    <td className={`px-4 py-2.5 ${quitado ? `line-through ${info.tachado}` : info.texto}`}>{f.codigo}</td>
                    <td className={`px-4 py-2.5 font-medium ${quitado ? `line-through ${info.tachado}` : info.texto}`}>{mostrar?.trabajador_nombre}</td>
                    <td className={`px-4 py-2.5 ${quitado ? `line-through ${info.tachado}` : info.texto}`}>{mostrar?.area_nombre ?? '—'}</td>
                    {f.estado === 'EDITADO' ? (
                      <>
                        <td className={`px-4 py-2.5 ${info.texto}`}>{f.b.hora_inicio}</td>
                        <td className="px-4 py-2.5">
                          {f.a.hora_fin !== f.b.hora_fin ? (
                            <><span className={`line-through ${info.tachado}`}>{f.a.hora_fin}</span> → <span className={`font-medium ${info.texto}`}>{f.b.hora_fin}</span></>
                          ) : <span className={info.texto}>{f.b.hora_fin}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {f.a.horas !== f.b.horas ? (
                            <><span className={`line-through ${info.tachado}`}>{f.a.horas}</span> → <span className={`font-medium ${info.texto}`}>{f.b.horas}</span></>
                          ) : <span className={info.texto}>{f.b.horas}</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`px-4 py-2.5 ${quitado ? `line-through ${info.tachado}` : info.texto}`}>{mostrar?.hora_inicio}</td>
                        <td className={`px-4 py-2.5 ${quitado ? `line-through ${info.tachado}` : info.texto}`}>{mostrar?.hora_fin}</td>
                        <td className={`px-4 py-2.5 ${quitado ? `line-through ${info.tachado}` : info.texto}`}>{mostrar?.horas}</td>
                      </>
                    )}
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${info.badge}`}>{info.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 flex gap-6 text-sm text-slate-500">
            <span>Total horas A: <b className="text-slate-700">{totalHoras(itemsA).toFixed(1)} h</b></span>
            <span>Total horas B: <b className="text-slate-700">{totalHoras(itemsB).toFixed(1)} h</b></span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
