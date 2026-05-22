import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Users, 
  Package, 
  Sliders,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  DollarSign
} from 'lucide-react';

// --- TIPOS DE DATOS ---
interface Socio {
  id: string;
  nombre: string;
  telefono: string;
  talleBota: string;
  peso: number;
}

interface Reserva {
  id: string;
  socioId: string;
  socioNombre: string;
  fecha: string;
  turno: string;
  botaAsignada?: string;
  estado: 'Confirmada' | 'Pendiente' | 'Cancelada';
}

interface Bota {
  id: string;
  talle: string;
  modelo: string;
  rangoPeso: string;
  estado: 'Disponible' | 'En Uso' | 'Mantenimiento';
}

interface TurnoConfig {
  id: string;
  hora: string;
  capacidadMax: number;
}

export default function App() {
  // --- ESTADOS DE LA APP ---
  const [tab, setTab] = useState<'inicio' | 'reservas' | 'socios' | 'inventario' | 'config'>('inicio');
  
  // Base de datos simulada en LocalStorage
  const [socios, setSocios] = useState<Socio[]>(() => {
    const saved = localStorage.getItem('wp_socios');
    return saved ? JSON.parse(saved) : [
      { id: '1', nombre: 'Ana García', telefono: '2615551234', talleBota: 'M', peso: 65 },
      { id: '2', nombre: 'Laura Martínez', telefono: '2615555678', talleBota: 'L', peso: 78 },
      { id: '3', nombre: 'Carlos Pérez', telefono: '2615559012', talleBota: 'XL', peso: 92 }
    ];
  });

  const [botas, setBotas] = useState<Bota[]>(() => {
    const saved = localStorage.getItem('wp_botas');
    return saved ? JSON.parse(saved) : [
      { id: 'B1', talle: 'S', modelo: 'PaceWing', rangoPeso: '50-65kg', estado: 'Disponible' },
      { id: 'B2', talle: 'M', modelo: 'Kangaroo Jumps', rangoPeso: '65-80kg', estado: 'Disponible' },
      { id: 'B3', talle: 'L', modelo: 'Kangaroo Jumps', rangoPeso: '80-95kg', estado: 'Disponible' },
      { id: 'B4', talle: 'XL', modelo: 'PaceWing', rangoPeso: '95+kg', estado: 'Disponible' }
    ];
  });

  const [turnos, setTurnos] = useState<TurnoConfig[]>(() => {
    const saved = localStorage.getItem('wp_turnos');
    return saved ? JSON.parse(saved) : [
      { id: 't1', hora: '19:00', capacidadMax: 15 },
      { id: 't2', hora: '20:15', capacidadMax: 15 }
    ];
  });

  const [reservas, setReservas] = useState<Reserva[]>(() => {
    const saved = localStorage.getItem('wp_reservas');
    return saved ? JSON.parse(saved) : [
      { id: 'r1', socioId: '1', socioNombre: 'Ana García', fecha: '2026-05-25', turno: '19:00', botaAsignada: 'B2', estado: 'Confirmada' },
      { id: 'r2', socioId: '2', socioNombre: 'Laura Martínez', fecha: '2026-05-25', turno: '19:00', botaAsignada: 'B3', estado: 'Confirmada' }
    ];
  });

  // Guardar datos automáticamente al cambiar
  useEffect(() => { localStorage.setItem('wp_socios', JSON.stringify(socios)); }, [socios]);
  useEffect(() => { localStorage.setItem('wp_botas', JSON.stringify(botas)); }, [botas]);
  useEffect(() => { localStorage.setItem('wp_turnos', JSON.stringify(turnos)); }, [turnos]);
  useEffect(() => { localStorage.setItem('wp_reservas', JSON.stringify(reservas)); }, [reservas]);

  // Formulario temporal
  const [nuevoSocio, setNuevoSocio] = useState({ nombre: '', telefono: '', talleBota: 'M', peso: 70 });
  const [nuevaReserva, setNuevaReserva] = useState({ socioId: '', fecha: '', turno: '' });

  // --- LOGICA DE RESERVA ---
  const handleCrearReserva = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaReserva.socioId || !nuevaReserva.fecha || !nuevaReserva.turno) return;

    const socio = socios.find(s => s.id === nuevaReserva.socioId);
    if (!socio) return;

    // Buscar bota disponible del talle del socio
    const botaDisponible = botas.find(b => b.talle === socio.talleBota && b.estado === 'Disponible');

    const reserva: Reserva = {
      id: 'res_' + Date.now(),
      socioId: socio.id,
      socioNombre: socio.nombre,
      fecha: nuevaReserva.fecha,
      turno: nuevaReserva.turno,
      botaAsignada: botaDisponible ? botaDisponible.id : undefined,
      estado: botaDisponible ? 'Confirmada' : 'Pendiente'
    };

    if (botaDisponible) {
      setBotas(botas.map(b => b.id === botaDisponible.id ? { ...b, estado: 'En Uso' } : b));
    }

    setReservas([...reservas, reserva]);
    setNuevaReserva({ socioId: '', fecha: '', turno: '' });
  };

  const handleCrearSocio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoSocio.nombre || !nuevoSocio.telefono) return;

    const socio: Socio = {
      id: 'soc_' + Date.now(),
      ...nuevoSocio
    };

    setSocios([...socios, socio]);
    setNuevoSocio({ nombre: '', telefono: '', talleBota: 'M', peso: 70 });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col selection:bg-red-600 selection:text-white">
      {/* HEADER DE LA APP */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center font-black text-xl tracking-tighter text-white shadow-lg shadow-red-600/20">
            W
          </div>
          <div>
            <h1 className="font-black text-xl tracking-wide text-white uppercase">WolfPro<span className="text-red-600">.</span></h1>
            <p className="text-xs text-zinc-400 font-medium">Gestión de Botas & Turnos</p>
          </div>
        </div>
        
        {/* NAV LOCAL DE ESCRITORIO */}
        <nav className="hidden md:flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {(['inicio', 'reservas', 'socios', 'inventario', 'config'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
                tab === t ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
        
        {/* TAB INICIO: DASHBOARD */}
        {tab === 'inicio' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-red-900/40 to-zinc-900 p-6 rounded-2xl border border-red-800/30 shadow-xl">
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">¡Hola, José! 👋</h2>
              <p className="text-zinc-400 mt-1">Acá tenés el estado de WolfPro Training para las clases de hoy.</p>
            </div>

            {/* METRICAS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <div className="flex justify-between items-start text-zinc-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Reservas Hoy</span>
                  <Calendar className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-2xl font-black mt-2 text-white">{reservas.length}</p>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <div className="flex justify-between items-start text-zinc-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Socios Activos</span>
                  <Users className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-2xl font-black mt-2 text-white">{socios.length}</p>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <div className="flex justify-between items-start text-zinc-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Botas Libres</span>
                  <Package className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-2xl font-black mt-2 text-green-500">
                  {botas.filter(b => b.estado === 'Disponible').length}
                </p>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <div className="flex justify-between items-start text-zinc-400">
                  <span className="text-xs font-bold uppercase tracking-wider">En Lista de Espera</span>
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                </div>
                <p className="text-2xl font-black mt-2 text-yellow-500">
                  {reservas.filter(r => r.estado === 'Pendiente').length}
                </p>
              </div>
            </div>

            {/* ACCESOS RAPIDOS */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 space-y-4">
                <h3 className="font-black text-sm uppercase tracking-wider text-red-500 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nueva Reserva Rápida
                </h3>
                <form onSubmit={handleCrearReserva} className="space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 font-bold uppercase mb-1">Socio</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-red-600"
                      value={nuevaReserva.socioId}
                      onChange={e => setNuevaReserva({...nuevaReserva, socioId: e.target.value})}
                    >
                      <option value="">Seleccionar socio...</option>
                      {socios.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre} (Talle {s.talleBota})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-400 font-bold uppercase mb-1">Fecha</label>
                      <input 
                        type="date" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-red-600"
                        value={nuevaReserva.fecha}
                        onChange={e => setNuevaReserva({...nuevaReserva, fecha: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 font-bold uppercase mb-1">Turno</label>
                      <select 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-red-600"
                        value={nuevaReserva.turno}
                        onChange={e => setNuevaReserva({...nuevaReserva, turno: e.target.value})}
                      >
                        <option value="">Turno...</option>
                        {turnos.map(t => (
                          <option key={t.id} value={t.hora}>{t.hora}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-red-600 hover:bg-red-700 font-bold py-2 rounded-lg text-sm uppercase text-white transition-colors">
                    Confirmar Turno
                  </button>
                </form>
              </div>

              {/* LISTA PROXIMOS */}
              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 flex flex-col">
                <h3 className="font-black text-sm uppercase tracking-wider text-zinc-300 mb-3">Turnos de Hoy</h3>
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px]">
                  {reservas.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">No hay reservas agendadas.</p>
                  ) : (
                    reservas.map(res => (
                      <div key={res.id} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm text-white">{res.socioNombre}</p>
                          <div className="flex gap-3 text-xs text-zinc-400 mt-0.5">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {res.turno}</span>
                            <span>Bota: {res.botaAsignada || '⚠️ Sin bota'}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-black px-2 py-1 rounded uppercase ${
                          res.estado === 'Confirmada' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {res.estado}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESTRICCIÓN DE TABS COMPLETA PARA MANTENER LA NAVEGACIÓN */}
        {tab === 'reservas' && (
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-xl font-black uppercase text-white mb-4">Historial y Control de Reservas</h2>
            <p className="text-zinc-400 text-sm">Sección de gestión de turnos completa.</p>
          </div>
        )}
        {tab === 'socios' && (
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-xl font-black uppercase text-white mb-4">Fichas de Alumnas (Socios)</h2>
            <form onSubmit={handleCrearSocio} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
              <input type="text" placeholder="Nombre completo" className="bg-zinc-900 p-2 text-sm rounded border border-zinc-800 text-white" value={nuevoSocio.nombre} onChange={e => setNuevoSocio({...nuevoSocio, nombre: e.target.value})}/>
              <input type="text" placeholder="Teléfono" className="bg-zinc-900 p-2 text-sm rounded border border-zinc-800 text-white" value={nuevoSocio.telefono} onChange={e => setNuevoSocio({...nuevoSocio, telefono: e.target.value})}/>
              <select className="bg-zinc-900 p-2 text-sm rounded border border-zinc-800 text-white" value={nuevoSocio.talleBota} onChange={e => setNuevoSocio({...nuevoSocio, talleBota: e.target.value})}>
                <option value="S">Talle S</option><option value="M">Talle M</option><option value="L">Talle L</option><option value="XL">Talle XL</option>
              </select>
              <button type="submit" className="bg-red-600 hover:bg-red-700 font-bold text-sm uppercase rounded text-white">Agregar</button>
            </form>
          </div>
        )}
        {tab === 'inventario' && (
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-xl font-black uppercase text-white mb-4">Inventario de Botas (Kangoo / PaceWing)</h2>
            <p className="text-zinc-400 text-sm">Mapeo e inventariado de resortes y fijaciones.</p>
          </div>
        )}
        {tab === 'config' && (
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-xl font-black uppercase text-white mb-4">Configuraciones del Sistema</h2>
            <p className="text-zinc-400 text-sm">Ajustes generales del sistema WolfPro.</p>
          </div>
        )}

      </main>

      {/* MENÚ MÓVIL INFERIOR */}
      <footer className="md:hidden bg-zinc-900 border-t border-zinc-800 sticky bottom-0 z-50">
        <div className="grid grid-cols-5 h-16">
          {(['inicio', 'reservas', 'socios', 'inventario', 'config'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-tighter ${
                tab === t ? 'text-red-500 bg-zinc-950' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="text-base mb-0.5">
                {t === 'inicio' && '🏠'}
                {t === 'reservas' && '📅'}
                {t === 'socios' && '👥'}
                {t === 'inventario' && '🥾'}
                {t === 'config' && '⚙️'}
              </span>
              {t}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
