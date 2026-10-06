# Mjøsbil booking prototype

Clickable prototype of a new booking journey, homepage, "Min bil" (My car) and shop-to-workshop link for Mjøsbil. Norwegian by default, English toggle in the header. Mobile-first. Visual design follows the Mjøsbil Design System v0.1 (Claude Design): Schibsted Grotesk / Plus Jakarta Sans / Barlow Semi Condensed, Natt/Mjøs/Fjord palette, Lucide icons, real Mjøsbil logo and photos from mjosbil.no.

## View it

- Live (once GitHub Pages is enabled): https://salesteam-create.github.io/mjosbil-prototype/ (served from `/docs`).
- Or open `dist/mjosbil-prototype.html` in any browser (single self-contained file, no install).
- Or open `index.html` while editing the files in `assets/`.
- After changing anything in `assets/`, run `python3 build.py` to refresh the single-file version.

## Demo path (about 2 minutes)

1. Homepage: tap the plate **EL 12345** (VW ID.4, electric).
2. "Hva trenger bilen?": the **Service** tab is open. The EV service with brake service is recommended for this car. Add wipers.
3. Switch to the **Dekk og hjulskift** tab: wheel size is already known (19"), price adjusts. Pick tyre hotel.
4. Switch to **Noe er galt** > "Bilen trekker skjevt": diagnosis is added and wheel alignment is suggested.
5. **Sted og tid**: only workshops that can do every job are shown, with first free time. Pick day, time and handover.
6. **Dine detaljer**: "Fyll ut med Vipps" fills the form.
7. **Bekreft** > confirmation with booking number and what to bring.

8. **Se bestillingen i Min bil**: the booking shows up as "Kommende besøk", next to EU deadline, service status, mechanic recommendations, tyre hotel (shelf, tread depth, "time for winter wheels") and service history with receipts.

Other paths worth showing:
- **Min bil from scratch**: header "Min bil" > log in with Vipps/BankID (simulated). Switch between EL 12345 and DN 54321. "Legg til" on a mechanic recommendation starts a booking with that job already added.
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

Prices marked "eksempelpris" are illustrative. Other prices come from Mjøsbil's live VerkstedPlus and mjosbil.no pages (October 2026). Vehicle data, availability, booking numbers and everything in Min bil are mocked. Photos and logo are Mjøsbil's own, taken from mjosbil.no (`assets/img/`).
