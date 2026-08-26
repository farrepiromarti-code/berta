import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { householdName, triggeredByEmail, contacts } = await request.json();

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No hi ha contactes' }, { status: 400 });
  }

  await Promise.all(
    contacts.map((contact: { email: string; name: string }) =>
      fetch('https://api.resend.com/emails', {
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
      })
    )
  );

  return NextResponse.json({ ok: true });
}
