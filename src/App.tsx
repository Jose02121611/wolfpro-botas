import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar, Clock, Phone, Settings, MessageCircle, 
  Plus, Trash2, ChevronLeft, Users, Lock, Loader2, Star, Search
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const rawConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
let app, auth, db;
if (rawConfig) {
    try {
        const firebaseConfig = JSON.parse(rawConfig);
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (e) {
        console.error("Error al cargar Firebase", e);
    }
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'kangoo-botas-app';

// Datos por defecto para la primera vez
const defaultSchedule = {
  1: ['08:00', '19:30'], 2: [], 3: ['08:00', '19:30'], 4: [], 5: ['08:00'], 6: [], 0: []
};
const defaultInventory = [
  { size: 'XS (35 - 36)', qty: 2 }, { size: 'S (37 - 38)', qty: 3 }, { size: 'M (39 - 40)', qty: 5 }, { size: 'L (41 - 42)', qty: 2 }
];

const DAYS_MAP = { '1': 'Lunes', '2': 'Martes', '3': 'Miércoles', '4': 'Jueves', '5': 'Viernes', '6': 'Sábado', '0': 'Domingo' };

export default function App() {
  const [user, setUser] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);
  
  // Navigation & Security State
  const [view, setView] = useState('client'); 
  const [pinPrompt, setPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // App Data State (Synced with Firebase)
  const [adminPhone, setAdminPhone] = useState('');
  const [schedule, setSchedule] = useState({});
  const [inventory, setInventory] = useState([]);
  const [socias, setSocias] = useState([]); 
  const [adminPin, setAdminPin] = useState('1234');
  const [reservations, setReservations] = useState([]);

  // --- FIREBASE EFFECTS ---
  useEffect(() => {
    if (!auth) return;
    
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth error", e);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
    const reservationsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reservations');

    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAdminPhone(data.adminPhone || '5491100000000');
        setSchedule(data.schedule || defaultSchedule);
        setInventory(data.inventory || defaultInventory);
        setSocias(data.socias || []); 
        setAdminPin(data.adminPin || '1234');
      } else {
        // Inicializar BD si está vacía
        setDoc(configRef, {
            adminPhone: '5491100000000',
            schedule: defaultSchedule,
            inventory: defaultInventory,
            socias: [],
            adminPin: '1234'
        }).catch(console.error);
      }
      setIsDbReady(true);
    }, (error) => console.error("Error Config:", error));

    const unsubRes = onSnapshot(reservationsCol, (snapshot) => {
      const resData = [];
      snapshot.forEach(doc => resData.push({ id: doc.id, ...doc.data() }));
      setReservations(resData);
    }, (error) => console.error("Error Reservas:", error));

    return () => {
      unsubConfig();
      unsubRes();
    };
  }, [user]);

  const updateConfig = async (newData) => {
    if (!db || !user) return;
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
      await updateDoc(configRef, newData);
    } catch (error) {
      console.error("Error al actualizar config:", error);
    }
  };

  const handlePinSubmit = () => {
    if (pinInput === adminPin) {
      setView('admin');
      setPinPrompt(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
        <div className="flex flex-col items-center bg-white p-8 rounded-[2rem] shadow-xl">
          <Loader2 size={40} className="text-red-600 animate-spin mb-4" />
          <p className="text-slate-600 font-medium text-lg">Conectando al sistema...</p>
        </div>
      </div>
    );
  }

  const ClientView = () => {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [selectedSize, setSelectedSize] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [step, setStep] = useState(0); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchSocia, setSearchSocia] = useState('');
    const [logoError, setLogoError] = useState(false); // Manejador de error de imagen

    const getAvailableTimes = () => {
      if (!selectedDate) return [];
      const [year, month, day] = selectedDate.split('-');
      const d = new Date(year, month - 1, day);
      return schedule[d.getDay()] || [];
    };

    const getAvailableQty = (size) => {
      const total = inventory.find(i => i.size === size)?.qty || 0;
      
      let assignedToSocias = 0;
      if (selectedDate && selectedTime) {
        const [year, month, day] = selectedDate.split('-');
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay().toString();

        assignedToSocias = socias.filter(s => 
          s.size === size && 
          s.fixedClasses && 
          s.fixedClasses.some(fc => fc.day === dayOfWeek && fc.time === selectedTime)
        ).length;
      }

      const booked = reservations.filter(
        r => r.date === selectedDate && r.time === selectedTime && r.size === size
      ).length;
      
      return Math.max(0, total - assignedToSocias - booked);
    };

    const handleConfirm = async () => {
      if (!selectedDate || !selectedTime || !selectedSize || !customerName) return;
      setIsSubmitting(true);

      if (db && user) {
        try {
          const reservationsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reservations');
          await addDoc(reservationsCol, {
            date: selectedDate,
            time: selectedTime,
            size: selectedSize,
            customerName: customerName,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          console.error("Error saving reservation:", error);
        }
      }

      const formattedDate = new Date(selectedDate).toLocaleDateString('es-AR', { timeZone: 'UTC' });
      const text = `¡Hola! Quiero confirmar mi turno para Kangoo Jumps.\n\n👤 *Nombre:* ${customerName}\n📅 *Fecha:* ${formattedDate}\n⏰ *Hora:* ${selectedTime} hs\n👟 *Talle de Bota:* ${selectedSize}\n\n¿Me confirmas si está todo ok?`;
      const encodedText = encodeURIComponent(text);
      const phone = adminPhone.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${phone}?text=${encodedText}`;

      window.open(waUrl, '_blank');
      
      setStep(0);
      setSelectedDate('');
      setSelectedTime('');
      setSelectedSize('');
      setCustomerName('');
      setIsSubmitting(false);
    };

    const today = new Date().toISOString().split('T')[0];
    const filteredSocias = socias.filter(s => s.name.toLowerCase().includes(searchSocia.toLowerCase()));

    return (
      <div className="flex flex-col h-full bg-slate-50 relative">
        <header className="bg-black text-white p-6 rounded-b-3xl shadow-lg z-10 relative border-b-4 border-red-600">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
               {!logoError ? (
                 <img 
                   src="Logo WolfPro.png" 
                   alt="WolfPro" 
                   className="h-14 w-auto mr-3 object-contain drop-shadow-md" 
                   onError={() => setLogoError(true)} 
                 />
               ) : (
                 <div>
                   <h1 className="text-2xl font-black tracking-tight leading-none italic text-white">WOLF<span className="text-red-600">PRO</span></h1>
                   <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mt-1">Training</p>
                 </div>
               )}
            </div>
            <button onClick={() => setPinPrompt(true)} className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-colors border border-neutral-700 shadow-sm">
              <Settings size={20} className="text-slate-300" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center justify-center h-full pb-10">
              
              {!logoError ? (
                <img 
                  src="Logo WolfPro.png" 
                  alt="WolfPro Training" 
                  className="w-56 h-auto object-contain mb-2 drop-shadow-2xl" 
                  onError={() => setLogoError(true)} 
                />
              ) : (
                <div className="w-24 h-24 bg-black text-red-600 rounded-full items-center justify-center mb-4 shadow-lg border-2 border-red-600 flex">
                  <span className="text-4xl font-black italic">WP</span>
                </div>
              )}
              
              <h2 className="text-2xl font-bold text-slate-800 mb-2 mt-2">¡Bienvenida!</h2>
              <p className="text-slate-500 text-center text-sm mb-8 px-4">Elige una opción para continuar con tu reserva o verificar tus botas.</p>
              
              <div className="w-full space-y-4">
                <button 
                  onClick={() => setStep(1)}
                  className="w-full bg-black text-white p-4 rounded-2xl font-bold flex items-center justify-center hover:bg-neutral-800 transition-colors shadow-lg"
                >
                  <Calendar className="mr-2" size={20} /> Reservar Turno Público
                </button>
                
                <button 
                  onClick={() => setStep('socias')}
                  className="w-full bg-black text-white p-4 rounded-2xl font-bold flex items-center justify-center hover:bg-neutral-800 transition-colors shadow-lg border border-red-600/30"
                >
                  <Star className="mr-2 text-red-500" size={20} /> Área Socias VIP
                </button>
              </div>
            </div>
          )}

          {step === 'socias' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <button onClick={() => setStep(0)} className="flex items-center text-slate-500 font-medium hover:text-slate-800 transition-colors mb-2">
                <ChevronLeft size={20} className="mr-1" /> Volver al inicio
              </button>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center mb-4">
                  <Star className="text-yellow-400 mr-2" size={24} />
                  <h3 className="font-bold text-slate-800 text-lg">Botas Fijas de Socias</h3>
                </div>
                <p className="text-sm text-slate-500 mb-6">Busca tu nombre para confirmar que tu par exclusivo está guardado y esperándote.</p>

                <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar mi nombre..." 
                    value={searchSocia}
                    onChange={(e) => setSearchSocia(e.target.value)}
                    className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  {socias.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-4 border border-dashed rounded-xl">Aún no hay socias registradas.</p>
                  ) : filteredSocias.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-4">No se encontró tu nombre.</p>
                  ) : (
                    filteredSocias.map(socia => (
                      <div key={socia.id} className="bg-gradient-to-r from-red-50 to-rose-50 p-4 rounded-xl flex flex-col border border-red-100 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-red-600 font-bold shadow-sm mr-3">
                              {socia.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{socia.name}</p>
                              <p className="text-xs text-red-600 font-medium">Socia VIP</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm">Talle {socia.size}</span>
                          </div>
                        </div>
                        
                        <div className="bg-white/60 p-2 rounded-lg border border-red-50">
                          <p className="text-xs text-slate-500 font-semibold mb-1">Tus clases fijas:</p>
                          <div className="flex flex-wrap gap-1">
                            {(!socia.fixedClasses || socia.fixedClasses.length === 0) ? (
                              <span className="text-xs text-slate-400">Sin clases asignadas</span>
                            ) : (
                              socia.fixedClasses.map((fc, idx) => (
                                <span key={idx} className="bg-white text-red-700 text-[10px] font-bold px-2 py-1 rounded border border-red-200">
                                  {DAYS_MAP[fc.day]} {fc.time}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <button onClick={() => setStep(0)} className="flex items-center text-slate-500 font-medium hover:text-slate-800 transition-colors mb-2">
                <ChevronLeft size={20} className="mr-1" /> Volver
              </button>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <label className="flex items-center text-slate-700 font-semibold mb-3">
                  <Calendar size={18} className="mr-2 text-red-500" /> 1. Selecciona la Fecha
                </label>
                <input 
                  type="date" min={today} value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                />
              </div>

              {selectedDate && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in duration-300">
                  <label className="flex items-center text-slate-700 font-semibold mb-3">
                    <Clock size={18} className="mr-2 text-red-500" /> 2. Selecciona el Horario
                  </label>
                  {getAvailableTimes().length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {getAvailableTimes().map(time => (
                        <button
                          key={time} onClick={() => setSelectedTime(time)}
                          className={`p-3 rounded-xl border transition-all font-medium ${
                            selectedTime === time ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-red-300'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No hay turnos disponibles este día.
                    </p>
                  )}
                </div>
              )}

              <button 
                disabled={!selectedDate || !selectedTime} onClick={() => setStep(2)}
                className="w-full bg-black text-white p-4 rounded-xl font-bold mt-4 disabled:opacity-50 hover:bg-neutral-800 transition-colors shadow-md"
              >
                Siguiente
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <button onClick={() => setStep(1)} className="flex items-center text-slate-500 font-medium hover:text-slate-800 transition-colors mb-2">
                <ChevronLeft size={20} className="mr-1" /> Volver
              </button>
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <label className="flex items-center text-slate-700 font-semibold mb-1">
                  3. Selecciona tu Talle
                </label>
                <p className="text-sm text-slate-500 mb-4">Disponibilidad pública para el {new Date(selectedDate).toLocaleDateString('es-AR', {timeZone: 'UTC'})} a las {selectedTime}</p>
                
                <div className="grid grid-cols-2 gap-3">
                  {inventory.map(item => {
                    const available = getAvailableQty(item.size);
                    const isAvailable = available > 0;
                    const isSelected = selectedSize === item.size;

                    return (
                      <button
                        key={item.size} disabled={!isAvailable} onClick={() => setSelectedSize(item.size)}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all text-center ${
                          isSelected ? 'bg-red-600 border-red-600 text-white shadow-md' :
                          !isAvailable ? 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed opacity-60' :
                          'bg-slate-50 border-slate-200 text-slate-700 hover:border-red-300'
                        }`}
                      >
                        <span className="text-lg font-bold">{item.size.includes('(') ? item.size : `Talle ${item.size}`}</span>
                        <span className={`text-xs mt-1 ${isSelected ? 'text-red-100' : 'text-slate-500'}`}>
                          {isAvailable ? `${available} disponibles` : 'Agotado'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                disabled={!selectedSize} onClick={() => setStep(3)}
                className="w-full bg-black text-white p-4 rounded-xl font-bold mt-4 disabled:opacity-50 hover:bg-neutral-800 transition-colors shadow-md"
              >
                Continuar
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <button onClick={() => setStep(2)} className="flex items-center text-slate-500 font-medium hover:text-slate-800 transition-colors mb-2">
                <ChevronLeft size={20} className="mr-1" /> Volver
              </button>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 text-lg mb-4">Resumen de tu Turno</h3>
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 mb-6 border border-slate-100">
                  <p className="flex justify-between text-sm"><span className="text-slate-500">Fecha:</span> <span className="font-semibold text-slate-800">{new Date(selectedDate).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</span></p>
                  <p className="flex justify-between text-sm"><span className="text-slate-500">Horario:</span> <span className="font-semibold text-slate-800">{selectedTime} hs</span></p>
                  <p className="flex justify-between text-sm"><span className="text-slate-500">Talle:</span> <span className="font-semibold text-slate-800">{selectedSize}</span></p>
                </div>

                <label className="block text-slate-700 font-semibold mb-2">¿Cuál es tu nombre?</label>
                <input 
                  type="text" placeholder="Ej: Juan Pérez" value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all mb-6"
                />

                <button 
                  disabled={!customerName.trim() || isSubmitting}
                  onClick={handleConfirm}
                  className="w-full bg-black text-white p-4 rounded-xl font-bold flex items-center justify-center disabled:opacity-50 hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-300"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                    <><MessageCircle className="mr-2" size={20} /> Confirmar por WhatsApp</>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  const AdminView = () => {
    const [activeTab, setActiveTab] = useState('inventory');

    return (
      <div className="flex flex-col h-full bg-slate-100 relative">
        <header className="bg-black text-white p-4 z-10 relative border-b-4 border-red-600">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center">
              <Settings size={20} className="mr-2 text-red-500" /> Panel Admin
            </h1>
            <button onClick={() => setView('client')} className="text-sm font-medium bg-neutral-800 px-3 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors">
              Cerrar
            </button>
          </div>
          
          <div className="flex mt-6 space-x-2">
            <button onClick={() => setActiveTab('inventory')} className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-red-500 text-red-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Inventario & Socias</button>
            <button onClick={() => setActiveTab('reservations')} className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reservations' ? 'border-red-500 text-red-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Reservas</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-red-500 text-red-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Ajustes</button>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'reservations' && <AdminReservations />}
          {activeTab === 'inventory' && <AdminInventory />}
          {activeTab === 'settings' && <AdminSettings />}
        </main>
      </div>
    );
  };

  const AdminReservations = () => {
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [deletingId, setDeletingId] = useState(null);

    const filteredReservations = reservations
      .filter(r => r.date === filterDate)
      .sort((a, b) => a.time.localeCompare(b.time));

    const handleDelete = async (id) => {
      if (db && user) {
        try {
          const resRef = doc(db, 'artifacts', appId, 'public', 'data', 'reservations', id);
          await deleteDoc(resRef);
          setDeletingId(null);
        } catch(e) { console.error(e) }
      }
    };

    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <label className="block text-sm font-semibold text-slate-600 mb-2">Ver reservas del día:</label>
          <input 
            type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-red-400"
          />
        </div>

        {filteredReservations.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-dashed border-slate-300">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No hay reservas para esta fecha.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReservations.map(res => (
              <div key={res.id} className="relative bg-white p-4 rounded-xl shadow-sm flex items-center justify-between border-l-4 border-red-500 overflow-hidden">
                <div>
                  <h4 className="font-bold text-slate-800">{res.customerName}</h4>
                  <div className="text-sm text-slate-500 flex items-center mt-1 space-x-3">
                    <span className="flex items-center"><Clock size={14} className="mr-1 text-red-500" /> {res.time} hs</span>
                    <span className="font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">Talle {res.size}</span>
                  </div>
                </div>
                <button onClick={() => setDeletingId(res.id)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-full transition-colors">
                  <Trash2 size={18} />
                </button>

                {deletingId === res.id && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-end px-4 z-10 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-sm font-bold text-slate-700 mr-4">¿Cancelar turno?</p>
                    <button onClick={() => handleDelete(res.id)} className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium mr-2 shadow-sm hover:bg-red-600">Sí</button>
                    <button onClick={() => setDeletingId(null)} className="bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-300">No</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const AdminInventory = () => {
    const [newSize, setNewSize] = useState('');
    const [newQty, setNewQty] = useState('');
    const [deletingSize, setDeletingSize] = useState(null);

    const [newSociaName, setNewSociaName] = useState('');
    const [newSociaSize, setNewSociaSize] = useState('');
    const [newSociaClasses, setNewSociaClasses] = useState([]);
    const [deletingSocia, setDeletingSocia] = useState(null);

    const handleAddSize = async () => {
      if (!newSize || !newQty) return;
      let newInventory;
      const exists = inventory.find(i => i.size === newSize);
      if (exists) {
        newInventory = inventory.map(i => i.size === newSize ? { ...i, qty: parseInt(newQty) } : i);
      } else {
        newInventory = [...inventory, { size: newSize, qty: parseInt(newQty) }].sort((a,b) => a.size.localeCompare(b.size));
      }
      await updateConfig({ inventory: newInventory });
      setNewSize(''); setNewQty('');
    };

    const handleDeleteSize = async (size) => {
      const newInventory = inventory.filter(i => i.size !== size);
      const newSocias = socias.filter(s => s.size !== size);
      await updateConfig({ inventory: newInventory, socias: newSocias });
      setDeletingSize(null);
    };

    const toggleClassSelection = (day, time) => {
      const exists = newSociaClasses.find(c => c.day === day && c.time === time);
      if (exists) {
        setNewSociaClasses(newSociaClasses.filter(c => !(c.day === day && c.time === time)));
      } else {
        setNewSociaClasses([...newSociaClasses, { day, time }]);
      }
    };

    const handleAddSocia = async () => {
      if (!newSociaName || !newSociaSize || newSociaClasses.length === 0) return;
      
      const newSocias = [...socias, { 
        id: Date.now().toString(), 
        name: newSociaName, 
        size: newSociaSize,
        fixedClasses: newSociaClasses
      }];
      await updateConfig({ socias: newSocias });
      setNewSociaName('');
      setNewSociaSize('');
      setNewSociaClasses([]);
    };

    const handleDeleteSocia = async (id) => {
      const newSocias = socias.filter(s => s.id !== id);
      await updateConfig({ socias: newSocias });
      setDeletingSocia(null);
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center">
            <Plus size={18} className="mr-2 text-red-500" /> Cargar / Editar Talles (Stock Físico)
          </h3>
          <div className="flex space-x-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 ml-1">Talle (Ej: XS (35-36))</label>
              <input type="text" value={newSize} onChange={(e) => setNewSize(e.target.value)} className="w-full mt-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-red-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 ml-1">Cantidad Total</label>
              <input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} className="w-full mt-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-red-400" />
            </div>
          </div>
          <button onClick={handleAddSize} disabled={!newSize || !newQty} className="w-full mt-4 bg-black text-white font-medium py-2 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            Guardar Talle
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">Inventario Real vs Disponibilidad</h3>
            <p className="text-xs text-slate-500 mt-1">Acá ves el stock total y las asignaciones a socias.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {inventory.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">No hay talles.</p> : 
              inventory.map(item => {
                const assignedCount = socias.filter(s => s.size === item.size).length;

                return (
                  <div key={item.size} className="relative p-4 flex items-center justify-between overflow-hidden">
                    <div className="flex items-center">
                      <div className="px-3 py-2 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm border-2 border-white shadow-sm z-10 text-center">{item.size}</div>
                      <div className="ml-4">
                        <p className="text-sm font-bold text-slate-800">{item.qty} Pares Totales</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span className="text-amber-500 font-medium">{assignedCount} botas asignadas a socias</span>
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setDeletingSize(item.size)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-full transition-colors">
                      <Trash2 size={18} />
                    </button>

                    {deletingSize === item.size && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-end px-4 z-20 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-sm font-bold text-slate-700 mr-4">¿Borrar talle y sus socias?</p>
                      <button onClick={() => handleDeleteSize(item.size)} className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium mr-2 hover:bg-red-600">Sí</button>
                      <button onClick={() => setDeletingSize(null)} className="bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-300">No</button>
                    </div>
                  )}
                  </div>
                )
              })}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-rose-50 p-5 rounded-xl shadow-sm border border-red-100">
          <h3 className="font-bold text-red-800 mb-4 flex items-center">
            <Star size={18} className="mr-2 text-yellow-500" /> Asignar Bota Fija (Socia)
          </h3>
          <p className="text-xs text-red-700 mb-3">Elige qué días asiste para bloquear el stock público solo en esos turnos.</p>
          
          <div className="flex flex-col space-y-4">
            <div>
              <label className="text-xs font-semibold text-red-700 ml-1">Nombre de la Socia</label>
              <input type="text" placeholder="Ej: Valeria Gomez" value={newSociaName} onChange={(e) => setNewSociaName(e.target.value)} className="w-full mt-1 p-2 border border-red-200 rounded-lg outline-none focus:border-red-400 bg-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-red-700 ml-1">Asignar Talle</label>
              <select value={newSociaSize} onChange={(e) => setNewSociaSize(e.target.value)} className="w-full mt-1 p-2 border border-red-200 rounded-lg outline-none focus:border-red-400 bg-white">
                <option value="">Selecciona un talle del inventario...</option>
                {inventory.map(item => (
                   <option key={item.size} value={item.size}>{item.size} (Stock Total: {item.qty})</option>
                ))}
              </select>
            </div>
            
            {newSociaSize && (
              <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                <label className="text-xs font-semibold text-red-700 mb-2 block">Días y Horarios Fijos:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {Object.entries(schedule).map(([day, times]) => {
                    if (times.length === 0) return null;
                    return (
                      <div key={day} className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{DAYS_MAP[day]}</span>
                        <div className="flex flex-wrap gap-2">
                          {times.map(time => {
                            const isSelected = newSociaClasses.some(c => c.day === day && c.time === time);
                            return (
                              <button
                                key={time}
                                onClick={() => toggleClassSelection(day, time)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                                  isSelected 
                                    ? 'bg-red-600 border-red-600 text-white shadow-sm' 
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-red-300'
                                }`}
                              >
                                {time} hs
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {newSociaClasses.length === 0 && <p className="text-[10px] text-amber-600 mt-2">* Debes seleccionar al menos un horario.</p>}
              </div>
            )}
          </div>
          <button onClick={handleAddSocia} disabled={!newSociaName || !newSociaSize || newSociaClasses.length === 0} className="w-full mt-4 bg-black text-white font-medium py-2 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-sm">
            Guardar Socia
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Listado de Socias</h3>
              <p className="text-xs text-slate-500 mt-1">Botas que ya no están disponibles al público.</p>
            </div>
            <div className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md">{socias.length} Socias</div>
          </div>
          <div className="divide-y divide-slate-100">
            {socias.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">No hay socias asignadas aún.</p> : 
              socias.map(socia => (
                <div key={socia.id} className="relative p-4 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center font-bold text-red-700">
                        {socia.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-bold text-slate-800">{socia.name}</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Talle: <span className="text-slate-800 font-bold">{socia.size}</span></p>
                      </div>
                    </div>
                    <button onClick={() => setDeletingSocia(socia.id)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-full transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="mt-3 ml-12">
                    <div className="flex flex-wrap gap-1">
                      {(!socia.fixedClasses || socia.fixedClasses.length === 0) ? (
                        <span className="text-[10px] text-slate-400">Sin horarios</span>
                      ) : (
                        socia.fixedClasses.map((fc, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                            {DAYS_MAP[fc.day]} {fc.time}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {deletingSocia === socia.id && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-end px-4 z-10 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-sm font-bold text-slate-700 mr-4">¿Quitar bota fija?</p>
                    <button onClick={() => handleDeleteSocia(socia.id)} className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium mr-2 hover:bg-red-600">Sí</button>
                    <button onClick={() => setDeletingSocia(null)} className="bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-300">No</button>
                  </div>
                )}
                </div>
              ))}
          </div>
        </div>

      </div>
    );
  };

  const AdminSettings = () => {
    const [newTime, setNewTime] = useState('');
    const [selectedDayAdmin, setSelectedDayAdmin] = useState('1'); 
    const [localPhone, setLocalPhone] = useState(adminPhone);
    const [localPin, setLocalPin] = useState(adminPin);

    const handleAddTime = async () => {
      if (newTime && !schedule[selectedDayAdmin].includes(newTime)) {
        const newSchedule = { ...schedule, [selectedDayAdmin]: [...schedule[selectedDayAdmin], newTime].sort() };
        await updateConfig({ schedule: newSchedule });
        setNewTime('');
      }
    };

    const handleRemoveTime = async (timeToRemove) => {
      const newSchedule = { ...schedule, [selectedDayAdmin]: schedule[selectedDayAdmin].filter(t => t !== timeToRemove) };
      await updateConfig({ schedule: newSchedule });
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center"><Phone size={18} className="mr-2 text-red-500" /> WhatsApp Contacto</h3>
          <div className="flex space-x-2">
            <input 
              type="text" value={localPhone} onChange={(e) => setLocalPhone(e.target.value)}
              className="flex-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-red-400 text-sm"
            />
            <button onClick={() => updateConfig({ adminPhone: localPhone })} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800">Guardar</button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center"><Lock size={18} className="mr-2 text-red-500" /> Seguridad (PIN)</h3>
          <div className="flex space-x-2">
            <input 
              type="text" value={localPin} onChange={(e) => setLocalPin(e.target.value)} maxLength="6"
              className="flex-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-red-400 text-sm tracking-widest font-mono"
            />
            <button onClick={() => updateConfig({ adminPin: localPin })} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800">Cambiar</button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Clock size={18} className="mr-2 text-red-500" /> Horarios por Día</h3>
          <select 
            value={selectedDayAdmin} onChange={(e) => setSelectedDayAdmin(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-red-400 mb-4 bg-slate-50 font-medium text-slate-700"
          >
            {Object.entries(DAYS_MAP).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>

          <div className="flex space-x-2 mb-4">
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-red-400" />
            <button onClick={handleAddTime} className="bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-neutral-800">Añadir</button>
          </div>

          <div className="flex flex-wrap gap-2">
            {schedule[selectedDayAdmin].length === 0 ? (
               <p className="text-sm text-slate-500 w-full text-center py-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">Día libre de turnos.</p>
            ) : (
              schedule[selectedDayAdmin].map(time => (
                <div key={time} className="flex items-center bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                  <span className="text-sm font-medium text-slate-700 mr-2">{time} hs</span>
                  <button onClick={() => handleRemoveTime(time)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4 font-sans text-slate-900">
      
      {/* PIN Prompt Modal */}
      {pinPrompt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500 mx-auto">
              <Lock size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1 text-center">Panel Privado</h3>
            <p className="text-sm text-slate-500 mb-6 text-center">Ingresa el PIN para administrar turnos.</p>
            
            <input 
              type="password" maxLength="6" value={pinInput} placeholder="••••"
              onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              className={`w-full p-4 border rounded-xl text-center text-3xl tracking-[0.5em] focus:ring-2 outline-none mb-2 font-mono transition-colors ${pinError ? 'border-red-400 focus:ring-red-500 bg-red-50' : 'border-slate-300 focus:ring-slate-800'}`}
            />
            {pinError && <p className="text-red-500 text-xs text-center font-medium mb-4">PIN incorrecto, intenta de nuevo.</p>}
            
            <div className="flex space-x-3 mt-6">
              <button onClick={() => {setPinPrompt(false); setPinInput(''); setPinError(false);}} className="flex-1 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors">Cancelar</button>
              <button onClick={handlePinSubmit} className="flex-1 p-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold shadow-md transition-colors">Ingresar</button>
            </div>
          </div>
        </div>
      )}

      {/* Main App Container */}
      <div className="w-full max-w-md h-[850px] max-h-[90vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative border-4 border-white">
        {view === 'client' ? <ClientView /> : <AdminView />}
      </div>
    </div>
  );
}