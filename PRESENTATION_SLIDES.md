# Aston Bufet 2.0 — Prezentacia projektu

## Navrh tem na slajdy

---

## Slajd 1: Titulny slajd

- **Aston Bufet 2.0** — Inteligentny firemny bufet
- Webova aplikacia pre jednoduchy nakup a spravu firemneho bufetu
- Funguje na mobile aj pocitaci — staci otvorit prehliadac

---

## Slajd 2: Problem, ktory riesime

- Kto co kupil? Kolko dlhuje? Kolko je na sklade? — vsetko sa riesilo rucne
- Majka (office asistentka) travila cas rucnym zapisovanim nakupov a zostatkov
- Zamestnanci nemali prehlad o svojom ucte
- Neprehladny nakup — dlhy zoznam produktov, tazke hladanie toho, co potrebujem
- Chybajuci tovar (manka) sa tazko dohladaval

---

## Slajd 3: Ako to funguje pre zamestnanca

- Prihlasi sa cez firemny e-mail — prijde mu jednorazovy kod, ziadne heslo
- Na hlavnej obrazovke vidi svoj zostatok (kredit alebo dlh)
- Vyberie si produkt z katalogy alebo naskenuje ciarovy kod telefonom
- Nakup sa okamzite zapise a zostatok sa aktualizuje
- Vidí historiu svojich nakupov

---

## Slajd 4: Nakup a skenovanie

- Katalog produktov s aktualnymi cenami a dostupnostou
- Moznost vyhladavania podla nazvu
- **Skenovanie ciaroveho kodu** priamo kamerou telefonu — rychly nakup
- Akciove ceny sa zobrazia automaticky (napr. pred expiraciou)
- Po nakupe sa ihned aktualizuje zostatok na ucte

---

## Slajd 5: Co vidi a robi Majka — sklad

- Pridavanie tovaru na sklad (novy tovar aj doplnenie existujuceho)
- Nastavenie akciovych cien s datumom ukoncenia akcie
- Inventura — porovnanie skutocneho stavu s ocakavanym
- Evidencia mankov a odpisov (expiracie, poskodeny tovar)
- Vyhladavanie produktov cez ciarovy kod

---

## Slajd 6: Co vidi a robi Majka — dlznici

- Prehlad vsetkych zamestnancov, ktori dlhuju za bufet
- Prijimanie hotovostnych vkladov a platieb
- Odosielanie pripomienkovych e-mailov dlznikom (manualne alebo automaticky 1x mesacne)
- Prehlad historie nakupov a platieb kazdeho zamestnanca

---

## Slajd 7: Manko a inventura

- Majka spocita skutocny stav tovaru na sklade
- System porovna so stavom v evidencii a vypocita rozdiel (manko)
- Odpisy (expirovany ci poskodeny tovar) sa eviduju zvlast
- Zamestnanci dostanu upozornenie o manku
- Dobrovolne prispevky na pokrytie manka su evidovane osobitne

---

## Slajd 8: Automaticke pripomienky

- Kazdy mesiac system automaticky posle e-mail zamestnancom s dlhom viac ako 5 EUR
- Majka moze pripomienku poslat aj kedykolvek rucne
- E-mail obsahuje aktualny zostatok a vyzvu na uhradu
- Personalizovany pozdrav podla mena zamestnanca

---

## Slajd 9: Aplikacia na mobile

- Aplikacia sa da nainstalovat na domovsku obrazovku telefonu (ako bezna appka)
- Funguje aj s obmedzenym pripojenim na internet
- Automaticky upozorni na novu verziu aplikacie

---

## Slajd 10: Pouzite technologie

- **Webova aplikacia**: React, TypeScript, TailwindCSS
- **Server**: Node.js, Express, PostgreSQL databaza
- **Bezpecnost**: Prihlasenie cez jednorazovy kod (OTP), pristup podla roli
- **Dalsie**: skenovanie ciarovych kodov, automaticke e-maily, offline podpora (PWA)

---

## Slajd 11: Architektura systemu

- Frontend (co vidia pouzivatelia) komunikuje so serverom cez REST API
- Server spracovava logiku nakupov, skladu a uctov
- Vsetky data su ulozene v PostgreSQL databaze
- System automaticky: pocita ceny podla FIFO metody, posiela pripomienky, sleduje zasoby

---

## Slajd 12: Zhrnutie a benefity

- **Pre zamestnancov**: Rychly nakup, prehlad o svojom ucte, ziadne hesla
- **Pre office asistentov**: Menej administrativy, automaticke pripomienky, prehlad o sklade
- **Pre firmu**: Presna evidencia, transparentnost, minimalne straty
- Vsetko dostupne na mobile aj pocitaci

---

## Slajd 13: Demo (navrh scenara)

1. Prihlasenie cez e-mail a jednorazovy kod
2. Prehlad dashboardu so zostatkom
3. Nakup produktu kliknutim a skenovanim
4. Zobrazenie historie nakupov
5. Prepnutie na rolu office asistenta
6. Inventura a zaznam manka
7. Odoslanie pripomienky dlznikom

---

## Slajd 14: Dakujem za pozornost

- Otazky a diskusia
- Kontakt / repozitar projektu
