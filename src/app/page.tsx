'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

type DeviceState = {
  power?: boolean;
  position?: number;
  temperature?: number;
  alarm?: boolean;
};

type Device = {
  id: string;
  name: string;
  room: string;
  type: string;
  capabilities: string[];
  mode: 'auto' | 'manual';
  schedule: { close_at?: string; open_at?: string; close_on?: boolean; open_on?: boolean } | null;
  state: DeviceState | null;
};

type Contact = {
  id: string;
  name: string;
  email: string;
};

const TYPE_LABELS: Record<string, string> = {
  blind: 'Persiana',
  light: 'Llum',
  fan: 'Ventilador',
  buzzer: "Detector de fum",
  plug: 'Endoll',
  sensor: 'Sensor',
};

const TYPE_ICONS: Record<string, string> = {
  blind: '🪟',
  light: '💡',
  fan: '🌡️',
  buzzer: '🔥',
  plug: '🔌',
  sensor: '📊',
};

const ROOM_ICONS: Record<string, string> = {
  lavabo: '🚿',
  exterior: '🌳',
  menjador: '🍽️',
  habitacio: '🛏️',
  cuina: '🍳',
  salo: '🛋️',
  entrada: '🚪',
};

function deviceIcon(d: Device) {
  const base = TYPE_ICONS[d.type] ?? '🔌';
  const room = d.room
    ?.trim()
    .toLowerCase()
    .replace(/[àá]/g, 'a')
    .replace(/[èé]/g, 'e')
    .replace(/[íï]/g, 'i')
    .replace(/[òó]/g, 'o')
    .replace(/[úü]/g, 'u')
    .replace(/ç/g, 'c');
  const roomIcon = room ? ROOM_ICONS[room] : undefined;
  return roomIcon ? `${base}${roomIcon}` : base;
}

const CAPABILITIES: Record<string, string[]> = {
  blind: ['position', 'stop'],
  light: ['power'],
  fan: ['power'],
  buzzer: ['test'],
  plug: ['power'],
  sensor: ['reading'],
};

const TEXT_SCALE_MIN = 0.85;
const TEXT_SCALE_MAX = 1.4;
const TEXT_SCALE_STEP = 0.1;

