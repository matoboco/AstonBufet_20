# Aston Bufet 2.0 — Prezentacia projektu

## Navrh tem na slajdy

---

## Slajd 1: Titulny slajd

- **Aston Bufet 2.0** — Inteligentny firemny bufet
- Progresivna webova aplikacia (PWA) pre automatizovane uctovanie nakupov a spravu skladu
- Technologie: React + TypeScript + Node.js + PostgreSQL

---

## Slajd 2: Problem a motivacia

- Manualny proces evidencie nakupov vo firemnom bufete je neefektivny
- Neprehladne sledovanie zostatkov a dlhov zamestnancov
- Chybajuca kontrola nad zasobami (manka, expiracne doby)
- Casovo narocna administrativa pre office asistentov

---

## Slajd 3: Riesenie — Aston Bufet 2.0

- Plne digitalizovany firemny bufet
- Automaticke uctovanie kazdeho nakupu
- Realne sledovanie zostatkov uctu v realnom case
- PWA — instalovatelna na mobil, funguje aj offline
- Dva typy pouzivatelov: **Zamestnanec** a **Office asistent**

---

## Slajd 4: Autentifikacia a bezpecnost

- Prihlasenie cez e-mail + jednorazovy kod (OTP) — ziadne hesla
- JWT tokeny s rolami pre autorizaciu
- Obmedzenie na firemnu domenu (@aston.sk)
- Tokenove verziovanie pre bezpecny logout
- Role-based pristup — zamestnanec vs. administrator

---

## Slajd 5: Dashboard zamestnanca

- Zobrazenie aktualneho zostatku na ucte (kredit / dlh)
- Rychle akcie: Nakup, Skenovanie
- Poslednych 5 transakcii
- Sekcia akciovych produktov (ak su aktivne)
- Upozornenie na manko (shortage warning modal)

---

## Slajd 6: Nakup produktov

- Katalog vsetkych dostupnych produktov s mnozstvom na sklade
- Vyhladavanie podla nazvu alebo EAN kodu
- **Skenovanie ciaroveho kodu** cez kameru telefonu (ZXing kniznica)
- Automaticky vypocet ceny podla **FIFO metody**
- Okamzita aktualizacia zostatku po nakupe
- Podpora akciovych cien s casovym obmedzenim

---

## Slajd 7: FIFO metoda ocenovania

- First-In-First-Out — najstarsie zasoby sa spotrebuju ako prve
- Rozne davky mozu mat rozne nakupne ceny
- System automaticky vybera z najstarsich davok
- Kriticky dolezite pre potravinovy sortiment
- Ak je aktivna akciova cena, pouzije sa namiesto FIFO

---

## Slajd 8: Uctovny system (Ledger)

- Kazda transakcia je zaznam v ucte (account_entries)
- Kladna suma = vklad/platba
- Zaporna suma = nakup
- Zostatok = sucet vsetkych zaznamov
- Atomicke operacie — konzistentnost dat pri kazdom nakupe
- Historia transakcii (poslednych 50)

---

## Slajd 9: Sprava skladu (Office asistent)

- Pridavanie novych davok tovaru s FIFO podporou
- Aktualizacia nazvov a detailov produktov
- Nastavenie akciovych cien s datumom expiracie
- Inventura — porovnanie ocakavaneho vs. skutocneho mnozstva
- Evidencia mankov a odpisov
- Mazanie produktov (iba pri nulovom sklade)
- Vyhladavanie cez ciarovy kod

---

## Slajd 10: Sprava dlznikov

- Prehlad vsetkych zamestnancov so zapornym zostatkom
- Filtrovanie podla vysky dlhu (< -5 EUR pre pripomienky)
- Manualne prijimanie vkladov/platieb
- Sledovanie dobrovolnych prispevkov na manko
- Odosielanie automatizovanych pripomienkovych e-mailov
- Prehlad historie transakcii lubovolneho pouzivatela

---

## Slajd 11: Manko a inventura

