import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, Plus, Trash2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { apiGetTrabundaReporteDetalle, apiGetTrabundaDashboard } from '../api/gateway';

// TODO: reemplazar por una búsqueda real de trabajadores

const MOCK_TRABAJADORES_DISPONIBLES = [
  { codigo: '35700', nombre: 'CONTRERAS FERNANDEZ ERICSON', documento: '71234567' },
  { codigo: '40112', nombre: 'QUIROZ SALDAÑA MELANY',        documento: '72345678' },
  { codigo: '41987', nombre: 'VASQUEZ TORRES BRAYAN',        documento: '73456789' },
];

const MOTIVOS_EDITADO  = ['Error de digitación', 'Olvidé marcar la hora de salida', 'Error en hora de marcación', 'Otro'];
const MOTIVOS_AGREGADO = ['Olvidé registrar al trabajador', 'Trabajador llegó tarde', 'Otro'];
const MOTIVOS_QUITAR   = ['Duplicado en el reporte', 'Trabajador no asistió', 'Otro'];

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Replica en el navegador el cálculo de src/utils/horas.js (calcHorasConAlmuerzo)
// solo para mostrar el total al instante. El backend sigue siendo quien manda
// cuando exista el endpoint de guardado.
function calcularHorasLocal(inicio, fin) {
  const ini = timeToMinutes(inicio);
  let finM = timeToMinutes(fin);
  if (ini === null || finM === null) return null;
  if (finM < ini) finM += 24 * 60;
  const dur = finM - ini - 30;
  if (dur < 0) return 0;
  return Math.round((dur / 60) * 2) / 2;
}

function estadoFilaDe(row) {
  if (row.quitar) return 'QUITAR';
  if (!row.original) return 'NUEVO';
  const cambio =
    row.area_nombre !== row.original.area_nombre ||
    row.hora_inicio  !== row.original.hora_inicio  ||
    row.hora_fin     !== row.original.hora_fin;
  return cambio ? 'EDITADO' : 'NORMAL';
}

function diffFila(row) {
  if (!row.original) return [];
  const partes = [];
  if (row.hora_fin !== row.original.hora_fin) {
    partes.push(`H. Fin ${row.original.hora_fin ?? '—'} → ${row.hora_fin ?? '—'}`);
  }
  if (row.area_nombre !== row.original.area_nombre) {
    partes.push(`Área ${row.original.area_nombre ?? '—'} → ${row.area_nombre ?? '—'}`);
  }
  if (row.horas !== row.original.horas) {
    partes.push(`Horas ${row.original.horas ?? '—'} → ${row.horas ?? '—'}`);
  }
  return partes;
}

function calcularPlazo(cabecera) {
  if (cabecera.estado === 'ABIERTO') return 'Edición libre (abierto, igual queda auditado)';
  if (!cabecera.cerrado_en) return '—';
  const cierre = new Date(cabecera.cerrado_en);
  // TODO: 48h hardcodeado — en la Fase 1 esto sale de una tabla de configuración.
  const limite = new Date(cierre.getTime() + 48 * 60 * 60 * 1000);
  const vencido = new Date() > limite;
  const fecha = limite.toLocaleDateString('es-PE');
  const hora  = limite.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return vencido ? 'Vencido — solo un supervisor puede corregir' : `Puedes corregir hasta el ${fecha} a las ${hora}`;
}

