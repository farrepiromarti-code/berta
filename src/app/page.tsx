'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const [household, setHousehold] = useState<any>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState('');

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

  if (loading) return <p style={{ padding: 24 }}>Carregant...</p>;

  if (!session) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 320 }}>
        <h1>Berta</h1>
        <p>Inicia sessio o crea un compte</p>
        <input
          type="email"
          placeholder="Correu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Contrasenya"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        <button onClick={handleSignIn} style={{ marginRight: 8 }}>Inicia sessio</button>
        <button onClick={handleSignUp}>Crea compte</button>
        {message && <p>{message}</p>}
      </main>
    );
  }

  if (householdLoading) return <p style={{ padding: 24 }}>Carregant la teva llar...</p>;

  if (!household) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 320 }}>
        <h1>Encara no tens cap llar</h1>

        <h2>Crea'n una de nova</h2>
        <input
          type="text"
          placeholder="Nom de la llar"
          value={newHouseholdName}
          onChange={(e) => setNewHouseholdName(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        <button onClick={handleCreateHousehold}>Crea la meva llar</button>

        <h2 style={{ marginTop: 24 }}>O uneix-te amb un codi</h2>
        <input
          type="text"
          placeholder="Codi de 6 caracters"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        <button onClick={handleJoinHousehold}>Uneix-me</button>

        {message && <p>{message}</p>}
        <button onClick={handleSignOut} style={{ marginTop: 24 }}>Tanca sessio</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>{household.name}</h1>
      <p>Codi per convidar familiars: <strong>{household.invite_code}</strong></p>
      <p>Ets: {session.user.email}</p>
      <button onClick={handleSignOut}>Tanca sessio</button>
    </main>
  );
}