- Office asistent vykonava inventuru (expected vs. actual)
- System automaticky vypocita manko (rozdiel)
- Odpisy (expiracie, poskodenia) sa nezapocitavaju do manka
- Vsetci pouzivatelia dostanu upozornenie s detailmi
- Dobrovolne prispevky na manko su evidovane osobitne
- Celkovy prehlad: shortage summary

---

## Slajd 12: Automatizovane e-mailove pripomienky

- **Automaticky** 1. den v mesiaci o 9:00 (Europe/Bratislava)
- **Manualne** spustenie office asistentom kedykolvek
- Odosiela sa iba pouzivatelom so zostatkom < -5 EUR
- Personalizovany pozdrav podla mena
- Zobrazenie aktualneho zostatku a vyzva na uhradu

---

## Slajd 13: PWA funkcie

- Instalovatelna na domovsku obrazovku mobilu
- Offline cachovanie — zakladna funkcionalita bez internetu
- Automaticka detekcia novej verzie aplikacie
- Manualne spustenie aktualizacie v nastaveniach
- Service Worker pre cachovanie zdrojov

---

## Slajd 14: Technologicky stack

| Vrstva     | Technologia                              |
|------------|------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, TailwindCSS  |
| Backend    | Node.js/Bun, Express, TypeScript         |
| Databaza   | PostgreSQL 8+                            |
| Auth       | JWT + OTP (Nodemailer)                   |
| Sken       | ZXing (ciarove kody), React Webcam       |
| PWA        | Vite PWA plugin, Service Worker          |
| Validacia  | Zod schemas                              |
| Cron       | Node-Cron (mesacne pripomienky)          |
| Testy      | Jest                                     |

---

## Slajd 15: Databazovy model

- **users** — zamestnanci a administratori (UUID, email, rola)
- **products** — katalog produktov (nazov, EAN, cena, akciova cena)
- **stock_batches** — FIFO zasoby (mnozstvo, nakupna cena, datum)
- **account_entries** — financna hlavna kniha (vklady a nakupy)
- **stock_adjustments** — inventurne zaznamy a manka
- **shortage_contributions** — dobrovolne prispevky na manko
- **login_codes** — OTP kody s expiraciou
- Views: account_balances, account_history, shortage_summary

---

## Slajd 16: API architektura

- RESTful API s jasnym rozdelenim:
  - `/auth` — autentifikacia (OTP)
  - `/products` — katalog a sprava produktov
  - `/purchases` — vykonavanie nakupov (FIFO)
  - `/stock` — skladove operacie
  - `/account` — zostatky, vklady, historia
  - `/admin` — sprava dlznikov a pripomienok
- Middleware: JWT overenie, kontrola roli
- Validacia vstupov cez Zod schemas

---

## Slajd 17: Bezpecnostne opatrenia

- Ziadne hesla — iba OTP kody s 10-minutovou platnostou
- JWT s role-based pristupom
- Tokenove verziovanie pre bezpecny logout
- Izolovane data — zamestnanec vidi iba vlastne udaje
- Skladove a financne operacie iba pre administratora
- Volitelne obmedzenie e-mailovych domen

---

## Slajd 18: Zhrnutie a benefity

- **Pre zamestnancov**: Jednoduchy a rychly nakup, prehlad financii
- **Pre office asistentov**: Automatizovana administrativa, kontrola skladu
- **Pre firmu**: Presna evidencia, minimalne straty, transparentnost
- **Technicke vyhody**: PWA, offline podpora, skenovanie ciarovych kodov
- **Financne**: FIFO ocenovanie, automaticke pripomienky, evidencia manka

---

## Slajd 19: Demo (navrh scenara)

1. Prihlasenie cez OTP kod
2. Prehlad dashboardu so zostatkom
3. Nakup produktu (klik + skenovanie)
4. Zobrazenie historie transakcii
5. Prepnutie na Office asistenta
6. Inventura a zaznam manka
7. Odoslanie pripomienky dlznikom

---

## Slajd 20: Dakujem za pozornost

- Otazky a diskusia
- Kontakt / repozitar projektu
