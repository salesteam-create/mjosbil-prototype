// Prototype data. Prices marked `example: true` are illustrative; the rest come from
// Mjøsbil's live VerkstedPlus / mjosbil.no pages (October 2026).
window.MB_DATA = (function () {
  const L = (no, en) => ({ no, en });

  // Demo vehicles returned by the mock reg.nr lookup.
  const cars = {
    EL12345: {
      plate: 'EL 12345', make: 'Volkswagen', model: 'ID.4 Pro Performance', year: 2021,
      fuel: 'ev', weight: 2120, wheel: 19, euDue: '2027-03-31', lastService: L('14 mnd siden', '14 months ago'),
    },
    DN54321: {
      plate: 'DN 54321', make: 'Škoda', model: 'Octavia Combi 2.0 TDI', year: 2017,
      fuel: 'diesel', weight: 1940, wheel: 16, euDue: '2026-11-30', lastService: L('11 mnd siden', '11 months ago'),
    },
    BR11223: {
      plate: 'BR 11223', make: 'Fiat', model: 'Ducato Bobil', year: 2016,
      fuel: 'diesel', weight: 3650, wheel: 16, euDue: '2027-06-30', lastService: L('2 år siden', '2 years ago'),
    },
    _default: {
      make: 'Toyota', model: 'Yaris 1.5 Hybrid', year: 2019,
      fuel: 'hybrid', weight: 1565, wheel: 15, euDue: '2027-08-31', lastService: L('9 mnd siden', '9 months ago'),
    },
  };

  // Booking mode: 'live' = confirmed slot (bookable in VerkstedPlus today),
  // 'request' = workshop confirms the time afterwards.
  const services = {
    // Service and maintenance
    ev_eco:      { cat: 'service', name: L('Økonomiservice for elbil', 'EV economy service'), price: 2495, mins: 90, mode: 'request', fuel: ['ev'],
                   desc: L('For elbiler over 5 år eller uten nybilgaranti. Inkl. 1 års mobilitetsgaranti med Falck.', 'For EVs over 5 years old or out of warranty. Includes 1 year mobility guarantee with Falck.'),
                   incl: L(['Skift av kupéfilter', 'Test av 12V-batteri', 'Avlesning av feilkoder', 'Kontroll av ladekontakt og høyspentanlegg', '20 kontrollpunkter'], ['Cabin filter replacement', '12V battery test', 'Fault code readout', 'Charge port and high-voltage check', '20 inspection points']) },
    ev_eco_brk:  { cat: 'service', name: L('Økonomiservice for elbil inkl. bremseservice', 'EV economy service incl. brake service'), price: 3990, mins: 150, mode: 'request', fuel: ['ev'],
                   desc: L('Alt i økonomiservice, pluss rengjøring og smøring av bremsene. Anbefales årlig for elbil.', 'Everything in the economy service, plus brake cleaning and lubrication. Recommended yearly for EVs.'),
                   incl: L(['Alt i økonomiservice', 'Demontering, rens og smøring av bremser'], ['Everything in economy service', 'Brake strip-down, clean and lubrication']) },
    maker:       { cat: 'service', name: L('Service etter fabrikantens krav', 'Manufacturer schedule service'), price: 3490, from: true, example: true, mins: 150, mode: 'request', fuel: ['ev', 'diesel', 'petrol', 'hybrid'],
                   desc: L('Ordinær service etter bilprodusentens serviceprogram. Bevarer nybilgarantien.', 'Scheduled service following the manufacturer programme. Keeps your warranty valid.'),
                   incl: L(['Serviceprogram for din bilmodell', 'Stempel i digitalt servicehefte', 'Pris bekreftes for din bil'], ['Service programme for your model', 'Digital service book stamp', 'Price confirmed for your car']) },
    eco20:       { cat: 'service', name: L('Økonomiservice / 20-punktsjekk', 'Economy service / 20-point check'), price: 1790, mins: 60, mode: 'live', fuel: ['diesel', 'petrol', 'hybrid'],
                   desc: L('Rimelig sjekk av bilens viktigste punkter. Olje og filter kommer i tillegg.', 'Affordable check of the key points. Oil and filter extra.'),
                   incl: L(['20 kontrollpunkter', 'Bremser på bremserulle', 'Avlesning av feilkoder', 'Ett års mobilitetsgaranti'], ['20 inspection points', 'Brake roller test', 'Fault code readout', 'One year mobility guarantee']) },
    oil:         { cat: 'service', name: L('Oljeskift', 'Oil change'), price: 1390, from: true, example: true, mins: 45, mode: 'request', fuel: ['diesel', 'petrol', 'hybrid'],
                   desc: L('Skift av motorolje og oljefilter.', 'Engine oil and filter change.'),
                   incl: L(['Motorolje etter spesifikasjon', 'Nytt oljefilter'], ['Engine oil to spec', 'New oil filter']) },

    // EU inspection
    pkk:         { cat: 'eu', name: L('EU-kontroll', 'EU inspection (PKK)'), price: 1395, mins: 60, mode: 'live', maxWeight: 3500,
                   desc: L('Periodisk kjøretøykontroll for biler inntil 3 500 kg.', 'Periodic vehicle inspection for vehicles up to 3,500 kg.'),
                   incl: L(['Trafikksikkerhet: lys, sikt, hjul, belter og bremser', 'Miljø: støy og avgass', 'Godkjenning rett til Statens vegvesen'], ['Safety: lights, visibility, wheels, belts, brakes', 'Environment: noise and emissions', 'Approval sent directly to the road authority']) },
    pkk_heavy:   { cat: 'eu', name: L('EU-kontroll tyngre kjøretøy (3,5–7,5 t)', 'EU inspection heavy vehicle (3.5–7.5 t)'), price: 2495, mins: 90, mode: 'live', minWeight: 3500,
                   desc: L('For bobiler og varebiler mellom 3 500 og 7 500 kg.', 'For motorhomes and vans between 3,500 and 7,500 kg.'),
                   incl: L(['Full periodisk kontroll', 'Godkjenning rett til Statens vegvesen'], ['Full periodic inspection', 'Approval sent directly to the road authority']) },
    recheck:     { cat: 'eu', name: L('Etterkontroll', 'Re-inspection'), price: 545, mins: 30, mode: 'live',
                   desc: L('Etter underkjent EU-kontroll, når feilene er rettet.', 'After a failed inspection, once faults are fixed.'),
                   incl: L(['Kontroll av punktene som ble underkjent'], ['Check of the failed points']) },

    // Tyres
    swap:        { cat: 'tyre', name: L('Hjulskift', 'Wheel change'), price: 0, mins: 30, mode: 'live', bySize: true,
                   desc: L('Bytte av alle fire hjul. Ta med hjul, bolter og eventuell låsenøkkel.', 'Swap all four wheels. Bring wheels, bolts and any locking key.'),
                   incl: L(['Bytte av 4 hjul', 'Kontroll av dekktrykk og mønsterdybde'], ['Swap 4 wheels', 'Tyre pressure and tread check']) },
    hotel:       { cat: 'tyre', name: L('Hjulskift + dekkhotell', 'Wheel change + tyre hotel'), price: 0, mins: 30, mode: 'live', bySize: true, hotel: true,
                   desc: L('Vi skifter, vasker og lagrer hjulene dine til neste sesong. Ingen løfting hjemme.', 'We swap, wash and store your wheels until next season. No lifting at home.'),
                   incl: L(['Bytte av 4 hjul', 'Vask og lagring til neste sesong', 'Tilstandsrapport på SMS'], ['Swap 4 wheels', 'Wash and storage until next season', 'Condition report by SMS']) },

    // Something is wrong
    diag:        { cat: 'issue', name: L('Feilsøking og diagnose', 'Fault finding and diagnosis'), price: 1000, mins: 60, mode: 'request',
                   desc: L('Vi finner feilen og ringer deg med prisoverslag før vi reparerer noe.', 'We find the fault and call you with an estimate before any repair.'),
                   incl: L(['Feilsøking med diagnoseutstyr', 'Prisoverslag før reparasjon', 'Ingen arbeid uten din godkjenning'], ['Diagnostic equipment', 'Estimate before repair', 'No work without your approval']) },

    // Other
    ac:          { cat: 'other', name: L('AC-service', 'AC service'), price: 2499, mins: 60, mode: 'live',
                   desc: L('Påfylling av kjølegass og kontroll av anlegget.', 'Refrigerant refill and system check.') },
    align:       { cat: 'other', name: L('Firehjulskontroll inkl. justering', 'Wheel alignment'), price: 2490, mins: 60, mode: 'live',
                   desc: L('Kontroll og justering av hjulvinkler. Bilen går rett og dekkene varer lenger.', 'Check and adjust wheel angles. Drives straight, tyres last longer.') },
    flush:       { cat: 'other', name: L('Flushing av automatgirkasse', 'Automatic gearbox flush'), price: 2990, mins: 120, mode: 'live', fuel: ['diesel', 'petrol', 'hybrid'],
                   desc: L('Full rens av automatgirkassen. Olje og filter kommer i tillegg.', 'Full flush of the automatic gearbox. Oil and filter extra.') },
    rv:          { cat: 'other', name: L('Bobil- og caravanservice', 'Motorhome and caravan service'), price: 0, quote: true, mins: 180, mode: 'request',
                   desc: L('Service på bobil, campingvogn og tilhenger. Vi gir deg pris før vi starter.', 'Service for motorhomes, caravans and trailers. Price confirmed before we start.') },

    // Add-ons
    brakes:      { cat: 'addon', name: L('Bremseservice', 'Brake service'), price: 1490, from: true, example: true, mins: 60, mode: 'request',
                   desc: L('Rens og smøring av bremser. Viktig for elbiler som bremser lite mekanisk.', 'Brake clean and lubrication. Important for EVs that rarely use mechanical brakes.') },
    wipers:      { cat: 'addon', name: L('Nye vindusviskere', 'New wiper blades'), price: 399, from: true, example: true, mins: 10, mode: 'live',
                   desc: L('Montert mens du venter.', 'Fitted while you wait.') },
    battery:     { cat: 'addon', name: L('Batteritest', 'Battery test'), price: 290, example: true, mins: 10, mode: 'live',
                   desc: L('Unngå startproblemer i vinter.', 'Avoid start problems this winter.') },
    pre_pkk:     { cat: 'addon', name: L('Sjekk før EU-kontroll', 'Pre-inspection check'), price: 490, example: true, mins: 20, mode: 'live',
                   desc: L('Vi sjekker de vanligste feilene først, så slipper du etterkontroll.', 'We check the most common faults first, so you avoid a re-inspection.') },
  };

  const wheelPrice = (inch) => (inch <= 16 ? 570 : inch <= 18 ? 690 : 750);
  const hotelPrice = (inch) => (inch <= 16 ? 1590 : inch <= 18 ? 1790 : inch <= 20 ? 1890 : 1990);

  // Recommended add-ons per main service (a short, sensible list instead of today's rules).
  const addons = {
    ev_eco: ['brakes', 'wipers'], ev_eco_brk: ['wipers', 'battery'], maker: ['wipers', 'battery'], eco20: ['wipers', 'battery'], oil: ['wipers', 'battery'],
    pkk: ['pre_pkk', 'wipers'], pkk_heavy: ['pre_pkk'], swap: ['align', 'battery'], hotel: ['align', 'battery'],
    diag: ['battery'], ac: ['wipers'],
  };

  const symptoms = [
    { id: 'light', icon: 'alert', name: L('Varsellampe lyser', 'Warning light is on') },
    { id: 'noise', icon: 'sound', name: L('Rar lyd', 'Strange noise') },
    { id: 'brakes', icon: 'disc', name: L('Bremsene oppfører seg rart', 'Brakes feel wrong') },
    { id: 'pull', icon: 'steer', name: L('Bilen trekker skjevt', 'Car pulls to one side'), suggest: 'align' },
    { id: 'ac', icon: 'snow', name: L('Klima / AC virker ikke', 'Climate / AC not working'), suggest: 'ac' },
    { id: 'charge', icon: 'bolt', name: L('Lading eller rekkevidde', 'Charging or range'), fuel: ['ev'] },
    { id: 'start', icon: 'key', name: L('Starter dårlig', 'Hard to start'), suggest: 'battery', fuel: ['diesel', 'petrol', 'hybrid'] },
    { id: 'other', icon: 'dots', name: L('Noe annet', 'Something else') },
  ];

  // Five workshops. Gjøvik and Gjøvik Vulk (tyres) are shown as one place.
  // `no` lists services a location can't do (from the live booking form rules).
  const locations = [
    { id: 'gjovik', name: 'Mjøsbil Gjøvik', area: 'Hunndalen', addr: 'Mattisrudsvingen 9, 2827 Gjøvik', km: { gjovik: 3, lillehammer: 45, otta: 135, dokka: 50, favang: 95 }, no: [], seed: 3 },
    { id: 'lillehammer', name: 'Mjøsbil Lillehammer', area: 'Lillehammer', addr: 'Lillehammer', km: { gjovik: 45, lillehammer: 2, otta: 95, dokka: 75, favang: 50 }, no: [], seed: 7 },
    { id: 'dokka', name: 'Mjøsbil Dokka', area: 'Dokka', addr: 'Dokka', km: { gjovik: 50, lillehammer: 75, otta: 165, dokka: 1, favang: 120 }, no: [], seed: 11 },
    { id: 'favang', name: 'Mjøsbil Fåvang', area: 'Fåvang', addr: 'Fåvang', km: { gjovik: 95, lillehammer: 50, otta: 50, dokka: 120, favang: 1 }, no: ['pkk_heavy', 'flush'], seed: 5 },
    { id: 'otta', name: 'Mjøsbil Otta', area: 'Otta', addr: 'Otta', km: { gjovik: 135, lillehammer: 95, otta: 2, dokka: 165, favang: 50 }, no: ['pkk_heavy', 'rv'], seed: 9 },
  ];

  const products = {
    hakka10: {
      brand: 'Nokian', name: 'Hakkapeliitta 10', spec: '205/55 R16 94T XL', price: 1849, example: true, unit: L('per dekk', 'per tyre'),
      cat: L('Vinterdekk, piggdekk', 'Winter tyres, studded'), fitsInch: 16, fitting: 'swap', img: 'assets/img/hakka.jpg', cover: true,
      bullets: L(['Testvinner for nordiske vinterforhold', 'Piggdekk med kort bremselengde på is', 'Støynivå 67 dB'], ['Test winner for Nordic winter', 'Studded, short braking distance on ice', 'Noise level 67 dB']),
    },
    sailun: {
      brand: 'Sailun', name: 'Ice Blazer WST3', spec: '205/55 R16 94T', price: 1090, example: true, unit: L('per dekk', 'per tyre'),
      cat: L('Vinterdekk, piggdekk', 'Winter tyres, studded'), fitsInch: 16, fitting: 'swap',
      bullets: L(['Rimelig piggdekk', 'God grep på snø'], ['Budget studded tyre', 'Good grip on snow']),
    },
    oil: {
      brand: 'Castrol', name: 'GTX Ultraclean 10W-40', spec: '4 liter', price: 549, example: true, unit: L('per kanne', 'per can'),
      cat: L('Motorolje', 'Engine oil'), img: 'assets/img/oil.jpg',
      bullets: L(['Renser motoren og hindrer slam', 'For bensin og diesel'], ['Cleans the engine and prevents sludge', 'For petrol and diesel']),
    },
    heater: {
      brand: 'Airrex', name: 'AH-200i WiFi', spec: L('Infrarød dieselvarmer', 'Infrared diesel heater'), price: 21990, example: true, unit: L('stk', 'each'),
      cat: L('Verksted og garasje', 'Workshop and garage'), img: 'assets/img/airrex.jpg',
      bullets: L(['Styres fra mobilen', 'For garasje og verksted'], ['App controlled', 'For garage and workshop']),
    },
  };

  // "Min bil": what Mjøsbil already knows about the customer's cars (mock).
  const garage = {
    owner: 'Kari Nordmann',
    cars: ['EL12345', 'DN54321'],
    EL12345: {
      km: 52400, nextService: { inMonths: -2, label: L('Forfalt for 2 mnd siden', 'Overdue by 2 months'), pct: 100, warn: true },
      falck: '2026-08-12',
      hotel: { loc: 'gjovik', shelf: 'G-14', stored: L('Vinterhjul 19"', 'Winter wheels 19"'), on: L('Sommerhjul', 'Summer wheels'), tread: [6.8, 6.9, 5.1, 5.3], brand: 'Nokian Hakkapeliitta R5 EV' },
      recos: [
        { level: 'warn', title: L('Bremseskiver bak har rust', 'Rear brake discs are rusty'), text: L('Notert ved service august 2025. Anbefaler bremseservice innen vinteren.', 'Noted at the August 2025 service. Brake service recommended before winter.'), add: 'brakes' },
        { level: 'ok', title: L('12V-batteri i god stand', '12V battery in good condition'), text: L('Testet 12,6 V ved siste besøk.', 'Tested at 12.6 V at the last visit.') },
      ],
      history: [
        { date: '2025-08-12', loc: 'gjovik', items: L(['Økonomiservice for elbil'], ['EV economy service']), price: 2495, km: 48210 },
        { date: '2025-04-07', loc: 'gjovik', items: L(['Hjulskift + dekkhotell (sommer)'], ['Wheel change + tyre hotel (summer)']), price: 2640, km: 45980 },
        { date: '2025-03-10', loc: 'lillehammer', items: L(['EU-kontroll, godkjent'], ['EU inspection, passed']), price: 1395, km: 45200, doc: true },
        { date: '2024-10-28', loc: 'gjovik', items: L(['Hjulskift + dekkhotell (vinter)', 'Nye vindusviskere'], ['Wheel change + tyre hotel (winter)', 'New wiper blades']), price: 3039, km: 41750 },
      ],
    },
    DN54321: {
      km: 168300, nextService: { inMonths: 1, label: L('Om ca. 1 mnd', 'In about 1 month'), pct: 90 },
      falck: '2026-11-02',
      hotel: null,
      recos: [
        { level: 'warn', title: L('Frontrute har steinsprut', 'Windscreen has a stone chip'), text: L('Kan gi anmerkning på EU-kontrollen. Bør repareres før fristen.', 'May be flagged at the EU inspection. Should be repaired before the deadline.') },
      ],
      history: [
        { date: '2025-11-02', loc: 'dokka', items: L(['Økonomiservice / 20-punktsjekk', 'Oljeskift'], ['Economy service / 20-point check', 'Oil change']), price: 3180, km: 161900 },
        { date: '2024-11-21', loc: 'dokka', items: L(['EU-kontroll, godkjent'], ['EU inspection, passed']), price: 1495, km: 149300, doc: true },
      ],
    },
  };

  return { cars, services, addons, symptoms, locations, products, garage, wheelPrice, hotelPrice, phone: '61 13 88 88' };
})();
