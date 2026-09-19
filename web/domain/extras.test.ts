// CSV, import, mesajul de confirmare și registrul turiștilor: regulile, fără bază de date.
import { describe, expect, it } from 'vitest';
import { csvField, parseCsv, toCsv } from './csv';
import { tinyState } from './fixtures';
import { mapHeaders, planImport, readDate, readNumber, sampleCsv } from './import';
import { DEFAULT_TEMPLATE, fillTemplate, mailLink, messageVars, waLink, waPhone } from './message';
import { idDoc, missingForForm, registerRows } from './register';

describe('CSV pentru Excel', () => {
  it('desparte cu „;”, pune virgulă la zecimale și ghilimele unde trebuie', () => {
    expect(csvField(1250.5)).toBe('1250,5');
    expect(csvField('Popescu; Ion')).toBe('"Popescu; Ion"');
    expect(csvField('a zis "da"')).toBe('"a zis ""da"""');
    expect(csvField('două\nrânduri')).toBe('"două\nrânduri"');
    expect(csvField(null)).toBe(''); expect(csvField(true)).toBe('da');
  });
  it('un text care ar fi luat drept formulă e ținut text', () => {
    expect(csvField('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvField('+40722')).toBe("'+40722");
    expect(csvField('-5')).toBe("'-5");
    expect(csvField(-5)).toBe('-5');                  // numerele adevărate rămân numere
  });
  it('scrie antetul și rândurile, cu sfârșit de rând Windows', () => {
    expect(toCsv([{ n: 'Ana', t: 100 }], [['Nume', r => r.n], ['Total', r => r.t]])).toBe('Nume;Total\r\nAna;100\r\n');
  });
  it('ce scrie se poate citi la loc, cu tot cu ghilimele și rânduri noi', () => {
    const rows = [{ a: 'Popescu; Ion', b: 'zice "bună"\nși pleacă' }];
    expect(parseCsv(toCsv(rows, [['A', r => r.a], ['B', r => r.b]]))).toEqual([['A', 'B'], ['Popescu; Ion', 'zice "bună"\nși pleacă']]);
  });
  it('ghicește despărțitorul și sare peste rândurile goale și peste semnul de la început', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a;b\n"x;y";2')).toEqual([['a', 'b'], ['x;y', '2']]);
  });
});

describe('importul de rezervări', () => {
  const s = tinyState();
  const room = s.rooms.find(r => !r.parentId && r.active)!.name;
  const plan = (body: string) => planImport(parseCsv('Oaspete;Telefon;Camera;Sosire;Plecare;Persoane;Total;Avans;Sursa\n' + body), s);

  it('citește datele și sumele cum le scriu oamenii', () => {
    expect(readDate('14.08.2026')).toBe('2026-08-14'); expect(readDate('4/8/2026')).toBe('2026-08-04');
    expect(readDate('2026-08-14')).toBe('2026-08-14'); expect(readDate('31.02.2026')).toBe(''); expect(readDate('mâine')).toBe('');
    expect(readNumber('1.250,50')).toBe(1250.5); expect(readNumber('1.250')).toBe(1250); expect(readNumber('1250.5')).toBe(1250.5);
    expect(readNumber('750 lei')).toBe(750); expect(readNumber('')).toBe(0); expect(readNumber('mult')).toBeNaN();
  });
  it('recunoaște coloanele cu sau fără diacritice, în orice ordine', () => {
    expect(mapHeaders(['Plecare', 'CAMERĂ', 'Nume și prenume', 'Check-in'])).toMatchObject({ checkOut: 0, rooms: 1, guest: 2, checkIn: 3 });
  });
  it('spune ce coloane lipsesc', () => {
    expect(planImport(parseCsv('Nume;Total\nAna;100'), s).problem).toMatch(/Lipsesc coloanele: Camera, Sosire, Plecare/);
    expect(planImport([], s).problem).toMatch(/nu are rânduri/);
  });
  it('un rând bun intră, cu oaspetele marcat ca nou', () => {
    const { rows } = plan(`Gigel Nou;0722 111 222;${room};01.03.2031;04.03.2031;2;750;200;Booking`);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0]).toMatchObject({ checkIn: '2031-03-01', checkOut: '2031-03-04', pax: 2, total: 750, advance: 200, source: 'booking', guestId: null, line: 2 });
  });
  it('un oaspete care există deja e recunoscut după nume', () => {
    const g = s.guests[0];
    expect(plan(`${g.firstName.toUpperCase()}  ${g.lastName};;${room};01.03.2031;02.03.2031;1;100;;`).rows[0].guestId).toBe(g.id);
  });
  it('refuză camera necunoscută, datele greșite, avansul prea mare și sursa inventată', () => {
    const e = (line: string) => plan(line).rows[0].errors.join(' | ');
    expect(e('Ana;;999X;01.03.2031;02.03.2031;1;100;;')).toMatch(/camera „999X” nu există/);
    expect(e(`Ana;;${room};05.03.2031;02.03.2031;1;100;;`)).toMatch(/plecarea trebuie să fie după sosire/);
    expect(e(`Ana;;${room};ieri;02.03.2031;1;100;;`)).toMatch(/nu e o dată/);
    expect(e(`Ana;;${room};01.03.2031;02.03.2031;1;100;500;`)).toMatch(/avansul e mai mare/);
    expect(e(`Ana;;${room};01.03.2031;02.03.2031;1;100;;Trivago`)).toMatch(/sursa „Trivago” nu e cunoscută/);
    expect(e(`;;${room};01.03.2031;02.03.2031;1;100;;`)).toMatch(/lipsește numele/);
  });
  it('vede suprapunerea și între rândurile aceluiași fișier, dar lasă plecarea și sosirea în aceeași zi', () => {
    const { rows } = plan([`Ana Unu;;${room};01.03.2031;04.03.2031;2;300;;`, `Ion Doi;;${room};03.03.2031;05.03.2031;2;200;;`, `Dan Trei;;${room};04.03.2031;06.03.2031;2;200;;`].join('\n'));
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors.join()).toMatch(/camera e ocupată de Ana Unu/);
    expect(rows[2].errors).toEqual([]);
  });
  it('vede suprapunerea cu ce e deja în program', () => {
    const r = s.reservations.find(x => x.status !== 'cancelled')!, name = s.rooms.find(x => x.id === r.roomIds[0])!.name;
    const d = (iso: string) => iso.split('-').reverse().join('.');
    expect(plan(`Alt Om;;${name};${d(r.checkIn)};${d(r.checkOut)};1;100;;`).rows[0].errors.join()).toMatch(/camera e ocupată/);
  });
  it('modelul de descărcat trece el însuși de verificare', () => {
    const { rows, problem } = planImport(parseCsv(sampleCsv(room, '2031-01-01')), s);
    expect(problem).toBeNull();
    expect(rows.map(r => r.errors)).toEqual([[], []]);
  });
});

