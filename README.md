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

### Evidencia manka

1. Office assistant vykoná inventúru - zadá skutočný stav skladu
2. Systém porovná so stavom v databáze a zaznamená rozdiel
3. Pri zistení manka sú všetci zamestnanci upozornení pri najbližšom otvorení aplikácie
4. Zamestnanec musí potvrdiť, že berie upozornenie na vedomie
5. Odpisy (expirovaný/poškodený tovar) sa nezapočítavajú do upozornení

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
