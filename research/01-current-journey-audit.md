# Mjøsbil: current booking journey audit

Audit date: 5 October 2026. Source: live mjosbil.no (page HTML, theme scripts and the booking form's own data endpoints), the five VerkstedPlus booking pages and the Dekkshop app. Screenshots of the request form were supplied by the team.

## 1. The big picture

Mjøsbil runs **three separate booking channels**, and the website mixes all of them without explaining the difference:

| Channel | What it is | Where it lives | Real booking? |
|---|---|---|---|
| A. Mjøsbil request form | 4-step pop-up form on mjosbil.no (Gravity Forms + custom theme code) | Opens from every "Bestill time" button | **No.** Customer suggests a date, staff "find the nearest free time and contact you" |
| B. VerkstedPlus | External workshop booking, one separate shop per location (vsp101, 102, 105, 107, 128) | shop.verkstedplus.no | Yes, live calendar. Used for EU-kontroll and "selected services" |
| C. Dekkshop | Norgesdekk's white-label tyre webshop, one separate subdomain per location | *.dekkshop.no | No time booking. Find tyres by reg.nr or size, order, pay at fitting |

On top of that, the main site is a WooCommerce webshop, and some services are shown with fixed prices (for example Økonomiservice for elbil 2 495 kr, with brake service 3 990 kr, gearbox flush 2 990 kr) while most have no price.

So when Judah said "if I click this I go to an external plugin, if I click that I come back to a page", this is why: the same intent (book a service) can land the customer in three different systems depending on which button they press.

## 2. Entry points into booking

| Entry point | What happens |
|---|---|
| /tjenester/ (service list) | Each service card has "Bestill time" (opens request form A) and "Les mer". Top of page also links to "Online booking" (B) |
| /bestill-eu-kontroll-pkk-online-booking/ | Titled "book directly in our calendar". Shows 5 location buttons to VerkstedPlus (B), plus a Gjøvik Vulk link, plus "see all services" |
| /tjenester/eu-kontroll/ | Sends customer to VerkstedPlus (B), one button per location |
| /dekkskift-dekkhotell/ | Links to service pages, plus 5 location buttons to Dekkshop (C) |
| /tjenester/dekkskift/ | Says: Dokka, Lillehammer, Fåvang, Otta use the online booking button; Gjøvik use "Bestill time" (A). The customer has to know which rule applies to them |
| Location pages (/avdelinger/...) | "Bestill time" opens form A with the location preselected |

## 3. The request form (channel A), step by step

1. **Choose services.** 22 services shown as a flat grid of checkboxes. Multiple selection allowed. No prices, no descriptions, no grouping (EU-kontroll, tyre, EV service, caravan and wipers all sit side by side).
2. **Choose add-ons.** Add-ons are loaded based on step 1.
3. **Choose location.** Locations that don't offer the chosen service are hidden.
4. **Choose date and contact details.** Date picker (weekdays only, earliest date depends on location), reg.nr, name, email, phone, mileage, comment, consent.

The confirmation is a request, not a booked time.

## 3b. VerkstedPlus (channel B)

Separate booking site per location (vsp101 Gjøvik, vsp102 Lillehammer, vsp105 Fåvang, vsp107 Dokka, vsp128 Otta), built on the x2net / verksted+ platform. Flow: pick services from a priced list (each with an info pop-up) > "Neste" > pick date and slot > contact details > preview > confirmation. The session resets after a few minutes of inactivity.

What it does well: real slots, prices shown upfront (incl. and excl. VAT), clear service descriptions with "write a few words about the problem" prompts.

What it shows about the business:
- **Only 12 to 16 services are live-bookable**, and the big ones are missing: no interval service, no oil change, no brake service, no repair. Those can only go through the request form.
- **The two systems disagree.** Names differ ("Periodisk kjøretøykontroll" vs "EU-kontroll", "Økonomiservice / 20-pkt. sjekk" is one item here but two on mjosbil.no). EV economy service is listed as 1 690 kr here and 2 495 kr on mjosbil.no.
- **Prices differ by location.** Firehjulskontroll 1 875 kr at Gjøvik vs 2 490 kr elsewhere. Diagnose 1 500 kr at Lillehammer vs 1 000 kr elsewhere. EU-kontroll 1 495 kr at Dokka vs 1 395 kr elsewhere.
- **Tyre hotel** is bookable at 4 locations but not Gjøvik. **Tyre change** is bookable at Gjøvik here, while the request form sends Gjøvik tyre jobs to "Gjøvik Vulk AS".
- Heavy EU-kontroll (3.5 to 7.5 t) is bookable at Gjøvik, Lillehammer and Dokka.

Full price table: `data/verkstedplus-services.md`.

## 3c. Dekkshop (channel C)

Angular app supplied by Norgesdekk (tyre wholesaler), one storefront per location. Customer searches by reg.nr or tyre size, orders tyres and pays at fitting. It does not appear to book a fitting time, so a customer buying tyres still has to book fitting separately.

## 4. Logic problems found in the data

Full rules: `data/booking-form-service-map.json` (pulled from the form's own endpoints).

**Add-on rules are inconsistent**
- "Dekkhotell" is offered as an add-on to Dekkhotell itself.
- "Annet" (other) offers all 22 services again as add-ons.
- Main services reappear as add-ons (Firehjulskontroll suggests Intervallservice and Oljeskift; customers can select the same thing twice).
- Some pairings don't make sense to a customer: Miljøservice suggests Dekkhotell and Dekkskift; 20-punktsjekk suggests Dekkhotell, Diagnose, Reparasjon, Dekkskift.
- Wiper replacement is the most common add-on but as a main service is only bookable at Otta and Dokka (likely a configuration mistake).

**Location availability differs per service, but the customer only finds out at step 3**
- Tyre services are not at "Mjøsbil Gjøvik" but at "Gjøvik Vulk AS" (Hunndalen). That is the same town, a different entity name.
- Heavy EU-kontroll (up to 7.5 t): Lillehammer, Gjøvik, Dokka only.
- Gearbox flush: not Fåvang. Miljøservice: not Dokka. Bobil/caravan: not Otta.
- Tretten is listed as a workshop on /tjenester/ but does not appear in any booking option.

**Car comes last**
- Reg.nr is optional and only asked at the end, while mileage is mandatory. The system never uses the car to filter or recommend services.

**Location is asked twice in some journeys**
- Location buttons on content pages (VerkstedPlus/Dekkshop) and again in step 3 of the form.

## 5. What this means for the redesign

1. **One booking entry, one journey.** The customer should never have to choose between "request", "online booking" and "dekkshop". That is an internal system decision, not a customer decision.
2. **Car first.** Ask for reg.nr up front and use it (EV vs combustion, weight class for EU-kontroll, EU-kontroll deadline via Statens vegvesen).
3. **Intent before catalogue.** Group 22 services into a handful of customer goals (routine service, EU-kontroll, tyres, something is wrong, caravan/trailer).
4. **Clean add-on rules.** A small, sensible set of recommended extras per service.
5. **Location filtered early and honestly.** Show only locations that can do the job, nearest first, and treat Gjøvik / Gjøvik Vulk as one place for the customer.
6. **Be clear about what the customer gets.** Either a confirmed time (where a live calendar exists) or a clearly labelled request with a promised response time.

## 6. Open questions for Mjøsbil (via Judah / Gilroy)

1. Why are interval service, oil change, brakes and repair not live-bookable in VerkstedPlus? Capacity planning, or just never set up?
2. Does VerkstedPlus (x2net) offer an API or embeddable booking we can design around, or must we hand off to it?
3. When a customer orders tyres in Dekkshop, how is the fitting time booked today?
4. Are Gjøvik and Gjøvik Vulk the same customer-facing location?
5. Is Tretten an active workshop?
6. Who maintains the add-on rules, and can we propose a new set?
7. Which price is correct where the systems disagree, and should prices differ by location?