type View = 'home' | 'device' | 'settings';

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const [household, setHousehold] = useState<Household | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const [devices, setDevices] = useState<Device[]>([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceRoom, setNewDeviceRoom] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('blind');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [sosSending, setSosSending] = useState(false);

  const [view, setView] = useState<View>('home');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [textScale, setTextScale] = useState(1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadHousehold();
    } else {
      setHousehold(null);
    }
  }, [session]);

  useEffect(() => {
    if (household) {
      loadDevices(household.id);
      loadContacts(household.id);
    } else {
      setDevices([]);
      setContacts([]);
    }
  }, [household]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bertaTextScale');
      if (saved) setTextScale(parseFloat(saved));
    } catch {
      // localStorage no disponible, ignorem
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = (16 * textScale) + 'px';
    try {
      localStorage.setItem('bertaTextScale', String(textScale));
    } catch {
      // localStorage no disponible, ignorem
    }
  }, [textScale]);

  function increaseTextSize() {
    setTextScale((s) => Math.min(TEXT_SCALE_MAX, +(s + TEXT_SCALE_STEP).toFixed(2)));
  }

  function decreaseTextSize() {
    setTextScale((s) => Math.max(TEXT_SCALE_MIN, +(s - TEXT_SCALE_STEP).toFixed(2)));
  }

  function resetTextSize() {
    setTextScale(1);
  }

  async function loadHousehold() {
    setHouseholdLoading(true);
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .maybeSingle();

    if (membership) {
      const { data: householdData } = await supabase
        .from('household')
        .select('*')
        .eq('id', membership.household_id)
        .single();
      setHousehold(householdData);
    } else {
      setHousehold(null);
    }
    setHouseholdLoading(false);
  }

  async function loadDevices(householdId: string) {
    const { data } = await supabase
      .from('devices')
      .select('id, name, room, type, capabilities, mode, schedule, state')
      .eq('household_id', householdId)
      .order('created_at');
    setDevices(data ?? []);
  }

  async function loadContacts(householdId: string) {
    const { data } = await supabase
      .from('emergency_contacts')
      .select('id, name, email')
      .eq('household_id', householdId)
      .order('created_at');
    setContacts(data ?? []);
  }

  async function handleSignUp() {
    setMessage('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage('Error: ' + error.message);
    else setMessage('Compte creat! Ja pots iniciar sessió.');
  }

  async function handleSignIn() {
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage('Error: ' + error.message);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleCreateHousehold() {
    setMessage('');
    const { error } = await supabase.rpc('create_household', {
      household_name: newHouseholdName,
    });
    if (error) setMessage('Error: ' + error.message);
    else await loadHousehold();
  }

  async function handleJoinHousehold() {
    setMessage('');
    const { error } = await supabase.rpc('join_household', {
      code: joinCode,
    });
    if (error) setMessage('Error: ' + error.message);
    else await loadHousehold();
  }

  async function handleAddDevice() {
    if (!household || !newDeviceName || !newDeviceRoom) return;
    setMessage('');
    const { error } = await supabase.from('devices').insert({
      household_id: household.id,
      device_uid: crypto.randomUUID(),
      name: newDeviceName,
      room: newDeviceRoom,
      type: newDeviceType,
      capabilities: CAPABILITIES[newDeviceType],
    });
    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setNewDeviceName('');
      setNewDeviceRoom('');
      await loadDevices(household.id);
    }
  }

  async function sendCommand(
    deviceId: string,
    command: Record<string, unknown>,
    mode?: 'auto' | 'manual',
    stateUpdate?: DeviceState
  ) {
    if (!household) return;
    const device = devices.find((d) => d.id === deviceId);
    const update: Record<string, unknown> = { pending_command: command };
    if (mode) update.mode = mode;
    if (stateUpdate) update.state = { ...(device?.state ?? {}), ...stateUpdate };
    const { error } = await supabase.from('devices').update(update).eq('id', deviceId);
    if (error) setMessage('Error: ' + error.message);
    else await loadDevices(household.id);
  }

  async function togglePower(device: Device, turnOn: boolean) {
    await sendCommand(device.id, { capability: 'power', value: turnOn }, 'manual', { power: turnOn });
  }

  async function setMode(device: Device, mode: 'auto' | 'manual') {
    if (!household) return;
    const { error } = await supabase.from('devices').update({ mode }).eq('id', device.id);
    if (error) setMessage('Error: ' + error.message);
    else await loadDevices(household.id);
  }

  async function setBlindTime(device: Device, key: 'close_at' | 'open_at', value: string) {
    if (!household) return;
    const onKey = key === 'close_at' ? 'close_on' : 'open_on';
    const merged: NonNullable<Device['schedule']> = { ...(device.schedule ?? {}) };
    if (value) {
      merged[key] = value;
      if (merged[onKey] === undefined) merged[onKey] = true;
    } else {
      delete merged[key];
      delete merged[onKey];
    }
    const hasAny = Boolean(merged.close_at || merged.open_at);
    const { error } = await supabase
      .from('devices')
      .update({ schedule: hasAny ? merged : null })
      .eq('id', device.id);
    if (error) setMessage('Error: ' + error.message);
    else await loadDevices(household.id);
  }

  async function toggleBlindSchedule(device: Device, direction: 'close' | 'open') {
    if (!household) return;
    const key = direction === 'close' ? 'close_on' : 'open_on';
    const current = device.schedule?.[key] ?? true;
    const merged: NonNullable<Device['schedule']> = { ...(device.schedule ?? {}), [key]: !current };
    const { error } = await supabase
      .from('devices')
      .update({ schedule: merged })
      .eq('id', device.id);
    if (error) setMessage('Error: ' + error.message);
    else await loadDevices(household.id);
  }

  async function blindAction(device: Device, action: 'open' | 'close' | 'stop') {
    if (action === 'stop') {
      await sendCommand(device.id, { capability: 'stop' });
    } else {
      const position = action === 'open' ? 100 : 0;
      await sendCommand(device.id, { capability: 'position', value: position }, undefined, { position });
    }
  }

  async function handleAddContact() {
    if (!household || !newContactName || !newContactEmail) return;
    setMessage('');
    const { error } = await supabase.from('emergency_contacts').insert({
      household_id: household.id,
      name: newContactName,
      email: newContactEmail,
    });
    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setNewContactName('');
      setNewContactEmail('');
      await loadContacts(household.id);
    }
  }

  async function handleDeleteContact(id: string) {
    if (!household) return;
    await supabase.from('emergency_contacts').delete().eq('id', id);
    await loadContacts(household.id);
  }

  async function handleSOS() {
    if (!household || !session || contacts.length === 0) {
      setMessage("Afegeix algun contacte abans d'enviar un SOS.");
      return;
    }
    setSosSending(true);
    setMessage('');
    await supabase.from('sos_events').insert({
      household_id: household.id,
      triggered_by: session.user.id,
    });
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdName: household.name,
          triggeredByEmail: session.user.email,
          contacts,
        }),
      });
      if (res.ok) {
        setMessage('Avís enviat als familiars.');
      } else {
        setMessage("No s'ha pogut enviar l'avís.");
      }
    } catch {
      setMessage("No s'ha pogut enviar l'avís.");
    }
    setSosSending(false);
  }

  function openDevice(deviceId: string) {
    setSelectedDeviceId(deviceId);
    setView('device');
  }

  function goHome() {
    setView('home');
    setSelectedDeviceId(null);
  }

  const TextSizeControl = (
    <div className="flex justify-end gap-2 mb-4">
      <button
        onClick={decreaseTextSize}
        aria-label="Redueix la mida del text"
        className="w-12 h-12 rounded-xl bg-white shadow font-bold text-lg text-[#1B211D] border border-gray-200"
      >
        A−
      </button>
      <button
        onClick={resetTextSize}
        aria-label="Mida normal del text"
        className="w-12 h-12 rounded-xl bg-white shadow font-bold text-lg text-[#1B211D] border border-gray-200"
      >
        A
      </button>
      <button
        onClick={increaseTextSize}
        aria-label="Augmenta la mida del text"
        className="w-12 h-12 rounded-xl bg-white shadow font-bold text-lg text-[#1B211D] border border-gray-200"
      >
        A+
      </button>
    </div>
  );

  if (loading) {
    return <p className="p-6 text-xl text-gray-500">Carregant...</p>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-bold text-[#1B211D] mb-1">Berta</h1>
          <p className="text-lg text-gray-500 mb-4">Inicia sessió o crea un compte</p>
          <input
            type="email"
            placeholder="Correu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-2 p-4 text-lg rounded-lg border border-gray-300"
          />
          <input
            type="password"
            placeholder="Contrasenya"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 p-4 text-lg rounded-lg border border-gray-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSignIn}
              className="flex-1 bg-[#20544A] text-white rounded-lg py-4 text-lg font-semibold"
            >
              Inicia sessió
            </button>
            <button
              onClick={handleSignUp}
              className="flex-1 bg-gray-100 text-[#1B211D] rounded-lg py-4 text-lg font-semibold"
            >
              Crea compte
            </button>
          </div>
          {message && <p className="text-lg text-red-600 mt-3">{message}</p>}
        </div>
      </main>
    );
  }

  if (householdLoading) {
    return <p className="p-6 text-xl text-gray-500">Carregant la teva llar...</p>;
  }

  if (!household) {
    return (
      <main className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold text-[#1B211D] mb-4">Encara no tens cap llar</h1>

          <h2 className="text-lg font-semibold mb-2">Crea una de nova</h2>
          <input
            type="text"
            placeholder="Nom de la llar"
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
            className="w-full mb-2 p-4 text-lg rounded-lg border border-gray-300"
          />
          <button
            onClick={handleCreateHousehold}
            className="w-full bg-[#20544A] text-white rounded-lg py-4 text-lg font-semibold mb-6"
          >
            Crea la meva llar
          </button>

          <h2 className="text-lg font-semibold mb-2">O uneix-te amb un codi</h2>
          <input
            type="text"
            placeholder="Codi de 6 caràcters"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-full mb-2 p-4 text-lg rounded-lg border border-gray-300"
          />
          <button
            onClick={handleJoinHousehold}
            className="w-full bg-gray-100 text-[#1B211D] rounded-lg py-4 text-lg font-semibold"
          >
            Uneix-me
          </button>

          {message && <p className="text-lg text-red-600 mt-3">{message}</p>}

          <button onClick={handleSignOut} className="text-base text-gray-400 underline mt-6">
            Tanca sessió
          </button>
        </div>
      </main>
    );
  }

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  return (
    <main className="min-h-screen bg-[#F5F2EC] p-6">
      <div className="max-w-md mx-auto">
        {TextSizeControl}

        {view === 'home' && (
          <>
            <h1 className="text-3xl font-bold text-[#1B211D] text-center mb-1">🏠 LA MEVA CASA</h1>
            <p className="text-xl text-gray-600 text-center mb-6">Què vols controlar?</p>

            {message && (
              <p className="text-lg text-center text-[#20544A] font-semibold mb-4">{message}</p>
            )}

            <div className="space-y-4 mb-6">
              {devices.length === 0 && (
                <p className="text-gray-500 text-lg text-center">Encara no hi ha cap dispositiu.</p>
              )}

              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => openDevice(d.id)}
                  className="w-full flex items-center gap-4 bg-white rounded-2xl shadow p-5 text-left border border-gray-100"
                >
                  <span className="text-4xl">{deviceIcon(d)}</span>
                  <div>
                    <p className="text-xl font-bold text-[#1B211D] capitalize">{d.name}</p>
                    <p className="text-base text-gray-500 capitalize">{d.room}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleSOS}
              disabled={sosSending}
              className="w-full bg-red-600 text-white rounded-2xl py-7 text-2xl font-extrabold mb-4 shadow-lg disabled:opacity-60"
            >
              {sosSending ? 'ENVIANT...' : '🆘 SOS - AVISA LA FAMÍLIA'}
            </button>

            <div className="text-center">
              <button onClick={() => setView('settings')} className="text-base text-gray-500 underline">
                ⚙️ Configuració
              </button>
            </div>
          </>
        )}

        {view === 'device' && selectedDevice && (
          <>
            <button onClick={goHome} className="text-lg text-[#20544A] font-semibold mb-6">
              ← Tornar a l&apos;inici
            </button>

            <h1 className="text-3xl font-bold text-[#1B211D] text-center mb-6">
              {deviceIcon(selectedDevice)} {selectedDevice.name.toUpperCase()}
            </h1>

            {message && (
              <p className="text-lg text-center text-[#20544A] font-semibold mb-4">{message}</p>
            )}

            {selectedDevice.type === 'blind' && (() => {
              const position = selectedDevice.state?.position;
              const isOpen = position === 100;
              const isClosed = position === 0;
              return (
                <div className="bg-white rounded-2xl shadow p-6">
                  <div className="text-center mb-6">
                    <span
                      className={
                        'inline-block px-5 py-3 rounded-full text-xl font-bold ' +
                        (isOpen
                          ? 'bg-green-100 text-green-800'
                          : isClosed
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-gray-100 text-gray-500')
                      }
                    >
                      {isOpen ? '🟢 OBERTA' : isClosed ? '⚪ TANCADA' : 'ESTAT DESCONEGUT'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 mb-6">
                    <button
                      onClick={() => blindAction(selectedDevice, 'open')}
                      className="w-full bg-[#20544A] text-white rounded-2xl py-6 text-2xl font-bold"
                    >
                      ⬆️ PUJAR
                    </button>
                    <button
                      onClick={() => blindAction(selectedDevice, 'close')}
                      className="w-full bg-[#A8792A] text-white rounded-2xl py-6 text-2xl font-bold"
                    >
                      ⬇️ BAIXAR
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-lg text-gray-600 block mb-2">🕐 Obertura automàtica</label>
                      <div className="flex gap-2">
                        <input
                          type="time"
                          defaultValue={selectedDevice.schedule?.open_at ?? ''}
                          onBlur={(e) => setBlindTime(selectedDevice, 'open_at', e.target.value)}
                          className="flex-1 min-w-0 p-4 rounded-xl border border-gray-300 text-xl text-center"
                        />
                        {selectedDevice.schedule?.open_at && (
                          <button
                            onClick={() => toggleBlindSchedule(selectedDevice, 'open')}
                            className={
                              'shrink-0 px-4 rounded-xl text-base font-bold whitespace-nowrap ' +
                              ((selectedDevice.schedule?.open_on ?? true)
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-600')
                            }
                          >
                            {(selectedDevice.schedule?.open_on ?? true) ? '🟢 Activat' : '⚪ Desactivat'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-lg text-gray-600 block mb-2">🕐 Tancament automàtic</label>
                      <div className="flex gap-2">
                        <input
                          type="time"
                          defaultValue={selectedDevice.schedule?.close_at ?? ''}
                          onBlur={(e) => setBlindTime(selectedDevice, 'close_at', e.target.value)}
                          className="flex-1 min-w-0 p-4 rounded-xl border border-gray-300 text-xl text-center"
                        />
                        {selectedDevice.schedule?.close_at && (
                          <button
                            onClick={() => toggleBlindSchedule(selectedDevice, 'close')}
                            className={
                              'shrink-0 px-4 rounded-xl text-base font-bold whitespace-nowrap ' +
                              ((selectedDevice.schedule?.close_on ?? true)
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-600')
                            }
                          >
                            {(selectedDevice.schedule?.close_on ?? true) ? '🟢 Activat' : '⚪ Desactivat'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {(selectedDevice.type === 'light' ||
              selectedDevice.type === 'fan' ||
              selectedDevice.type === 'plug') &&
              (() => {
                const isOn = Boolean(selectedDevice.state?.power);
                return (
                  <div className="bg-white rounded-2xl shadow p-6">
                    <div className="text-center mb-6">
                      <span
                        className={
                          'inline-block px-5 py-3 rounded-full text-xl font-bold ' +
                          (isOn ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')
                        }
                      >
                        {isOn ? '🟢 ENCÈS' : '⚪ APAGAT'}
                      </span>
                    </div>

                    {selectedDevice.type === 'fan' && selectedDevice.state?.temperature !== undefined && (
                      <p className="text-center text-4xl font-bold text-[#1B211D] mb-6">
                        {selectedDevice.state.temperature.toFixed(1)} °C
                      </p>
                    )}

                    <button
                      onClick={() => togglePower(selectedDevice, !isOn)}
                      className={
                        'w-full rounded-2xl py-7 text-2xl font-bold mb-6 ' +
                        (isOn ? 'bg-gray-200 text-[#1B211D]' : 'bg-[#20544A] text-white')
                      }
                    >
                      {isOn ? 'APAGAR' : 'ENCENDRE'}
                    </button>

                    {(selectedDevice.type === 'light' || selectedDevice.type === 'fan') && (
                      <div className="flex rounded-xl overflow-hidden border-2 border-gray-200">
                        <button
                          onClick={() => setMode(selectedDevice, 'auto')}
                          className={
                            'flex-1 py-5 text-xl font-bold ' +
                            (selectedDevice.mode === 'auto'
                              ? 'bg-[#20544A] text-white'
                              : 'bg-white text-gray-500')
                          }
                        >
                          AUTOMÀTIC
                        </button>
                        <button
                          onClick={() => setMode(selectedDevice, 'manual')}
                          className={
                            'flex-1 py-5 text-xl font-bold ' +
                            (selectedDevice.mode === 'manual'
                              ? 'bg-[#A8792A] text-white'
                              : 'bg-white text-gray-500')
                          }
                        >
                          MANUAL
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

            {selectedDevice.type === 'buzzer' && (
              <div className="bg-white rounded-2xl shadow p-6 text-center">
                {selectedDevice.state?.alarm ? (
                  <>
                    <p className="text-2xl font-extrabold text-red-700 mb-2">🚨 AVÍS</p>
                    <p className="text-xl font-bold text-red-700 mb-6">🔴 S&apos;HA DETECTAT FUM</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-green-700 mb-2">🟢 TOT CORRECTE</p>
                    <p className="text-lg text-gray-600 mb-6">No s&apos;ha detectat fum.</p>
                  </>
                )}
              </div>
            )}

            {selectedDevice.type === 'sensor' && (
              <div className="bg-white rounded-2xl shadow p-6 text-center">
                <p className="text-xl text-gray-600">Només lectura.</p>
              </div>
            )}
          </>
        )}

        {view === 'device' && !selectedDevice && (
          <>
            <button onClick={goHome} className="text-lg text-[#20544A] font-semibold mb-6">
              ← Tornar a l&apos;inici
            </button>
            <p className="text-lg text-gray-500 text-center">Aquest dispositiu ja no existeix.</p>
          </>
        )}

        {view === 'settings' && (
          <>
            <button onClick={goHome} className="text-lg text-[#20544A] font-semibold mb-6">
              ← Tornar a l&apos;inici
            </button>

            <h1 className="text-2xl font-bold text-[#1B211D] mb-6">⚙️ Configuració</h1>

            <div className="bg-white rounded-2xl shadow p-4 mb-6">
              <p className="text-base text-gray-600 mb-1">{household.name}</p>
              <p className="text-sm text-gray-500">
                Codi per convidar familiars: <strong className="text-[#20544A]">{household.invite_code}</strong>
              </p>
            </div>

            {message && (
              <p className="text-base text-center text-[#20544A] font-semibold mb-4">{message}</p>
            )}

            <div className="bg-white rounded-2xl shadow p-4 mb-6">
              <h2 className="font-semibold text-[#1B211D] mb-3 text-lg">Afegeix un dispositiu</h2>
              <input
                type="text"
                placeholder="Nom (p. ex. Ventilador del menjador)"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full mb-2 p-3 rounded-lg border border-gray-300"
              />
              <input
                type="text"
                placeholder="Habitació (p. ex. Menjador)"
                value={newDeviceRoom}
                onChange={(e) => setNewDeviceRoom(e.target.value)}
                className="w-full mb-2 p-3 rounded-lg border border-gray-300"
              />
              <select
                value={newDeviceType}
                onChange={(e) => setNewDeviceType(e.target.value)}
                className="w-full mb-3 p-3 rounded-lg border border-gray-300"
              >
                <option value="blind">Persiana</option>
                <option value="light">Llum</option>
                <option value="fan">Ventilador</option>
                <option value="buzzer">Detector de fum</option>
                <option value="plug">Endoll</option>
                <option value="sensor">Sensor</option>
              </select>
              <button
                onClick={handleAddDevice}
                className="w-full bg-[#20544A] text-white rounded-lg py-3 font-semibold"
              >
                Afegeix
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow p-4 mb-6">
              <h2 className="font-semibold text-[#1B211D] mb-3 text-lg">Contactes d&apos;emergència</h2>
              <div className="space-y-2 mb-3">
                {contacts.length === 0 && (
                  <p className="text-gray-500 text-sm">Cap contacte encara.</p>
                )}
                {contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                    <div>
                      <p className="text-sm font-semibold text-[#1B211D]">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteContact(c.id)}
                      className="text-xs text-red-600 underline"
                    >
                      Esborra
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="text"
                placeholder="Nom del familiar"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="w-full mb-2 p-3 rounded-lg border border-gray-300"
              />
              <input
                type="email"
                placeholder="Correu del familiar"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                className="w-full mb-3 p-3 rounded-lg border border-gray-300"
              />
              <button
                onClick={handleAddContact}
                className="w-full bg-gray-100 text-[#1B211D] rounded-lg py-3 font-semibold"
              >
                Afegeix contacte
              </button>
            </div>

            <button onClick={handleSignOut} className="text-base text-gray-400 underline">
              Tanca sessió
            </button>
          </>
        )}
      </div>
    </main>
  );
}