# Mjøsbil booking prototype

Clickable prototype of a new booking journey, homepage and shop-to-workshop link for Mjøsbil. Norwegian by default, English toggle in the header. Mobile-first.

## View it

- Open `dist/mjosbil-prototype.html` in any browser (single self-contained file, no install).
- Or open `index.html` while editing the files in `assets/`.
- After changing anything in `assets/`, run `python3 build.py` to refresh the single-file version.

## Demo path (about 2 minutes)

1. Homepage: tap the plate **EL 12345** (VW ID.4, electric).
2. "Hva trenger bilen?": pick **Service**. The EV service with brake service is recommended for this car. Add wipers.
3. Back, pick **Dekk og hjulskift**: wheel size is already known (19"), price adjusts. Pick tyre hotel.
4. Back, pick **Noe er galt** > "Bilen trekker skjevt": diagnosis is added and wheel alignment is suggested.
5. **Sted og tid**: only workshops that can do every job are shown, with first free time. Pick day, time and handover.
6. **Dine detaljer**: "Fyll ut med Vipps" fills the form.
7. **Bekreft** > confirmation with booking number and what to bring.

Other paths worth showing:
- **DN 54321** (Škoda diesel): EU-kontroll deadline is close, so the journey flags it.
- **BR 11223** (motorhome, 3 650 kg): heavy EU-kontroll is offered and Fåvang/Otta are filtered out.
- **Shop**: open Nokian Hakkapeliitta 10, check fit with DN 54321, choose "Monter hos oss" and go straight to picking a fitting time.
- Homepage EU-kontroll checker: enter a plate to see the deadline and book.

## Design decisions (from the audit in `../research`)

- One booking journey instead of three systems (request form, VerkstedPlus, Dekkshop).
- Car first: plate lookup drives which services, prices and locations are shown.
- 5 customer goals instead of 22 checkboxes; max 3 relevant add-ons per service.
- Location is asked once, filtered by capability, nearest first. Gjøvik and Gjøvik Vulk shown as one place.
- Honest status: each service is labelled "Bekreftet time" (live calendar) or "Vi bekrefter tiden" (request), matching what Mjøsbil can actually confirm today.

## Data notes

Prices marked "eksempelpris" are illustrative. Other prices come from Mjøsbil's live VerkstedPlus and mjosbil.no pages (October 2026). Vehicle data, availability and booking numbers are mocked.
