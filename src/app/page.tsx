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
};

type Device = {
  id: string;
  name: string;
  room: string;
  type: string;
  capabilities: string[];
  mode: 'auto' | 'manual';
  schedule: { close_at?: string } | null;
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
  buzzer: "Buzzer d'alarma",
  plug: 'Endoll',
  sensor: 'Sensor',
};

const CAPABILITIES: Record<string, string[]> = {
  blind: ['position', 'stop'],
  light: ['power'],
  fan: ['power'],
  buzzer: ['test'],
  plug: ['power'],
  sensor: ['reading'],
};

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
    else setMessage('Compte creat! Ja pots iniciar sessio.');
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

  async function testBuzzer(device: Device) {
    await sendCommand(device.id, { capability: 'test' });
  }

  async function setBlindSchedule(device: Device, closeAt: string) {
    if (!household) return;
    const { error } = await supabase
      .from('devices')
      .update({ schedule: closeAt ? { close_at: closeAt } : null })
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
      setMessage('Afegeix algun contacte abans denviar un SOS.');
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
        setMessage('Avis enviat als familiars.');
      } else {
        setMessage('No sha pogut enviar lavis.');
      }
    } catch {
      setMessage('No sha pogut enviar lavis.');
    }
    setSosSending(false);
  }

  if (loading) {
    return <p className="p-6 text-gray-500">Carregant...</p>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold text-[#1B211D] mb-1">Berta</h1>
          <p className="text-sm text-gray-500 mb-4">Inicia sessio o crea un compte</p>
          <input
            type="email"
            placeholder="Correu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-2 p-3 rounded-lg border border-gray-300"
          />
          <input
            type="password"
            placeholder="Contrasenya"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 p-3 rounded-lg border border-gray-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSignIn}
              className="flex-1 bg-[#20544A] text-white rounded-lg py-3 font-semibold"
            >
              Inicia sessio
            </button>
            <button
              onClick={handleSignUp}
              className="flex-1 bg-gray-100 text-[#1B211D] rounded-lg py-3 font-semibold"
            >
              Crea compte
            </button>
          </div>
          {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
        </div>
      </main>
    );
  }

  if (householdLoading) {
    return <p className="p-6 text-gray-500">Carregant la teva llar...</p>;
  }

  if (!household) {
    return (
      <main className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-bold text-[#1B211D] mb-4">Encara no tens cap llar</h1>

          <h2 className="font-semibold mb-2">Crea una de nova</h2>
          <input
            type="text"
            placeholder="Nom de la llar"
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
            className="w-full mb-2 p-3 rounded-lg border border-gray-300"
          />
          <button
            onClick={handleCreateHousehold}
            className="w-full bg-[#20544A] text-white rounded-lg py-3 font-semibold mb-6"
          >
            Crea la meva llar
          </button>

          <h2 className="font-semibold mb-2">O uneix-te amb un codi</h2>
          <input
            type="text"
            placeholder="Codi de 6 caracters"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-full mb-2 p-3 rounded-lg border border-gray-300"
          />
          <button
            onClick={handleJoinHousehold}
            className="w-full bg-gray-100 text-[#1B211D] rounded-lg py-3 font-semibold"
          >
            Uneix-me
          </button>

          {message && <p className="text-sm text-red-600 mt-3">{message}</p>}

          <button onClick={handleSignOut} className="text-sm text-gray-400 underline mt-6">
            Tanca sessio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F2EC] p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-[#1B211D] mb-1">{household.name}</h1>
        <p className="text-sm text-gray-600 mb-6">
          Codi per convidar familiars: <strong className="text-[#20544A]">{household.invite_code}</strong>
        </p>

        <button
          onClick={handleSOS}
          disabled={sosSending}
          className="w-full bg-red-600 text-white rounded-2xl py-6 text-xl font-extrabold mb-6 shadow-lg disabled:opacity-60"
        >
          {sosSending ? 'ENVIANT...' : 'SOS - AVISA LA FAMILIA'}
        </button>

        {message && <p className="text-sm text-center text-[#20544A] font-semibold mb-4">{message}</p>}

        <div className="space-y-3 mb-6">
          {devices.length === 0 && (
            <p className="text-gray-500 text-sm">Encara no hi ha cap dispositiu.</p>
          )}

          {devices.map((d) => {
            const isOn = Boolean(d.state?.power);
            const position = d.state?.position;
            const isOpen = position === 100;
            const isClosed = position === 0;

            return (
              <div key={d.id} className="bg-white rounded-2xl shadow p-4">
                <p className="font-semibold text-[#1B211D]">{d.name}</p>
                <p className="text-sm text-gray-500 mb-3">
                  {d.room} - {TYPE_LABELS[d.type] ?? d.type}
                </p>

                {d.type === 'blind' && (
                  <div>
                    <div className="mb-3">
                      <span
                        className={
                          'inline-block px-3 py-1 rounded-full text-sm font-bold ' +
                          (isOpen
                            ? 'bg-[#20544A] text-white'
                            : isClosed
                            ? 'bg-[#A8792A] text-white'
                            : 'bg-gray-100 text-gray-500')
                        }
                      >
                        {isOpen ? 'OBERTA' : isClosed ? 'TANCADA' : 'ESTAT DESCONEGUT'}
                      </span>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => blindAction(d, 'open')}
                        className={
                          'flex-1 rounded-lg py-3 text-sm font-bold ' +
                          (isOpen ? 'bg-[#20544A] text-white' : 'bg-[#E7F1EC] text-[#20544A]')
                        }
                      >
                        Obrir
                      </button>
                      <button
                        onClick={() => blindAction(d, 'stop')}
                        className="flex-1 bg-gray-100 text-[#1B211D] rounded-lg py-3 text-sm font-bold"
                      >
                        Aturar
                      </button>
                      <button
                        onClick={() => blindAction(d, 'close')}
                        className={
                          'flex-1 rounded-lg py-3 text-sm font-bold ' +
                          (isClosed ? 'bg-[#A8792A] text-white' : 'bg-[#F4E9DD] text-[#A8792A]')
                        }
                      >
                        Tancar
                      </button>
                    </div>
                    <label className="text-xs text-gray-500">Tanca automaticament a les:</label>
                    <input
                      type="time"
                      defaultValue={d.schedule?.close_at ?? ''}
                      onBlur={(e) => setBlindSchedule(d, e.target.value)}
                      className="w-full p-2 rounded-lg border border-gray-300 mt-1"
                    />
                  </div>
                )}

                {(d.type === 'light' || d.type === 'fan' || d.type === 'plug') && (
                  <div>
                    <button
                      onClick={() => togglePower(d, !isOn)}
                      className={
                        'w-full rounded-xl py-4 text-base font-bold mb-3 ' +
                        (isOn
                          ? 'bg-[#20544A] text-white'
                          : 'bg-gray-100 text-gray-500 border-2 border-gray-200')
                      }
                    >
                      {isOn ? 'ENCES - Toca per apagar' : 'APAGAT - Toca per encendre'}
                    </button>

                    {d.type === 'fan' && d.state?.temperature !== undefined && (
                      <p className="text-sm text-gray-500 mb-3 text-center">
                        Temperatura actual: <strong className="text-[#1B211D]">{d.state.temperature.toFixed(1)} °C</strong>
                      </p>
                    )}

                    {(d.type === 'light' || d.type === 'fan') && (
                      <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                          onClick={() => setMode(d, 'auto')}
                          className={
                            'flex-1 py-3 text-sm font-bold ' +
                            (d.mode === 'auto'
                              ? 'bg-[#20544A] text-white'
                              : 'bg-white text-gray-500')
                          }
                        >
                          Automatic
                        </button>
                        <button
                          onClick={() => setMode(d, 'manual')}
                          className={
                            'flex-1 py-3 text-sm font-bold ' +
                            (d.mode === 'manual'
                              ? 'bg-[#A8792A] text-white'
                              : 'bg-white text-gray-500')
                          }
                        >
                          Manual
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {d.type === 'buzzer' && (
                  <div>
                    <div className="mb-2">
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-[#E7F1EC] text-[#20544A]">
                        AUTOMATIC - Sempre actiu
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      Es activa sol quan detecta fum o gas.
                    </p>
                    <button
                      onClick={() => testBuzzer(d)}
                      className="w-full bg-gray-100 text-[#1B211D] rounded-lg py-3 text-sm font-bold"
                    >
                      Prova
                    </button>
                  </div>
                )}

                {d.type === 'sensor' && (
                  <p className="text-sm text-gray-500">Nomes lectura.</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow p-4 mb-6">
          <h2 className="font-semibold text-[#1B211D] mb-3">Afegeix un dispositiu</h2>
          <input
            type="text"
            placeholder="Nom (p. ex. Ventilador del menjador)"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            className="w-full mb-2 p-3 rounded-lg border border-gray-300"
          />
          <input
            type="text"
            placeholder="Habitacio (p. ex. Menjador)"
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
            <option value="buzzer">Buzzer d&apos;alarma</option>
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
          <h2 className="font-semibold text-[#1B211D] mb-3">Contactes d&apos;emergencia</h2>
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

        <button onClick={handleSignOut} className="text-sm text-gray-400 underline">
          Tanca sessio
        </button>
      </div>
    </main>
  );
}