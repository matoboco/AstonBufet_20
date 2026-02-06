# Firemný Bufet

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

Správca bufetu má navyše prístup k:

#### Správa dlžníkov
- Zoznam zamestnancov so záporným zostatkom
- Príjem hotovosti a evidencia vkladov na účet zamestnanca
- Odoslanie emailových pripomienok dlžníkom (dlh > 5 EUR)

#### Správa skladu
- Naskladnenie tovaru - zadanie EAN, názvu, množstva a nákupnej ceny
- Automatické vytvorenie nového produktu pri prvom naskladnení
- Prehľad aktuálnych skladových zásob (FIFO)

#### Správa produktov
- Úprava názvov produktov
- Inventúra - zadanie skutočného stavu skladu
- Automatický výpočet a evidencia manka/prebytku

## Hlavné funkcie

### Nákupný proces

1. Zamestnanec otvorí aplikáciu a vyberie produkt (alebo naskenuje čiarový kód)
2. Zvolí množstvo a potvrdí nákup
3. Suma sa automaticky odpočíta z jeho účtu
4. Sklad sa aktualizuje (FIFO metóda)

### Evidencia manka

1. Office assistant vykoná inventúru - zadá skutočný stav skladu
2. Systém porovná so stavom v databáze a zaznamená rozdiel
3. Pri zistení manka sú všetci zamestnanci upozornení pri najbližšom otvorení aplikácie
4. Zamestnanec musí potvrdiť, že berie upozornenie na vedomie

### Pripomienky dlhov

- Automatické emailové pripomienky na 1. deň v mesiaci (pre dlhy > 5 EUR)
- Manuálne odoslanie pripomienok office assistant kedykoľvek

### PWA funkcie

- Inštalácia na domovskú obrazovku mobilu
- Offline podpora (cached assets)
- Detekcia novej verzie s možnosťou aktualizácie

## Prihlásenie

- Prihlásenie pomocou emailu a jednorazového kódu (OTP)
- Kód sa odošle na zadaný email a je platný 10 minút
- Nový používateľ sa automaticky vytvorí pri prvom prihlásení

## Požiadavky

- Moderný webový prehliadač s podporou kamery (pre skenovanie)
- Prístup k internetu
- Platná emailová adresa

## Spustenie

```bash
docker compose up --build
```

Aplikácia bude dostupná na porte 80.