describe('mesajul de confirmare', () => {
  const s = tinyState(), r = s.reservations.find(x => x.status !== 'cancelled')!;
  it('pune valorile rezervării în șablon', () => {
    const text = fillTemplate(DEFAULT_TEMPLATE, messageVars(s, r, 'Vila Test'));
    expect(text).toContain('Vila Test');
    expect(text).not.toMatch(/\{[a-z]+\}/);             // nu rămâne niciun loc necompletat
    expect(text).toMatch(/\d+ (noapte|nopți)/);
  });
  it('fără numele firmei, semnează cu numele proprietății', () => {
    expect(messageVars(s, r, '  ').pensiune).toBe(s.properties.find(p => p.id === s.rooms.find(x => x.id === r.roomIds[0])!.propertyId)!.name);
  });
  it('un loc scris greșit rămâne la vedere, nu dispare', () => expect(fillTemplate('Bună, {prenumee}!', { prenume: 'Ana' })).toBe('Bună, {prenumee}!'));
  it('numărul de telefon ajunge în forma cerută de WhatsApp', () => {
    expect(waPhone('0722 123 456')).toBe('40722123456');
    expect(waPhone('+40 722-123-456')).toBe('40722123456');
    expect(waPhone('0040722123456')).toBe('40722123456');
    expect(waPhone('+49 151 23456789')).toBe('4915123456789');
    expect(waPhone('nu am')).toBe(''); expect(waPhone('123')).toBe('');
  });
  it('linkurile duc textul cu diacritice și rânduri noi', () => {
    expect(waLink('0722 123 456', 'Bună ziua!\nȘtefan')).toBe('https://wa.me/40722123456?text=Bun%C4%83%20ziua!%0A%C8%98tefan');
    expect(waLink('', 'x')).toBe('');
    expect(mailLink('ana@exemplu.ro', 'Confirmare', 'Bună')).toBe('mailto:ana@exemplu.ro?subject=Confirmare&body=Bun%C4%83');
    expect(mailLink('nu-e-email', 's', 'b')).toBe('');
  });
});

describe('fișa de cazare și registrul', () => {
  const s = tinyState();
  it('scrie actul pe scurt și spune ce lipsește', () => {
    const g = { ...s.guests[0], idType: 'Carte de identitate', idSeries: 'VX', idNumber: '123456' };
    expect(idDoc(g)).toBe('CI VX 123456');
    expect(idDoc(s.guests[0])).toBe('');
    expect(missingForForm(s.guests[0])).toEqual(['actul de identitate', 'data nașterii', 'cetățenia', 'domiciliul']);
    expect(missingForForm({ ...g, birthDate: '1980-01-01', citizenship: 'română', address: 'Str. 1' })).toEqual([]);
  });
  it('registrul ia sosirile din perioadă, fără anulări, numerotate în ordinea sosirii', () => {
    const all = registerRows(s, '2000-01-01', '2100-01-01');
    expect(all.length).toBe(s.reservations.filter(r => r.status !== 'cancelled').length);
    expect(all.map(r => r.no)).toEqual(all.map((_, i) => i + 1));
    expect([...all].sort((a, b) => a.checkIn.localeCompare(b.checkIn)).map(r => r.reservationId)).toEqual(all.map(r => r.reservationId));
    const one = all[0];
    expect(registerRows(s, one.checkIn, one.checkIn).every(r => r.checkIn === one.checkIn)).toBe(true);
    expect(registerRows(s, '2100-01-01', '2000-01-01').length).toBe(all.length);   // capetele puse invers
  });
});
