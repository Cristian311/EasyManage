// Ce vede recepția când rețeaua sau serverul nu răspund cum trebuie.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) => {
  const fetchMock = vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('api', () => {
  it('întoarce răspunsul serverului', async () => {
    reply({ rooms: [1, 2] });
    expect(await api('/api/state')).toEqual({ rooms: [1, 2] });
  });

  it('un GET nu trimite corp și nici antet de tip', async () => {
    const f = reply({});
    await api('/api/state');
    expect(f).toHaveBeenCalledWith('/api/state', { method: 'GET', headers: undefined, body: undefined, cache: 'no-store' });
  });

  it('un POST trimite corpul ca JSON', async () => {
    const f = reply({ ok: 1 });
    await api('/api/reservations', 'POST', { pax: 2 });
    expect(f).toHaveBeenCalledWith('/api/reservations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"pax":2}', cache: 'no-store',
    });
  });

  it('aruncă mesajul serverului, așa cum e scris (în română)', async () => {
    reply({ error: 'Camera 101 este ocupată de Ana Pop.' }, 409);
    await expect(api('/api/reservations', 'POST', {})).rejects.toThrow('Camera 101 este ocupată de Ana Pop.');
  });

  it('dacă serverul nu spune nimic, arată măcar codul', async () => {
    reply('<html>502</html>', 502);
    await expect(api('/api/state')).rejects.toThrow('Eroare 502');
  });

  it('când nu e legătură, spune asta în loc să arate eroarea tehnică', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api('/api/state')).rejects.toThrow(/Nu am legătură cu serverul/);
  });
});