export default function CorregirReportePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cabecera, setCabecera] = useState(null);
  const [rows,     setRows]     = useState([]);
  const [areas,    setAreas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const [busqueda,     setBusqueda]     = useState('');
  const [motivos,      setMotivos]      = useState({});
  const [comentario,   setComentario]   = useState('');
  const [modalAgregar, setModalAgregar] = useState(false);
  const [busquedaModal, setBusquedaModal] = useState('');
  const [guardando,    setGuardando]    = useState(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setLoading(true); setError(null);
      try {
        const [detalle, dashboard] = await Promise.all([
          apiGetTrabundaReporteDetalle(id),
          apiGetTrabundaDashboard(),
        ]);
        if (!activo) return;
        setCabecera(detalle.cabecera);
        const items = detalle?.contenido?.items ?? [];
        setRows(items.map((it) => ({
          id: it.id,
          codigo: it.trabajador_codigo,
          nombre: it.trabajador_nombre,
          documento: it.trabajador_documento,
          area_id: it.area_id,
          area_nombre: it.area_nombre,
          hora_inicio: it.hora_inicio,
          hora_fin: it.hora_fin,
          horas: it.horas,
          quitar: false,
          original: {
            area_nombre: it.area_nombre,
            hora_inicio: it.hora_inicio,
            hora_fin: it.hora_fin,
            horas: it.horas,
          },
        })));
        const listaAreas = dashboard?.areas?.areas ?? dashboard?.areas?.data ?? [];
        setAreas(listaAreas.map((a) => a.nombre).filter(Boolean));
      } catch (e) {
        if (activo) setError(e.message);
      } finally {
        if (activo) setLoading(false);
      }
    }
    cargar();
    return () => { activo = false; };
  }, [id]);

  function actualizarFila(rowId, campo, valor) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const siguiente = { ...r, [campo]: valor };
      if (campo === 'hora_inicio' || campo === 'hora_fin') {
        siguiente.horas = calcularHorasLocal(siguiente.hora_inicio, siguiente.hora_fin) ?? r.horas;
      }
      return siguiente;
    }));
  }

  function alternarQuitar(rowId) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, quitar: !r.quitar } : r)));
  }

  function agregarTrabajador(candidato) {
    setRows((prev) => [...prev, {
      id: `nuevo-${candidato.codigo}`,
      codigo: candidato.codigo,
      nombre: candidato.nombre,
      documento: candidato.documento,
      area_id: null,
      area_nombre: areas[0] ?? '',
      hora_inicio: '',
      hora_fin: '',
      horas: null,
      quitar: false,
      original: null,
    }]);
    setModalAgregar(false);
    setBusquedaModal('');
  }

  const filas = useMemo(() => rows.map((r) => ({ ...r, estado: estadoFilaDe(r) })), [rows]);

  const filasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((r) =>
      r.codigo?.toLowerCase().includes(q) ||
      r.nombre?.toLowerCase().includes(q) ||
      r.documento?.toLowerCase().includes(q)
    );
  }, [filas, busqueda]);

  const cambiosPendientes = useMemo(() => filas.filter((r) => r.estado !== 'NORMAL'), [filas]);
  const codigosYaEnReporte = useMemo(() => new Set(rows.map((r) => r.codigo)), [rows]);

  const totalHorasAntes = rows.reduce((acc, r) => acc + (Number(r.original?.horas ?? r.horas) || 0), 0);
  const totalHorasDespues = filas
    .filter((r) => r.estado !== 'QUITAR')
    .reduce((acc, r) => acc + (Number(r.horas) || 0), 0);

  const todosConMotivo = cambiosPendientes.length > 0 && cambiosPendientes.every((r) => Boolean(motivos[r.id]));

  async function handleGuardar() {
    setGuardando(true);
    try {
      // TODO: falta el endpoint PATCH /reportes/:id/correccion en Trabunda_Backend
      // (Fase 2: duplicados, recálculo de horas, version, auditoría, notificación).
      alert('TODO: el backend todavía no tiene el endpoint de guardado.');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <Layout title="Mis reportes" subtitle="Cargando reporte...">
        <div className="p-12 text-center text-slate-400">
          <RefreshCw size={28} className="mx-auto mb-2 animate-spin opacity-40" />
          Cargando reporte #{id}...
        </div>
      </Layout>
    );
  }

  if (error || !cabecera) {
    return (
      <Layout title="Mis reportes" subtitle="Error">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-600">
          {error ?? 'No se pudo cargar el reporte'}
        </div>
      </Layout>
    );
  }

  const versionActual = cabecera.version ?? 1; // TODO: viene del backend tras la migración de la Fase 1
  const esCorregido = versionActual > 1;

  return (
    <Layout title="Corregir reporte" subtitle={`Reporte #${cabecera.id}`}>
      <div className="space-y-5">

        <Link to="/trabunda/mis-reportes" className="text-xs text-slate-400 hover:text-blue-600">
          Mis reportes / #{cabecera.id}
        </Link>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-slate-800">Corregir reporte #{cabecera.id}</h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            {cabecera.tipo_reporte === 'SANEAMIENTO' ? 'Saneamiento' : 'Apoyo Horas'}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${esCorregido ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
            {cabecera.estado} · v{versionActual}
          </span>
        </div>

        <p className="text-sm text-slate-400">
          Turno {cabecera.turno} · {cabecera.fecha} · {calcularPlazo(cabecera)}
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 text-sm text-emerald-700">
          <ShieldCheck size={16} className="flex-shrink-0" />
          Cada cambio queda registrado con tu usuario, la fecha y el motivo. Los cambios no se aplican hasta que pulses <b>Guardar cambios</b>.
        </div>

        <div className="flex gap-4">

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por código, DNI o nombre..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {filas.filter((r) => r.estado !== 'QUITAR').length} activos
                {filas.some((r) => r.estado === 'QUITAR') &&
                  ` · ${filas.filter((r) => r.estado === 'QUITAR').length} por quitar`}
              </span>
              <button
                onClick={() => setModalAgregar(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all whitespace-nowrap"
              >
                <Plus size={14} /> Agregar trabajador
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">N°</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Código</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Apellidos y nombres</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Área de apoyo</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">H. Ini</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">H. Fin</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase">Tot. Hrs</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filasVisibles.map((r, i) => (
                    <tr key={r.id} className={
                      r.estado === 'QUITAR'  ? 'bg-red-50'     :
                      r.estado === 'EDITADO' ? 'bg-amber-50'   :
                      r.estado === 'NUEVO'   ? 'bg-emerald-50' : ''
                    }>
                      <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.codigo}</td>
                      <td className="px-4 py-2.5">
                        <span className={r.estado === 'QUITAR' ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                          {r.nombre}
                        </span>
                        {r.estado !== 'NORMAL' && (
                          <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.estado === 'QUITAR'  ? 'bg-red-100 text-red-600'     :
                            r.estado === 'EDITADO' ? 'bg-amber-100 text-amber-700' :
                                                      'bg-emerald-100 text-emerald-700'
                          }`}>
                            {r.estado === 'QUITAR' ? 'SE QUITARÁ' : r.estado}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          disabled={r.estado === 'QUITAR'}
                          value={r.area_nombre ?? ''}
                          onChange={(e) => actualizarFila(r.id, 'area_nombre', e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="time"
                          disabled={r.estado === 'QUITAR'}
                          value={r.hora_inicio ?? ''}
                          onChange={(e) => actualizarFila(r.id, 'hora_inicio', e.target.value)}
                          className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="time"
                          disabled={r.estado === 'QUITAR'}
                          value={r.hora_fin ?? ''}
                          onChange={(e) => actualizarFila(r.id, 'hora_fin', e.target.value)}
                          className={`w-24 text-xs border rounded-lg px-2 py-1.5 disabled:bg-slate-100 ${
                            r.estado === 'EDITADO' ? 'border-amber-400' : 'border-slate-200'
                          }`}
                        />
                        {r.estado === 'EDITADO' && r.original?.hora_fin !== r.hora_fin && (
                          <div className="text-[10px] text-amber-600 mt-0.5">antes: {r.original.hora_fin ?? '—'}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{r.horas ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.estado === 'QUITAR' ? (
                          <button
                            onClick={() => alternarQuitar(r.id)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                          >
                            Deshacer
                          </button>
                        ) : (
                          <button
                            onClick={() => alternarQuitar(r.id)}
                            title="Quitar del reporte"
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-slate-100 flex gap-6 text-sm text-slate-500">
                <span>Total horas antes: <b className="text-slate-700">{totalHorasAntes.toFixed(1)} h</b></span>
                <span>Total horas después: <b className="text-slate-700">{totalHorasDespues.toFixed(1)} h</b></span>
              </div>
            </div>
          </div>

          <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-800">Cambios pendientes</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {cambiosPendientes.length}
              </span>
            </div>

            {cambiosPendientes.length === 0 && (
              <p className="text-xs text-slate-400">Todavía no hay cambios. Edita una fila, agrega o quita un trabajador.</p>
            )}

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {cambiosPendientes.map((r) => {
                const tipo = r.estado === 'NUEVO' ? 'AGREGADO' : r.estado === 'QUITAR' ? 'QUITADO' : 'EDITADO';
                const opciones = tipo === 'AGREGADO' ? MOTIVOS_AGREGADO : tipo === 'QUITADO' ? MOTIVOS_QUITAR : MOTIVOS_EDITADO;
                const sinMotivo = !motivos[r.id];
                return (
                  <div key={r.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                    <div className={`text-[10px] font-bold mb-1 ${
                      tipo === 'AGREGADO' ? 'text-emerald-600' : tipo === 'QUITADO' ? 'text-red-500' : 'text-amber-600'
                    }`}>
                      {tipo === 'AGREGADO' ? '+ AGREGADO' : tipo === 'QUITADO' ? '- QUITADO' : '~ EDITADO'}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-1">{r.nombre}</div>
                    {tipo === 'EDITADO' && (
                      <div className="text-xs text-slate-500 mb-2">{diffFila(r).join(' · ')}</div>
                    )}
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Motivo *</label>
                    <select
                      value={motivos[r.id] ?? ''}
                      onChange={(e) => setMotivos((m) => ({ ...m, [r.id]: e.target.value }))}
                      className={`w-full mt-1 text-xs border rounded-lg px-2 py-1.5 ${sinMotivo ? 'border-red-300' : 'border-slate-200'}`}
                    >
                      <option value="">Selecciona un motivo</option>
                      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {sinMotivo && (
                      <p className="text-[10px] text-red-500 mt-1">Elige un motivo para poder guardar</p>
                    )}
                  </div>
                );
              })}
            </div>

            {cambiosPendientes.length > 0 && (
              <>
                <label className="text-[10px] font-bold text-slate-400 uppercase mt-4 block">Comentario (opcional)</label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Ej. el jefe de turno confirmó la salida"
                  rows={2}
                  className="w-full mt-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                />
                <p className="text-[10px] text-slate-400 mt-3">
                  Se guardará como <b>versión {versionActual + 1}</b> a nombre de {user?.username ?? 'ti'}. El PDF se regenerará con la nueva versión.
                </p>
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => navigate('/trabunda/mis-reportes')}
                className="flex-1 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              >
                Descartar
              </button>
              <button
                disabled={!todosConMotivo || guardando}
                onClick={handleGuardar}
                className="flex-1 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {guardando ? 'Guardando...' : `Guardar cambios${cambiosPendientes.length ? ` (${cambiosPendientes.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalAgregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setModalAgregar(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Agregar trabajador</h3>
              <button onClick={() => setModalAgregar(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={18} />
              </button>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={busquedaModal}
                onChange={(e) => setBusquedaModal(e.target.value)}
                placeholder="Código, DNI o apellidos"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[10px] text-amber-600 mb-2">
              Búsqueda de ejemplo — falta exponer el lookup real del maestro de trabajadores en el gateway (Fase 2).
            </p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {MOCK_TRABAJADORES_DISPONIBLES
                .filter((t) =>
                  !busquedaModal ||
                  t.codigo.includes(busquedaModal) ||
                  t.documento.includes(busquedaModal) ||
                  t.nombre.toLowerCase().includes(busquedaModal.toLowerCase())
                )
                .map((t) => {
                  const yaEsta = codigosYaEnReporte.has(t.codigo);
                  return (
                    <div key={t.codigo} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl">
                      <div>
                        <div className="text-sm text-slate-800">{t.nombre}</div>
                        <div className="text-xs text-slate-400">{t.codigo} · DNI {t.documento}</div>
                      </div>
                      {yaEsta ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500">en reporte</span>
                      ) : (
                        <button
                          onClick={() => agregarTrabajador(t)}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}