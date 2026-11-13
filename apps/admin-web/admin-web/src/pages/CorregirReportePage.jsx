import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, Plus, Trash2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { apiGetTrabundaReporteDetalle, apiGetTrabundaDashboard, apiCorregirReporte, apiLookupTrabajador } from '../api/gateway';
import { calcularPlazo } from '../utils/plazoCorreccion';

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
  const [buscandoTrabajador, setBuscandoTrabajador] = useState(false);
  const [errorBusquedaModal, setErrorBusquedaModal] = useState(null);
  const [resultadoBusqueda, setResultadoBusqueda] = useState(null);
  const [guardando,    setGuardando]    = useState(false);
  const guardandoRef = useRef(false);

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
        // GET /areas en Trabunda_Backend devuelve el arreglo directo (res.json(rows)),
        // no envuelto en { areas } ni { data }.
        const listaAreas = Array.isArray(dashboard?.areas) ? dashboard.areas : [];
        setAreas(listaAreas.filter((a) => a?.id != null && a?.nombre));
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
    setRows ((prev) => {
      const fila = prev.find((r) => r.id === rowId);
      if (fila && !fila.original) {
        return prev.filter((r) => r.id !== rowId);
      }
      return prev.map((r) => (r.id === rowId ? { ...r, quitar: !r.quitar} : r));
    });
  }

  function agregarTrabajador(candidato) {
    setRows((prev) => [...prev, {
      id: `nuevo-${candidato.codigo}`,
      codigo: candidato.codigo,
      nombre: candidato.nombre,
      documento: candidato.documento,
      area_id: areas[0]?.id ?? null,
      area_nombre: areas[0]?.nombre ?? '',
      hora_inicio: '',
      hora_fin: '',
      horas: null,
      quitar: false,
      original: null,
    }]);
    setModalAgregar(false);
    setBusquedaModal('');
  }

  async function buscarTrabajador(e) {
    e.preventDefault();
    const q = busquedaModal.trim();
    if (!q) return;
    setBuscandoTrabajador(true);
    setErrorBusquedaModal(null);
    setResultadoBusqueda(null);
    try {
      const data = await apiLookupTrabajador(q);
      if (data?.error) {
        setErrorBusquedaModal(
          data.error === 'TRABAJADOR_NO_ENCONTRADO'
            ? 'No se encontró ningún trabajador con ese código o DNI.'
            : data.error
        );
        return;
      }
      setResultadoBusqueda(data.worker);
    } catch (err) {
      setErrorBusquedaModal(err.message ?? 'Error de red buscando trabajador');
    } finally {
      setBuscandoTrabajador(false);
    }
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
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const cambios = cambiosPendientes.map((r) => {
        if (r.estado === 'NUEVO') {
          return {
            tipo: 'AGREGAR',
            trabajador_codigo: r.codigo,
            area_id: r.area_id,
            hora_inicio: r.hora_inicio,
            hora_fin: r.hora_fin,
            motivo_tipo: motivos[r.id],
          };
        }
        if (r.estado === 'QUITAR'){
          return { tipo: 'QUITAR', linea_id: r.id, motivo_tipo: motivos[r.id]};
        }
        return {
          tipo: 'EDITAR',
          linea_id : r.id,
          area_id: r.area_id,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin,
          motivo_tipo: motivos[r.id],

        };
      });

      const resultado = await apiCorregirReporte(cabecera.id, {
        version: versionActual,
        comentario_general: comentario || undefined,
        cambios,
      });
      if (resultado?.ok === false || resultado?.error){
        if (resultado?.code === 'VERSION_CONFLICT'){
          alert(`Alguien más corrigió este reporte mientras tanto (ahora va en v${resultado.version_actual}). Recarga la página e inténtalo de nuevo. `);
        }else {
          alert('Error: ' + resultado.error);
        }
        return;
      }
      if (resultado.advertencias?.length){
        alert('Guardado con advertencias:\n' + resultado.advertencias.map((a) => `- ${a.mensaje}`).join('\n'));
      }

      navigate(-1);
    } catch (err) {
      alert('Error de red: ' + err.message);
    } finally {
      guardandoRef.current = false;
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
          Turno {cabecera.turno} · {cabecera.fecha} · {calcularPlazo(cabecera).texto}
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
                onClick={() => {
                  setModalAgregar(true);
                  setBusquedaModal('');
                  setResultadoBusqueda(null);
                  setErrorBusquedaModal(null);
                }}
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
                          value={r.area_id ?? ''}
                          onChange={(e) => {
                            const areaId = Number(e.target.value);
                            const area = areas.find((a) => a.id === areaId);
                            setRows((prev) => prev.map((row) => 
                              row.id === r.id ? { ...row, area_id: areaId, area_nombre: area?.nombre ?? row.area_nombre} : row  
                            ));
                          }}                          
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
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
                onClick={() => navigate(-1)}
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
            <form onSubmit={buscarTrabajador} className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={busquedaModal}
                  onChange={(e) => setBusquedaModal(e.target.value)}
                  placeholder="Código o DNI"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" disabled={buscandoTrabajador || !busquedaModal.trim()}
                className="px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {buscandoTrabajador ? <RefreshCw size={14} className="animate-spin" /> : 'Buscar'}
              </button>
            </form>

            {errorBusquedaModal && (
              <p className="text-xs text-red-500 mb-2">{errorBusquedaModal}</p>
            )}

            {resultadoBusqueda && (
              <div className="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl">
                <div>
                  <div className="text-sm text-slate-800">{resultadoBusqueda.nombre}</div>
                  <div className="text-xs text-slate-400">{resultadoBusqueda.codigo} · DNI {resultadoBusqueda.dni ?? '—'}</div>
                </div>
                {codigosYaEnReporte.has(resultadoBusqueda.codigo) ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500">en reporte</span>
                ) : (
                  <button
                    onClick={() => agregarTrabajador({
                      codigo: resultadoBusqueda.codigo,
                      nombre: resultadoBusqueda.nombre,
                      documento: resultadoBusqueda.dni,
                    })}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Agregar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}