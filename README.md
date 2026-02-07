# Aston Bufet 2.0

Webová aplikácia (PWA) pre správu firemného bufetu s automatickým účtovaním nákupov a správou skladu.

## Prehľad

Aplikácia umožňuje zamestnancom nakupovať z firemného bufetu pomocou mobilného telefónu. Nákupy sa automaticky účtujú na osobný účet zamestnanca, ktorý sa následne vyrovnáva s office assistant.

## Role používateľov

### Zamestnanec (user)

Bežný zamestnanec môže:

- **Prezerať produkty** - zoznam dostupných produktov v bufete s cenami a stavom skladu
- **Nakupovať** - výber produktu a potvrdenie nákupu, suma sa odpočíta z osobného účtu
- **Skenovať čiarové kódy** - rýchly nákup pomocou skenovania EAN kódu produktu
- **Sledovať zostatok** - aktuálny stav osobného účtu (kladný = kredit, záporný = dlh)
- **História transakcií** - prehľad všetkých nákupov a vkladov
- **Upozornenia na manko** - pri zistení manka v sklade je zamestnanec upozornený s pripomienkou na evidovanie nákupov

### Office Assistant (office_assistant)

Správca bufetu má prístup k dashboardu s dvoma kartami:

#### Karta Sklad (hlavná)
- **Vyhľadávanie produktov** - textové vyhľadávanie alebo skenovanie EAN
- **Naskladnenie tovaru** - zadanie EAN, názvu, množstva a nákupnej ceny
- **Inventúra** - zadanie skutočného stavu skladu s automatickým výpočtom manka/prebytku
- **Odpis tovaru** - možnosť odpísať tovar (expirovaný, poškodený) bez evidencie ako manko
- **Úprava názvov produktov**

#### Karta Dlžníci
- Zoznam zamestnancov so záporným zostatkom
- Príjem hotovosti a evidencia vkladov na účet zamestnanca
- Odoslanie emailových pripomienok dlžníkom (dlh > 5 EUR)

## Hlavné funkcie

### Nákupný proces

1. Zamestnanec otvorí aplikáciu a vyberie produkt (alebo naskenuje čiarový kód)
2. Zvolí množstvo a potvrdí nákup
3. Zobrazí sa skutočná cena podľa FIFO (ak sú rôzne nákupné ceny, zobrazí sa mix)
4. Suma sa automaticky odpočíta z jeho účtu
5. Sklad sa aktualizuje (FIFO metóda)

### Vyrovnanie dlhu a vklad hotovosti

Zamestnanec príde za office assistant vyrovnať svoj dlh:

1. Office assistant otvorí kartu **Dlžníci** a vyhľadá zamestnanca
2. Zamestnanec odovzdá hotovosť (napr. 10 €)
3. Office assistant zadá sumu do políčka **Vklad** a potvrdí

**Príklad 1: Presné vyrovnanie**
- Zamestnanec má dlh -8.50 €
- Vloží 8.50 €
- Výsledný zostatok: 0.00 €

**Príklad 2: Vklad do plusu**
- Zamestnanec má dlh -5.00 €
- Vloží 10.00 €
- Výsledný zostatok: +5.00 € (kredit na budúce nákupy)

**Príklad 3: Príspevok na manko**
- Zamestnanec má dlh -5.00 €
- Chce vložiť 10.00 €, ale nechce mať kredit
- Office assistant označí 5.00 € ako **príspevok na manko**
- Výsledný zostatok: 0.00 €
- Príspevok 5.00 € sa eviduje v systéme ako pokrytie manka

Príspevok na manko je dobrovoľný. Zamestnanec môže prispieť ak si uvedomí, že niečo z chýbajúceho tovaru mohol mať on bez zaevidovania.

### Inventúra a evidencia manka

Office assistant pravidelne kontroluje skutočný stav skladu:

1. Na karte **Sklad** vyberie produkt
2. Zadá **skutočné množstvo** na sklade
3. Systém porovná s evidovaným stavom a vypočíta rozdiel:
   - **Manko** (-)  = chýba tovar (niekto si vzal bez zaevidovania)
   - **Prebytok** (+) = viac ako má byť (zriedkavé, možná chyba pri naskladnení)

**Odpis tovaru:**
- Ak je tovar poškodený alebo expirovaný, označí sa ako **odpis**
- Odpisy sa nezapočítavajú do manka a negenerujú upozornenia

### Upozornenia na manko

Pri zistení manka systém upozorní všetkých zamestnancov:

1. Office assistant vykoná inventúru a zistí manko
2. Pri najbližšom otvorení aplikácie sa každému zamestnancovi zobrazí **modálne okno**
3. Okno obsahuje:
   - Informáciu o zistenom manku (napr. "Boli zistené chýbajúce položky")
   - Pripomienku na evidovanie všetkých nákupov
   - Tlačidlo na potvrdenie
4. Zamestnanec musí potvrdiť "Beriem na vedomie" aby mohol pokračovať v aplikácii
5. Upozornenie sa zobrazí len raz (po potvrdení sa neukazuje znova)

**Prečo upozorňujeme všetkých?**
Manko môže byť spôsobené hocikým - niekto si mohol zabudnúť zaevidovať nákup. Namiesto obviňovania jednotlivcov systém pripomenie všetkým, aby si dávali pozor.

### Pripomienky dlhov

- Automatické emailové pripomienky na 1. deň v mesiaci (pre dlhy > 5 EUR)
- Manuálne odoslanie pripomienok office assistant kedykoľvek
- Email obsahuje aktuálny zostatok a výzvu na vyrovnanie
- Ak má používateľ zadané meno, email ho osloví osobne ("Ahoj Peter")

### Profil používateľa

Každý zamestnanec má prístup k svojmu profilu:

- **Osobné údaje** - email a voliteľné meno (použije sa v emailových pripomienkach)
- **História nákupov** - kompletný zoznam transakcií
- **Verzia aplikácie** - aktuálna verzia s možnosťou kontroly aktualizácií
- **Odhlásenie** - bezpečné odhlásenie z aplikácie

### PWA funkcie

- Inštalácia na domovskú obrazovku mobilu
- Offline podpora (cached assets)
- Detekcia novej verzie s možnosťou aktualizácie

## Prihlásenie

- Prihlásenie pomocou emailu a jednorazového kódu (OTP)
- Kód sa odošle na zadaný email a je platný 10 minút
- Nový používateľ sa automaticky vytvorí pri prvom prihlásení
- Pre @aston.sk adresy sa používa krátky tvar bez bodky (mpriezvisko@aston.sk)

## Požiadavky

- Moderný webový prehliadač s podporou kamery (pre skenovanie)
- Prístup k internetu
- Platná emailová adresa

## Spustenie

```bash
docker compose up --build
```

Aplikácia bude dostupná na porte 80.

## Dokumentácia

- [Architektúra](ARCHITECTURE.md) - technický prehľad backendu, frontendu a databázy
