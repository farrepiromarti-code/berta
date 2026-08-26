import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { householdName, triggeredByEmail, contacts } = await request.json();

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No hi ha contactes' }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Falta la clau de Resend al servidor' }, { status: 500 });
  }

  const results = await Promise.all(
    contacts.map(async (contact: { email: string; name: string }) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Berta <onboarding@resend.dev>',
          to: contact.email,
          subject: `Alerta SOS - ${householdName}`,
          html: `<p>S'ha activat el boto de SOS a <strong>${householdName}</strong>.</p><p>Activat per: ${triggeredByEmail}</p><p>Contacta amb ells el mes aviat possible.</p>`,
        }),
      });
      const body = await res.json().catch(() => null);
      return { email: contact.email, ok: res.ok, status: res.status, body };
    })
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return NextResponse.json({ error: 'Alguns correus han fallat', details: failed }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}