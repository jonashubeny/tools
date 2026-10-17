import { L, type Mission } from '@lemma/core';

/**
 * Missions: engineering tasks that need the mathematics. They are done outside Lemma, in
 * a real repository; Lemma tracks milestones, notes and the repository link.
 */
export const MISSIONS: Mission[] = [
  {
    id: 'disk-forecast',
    title: L('Prediktor zaplnění disku', 'Disk-full forecaster'),
    brief: L(
      'Napiš nástroj pro svůj homelab, který si pravidelně ukládá obsazenost disku a z naměřených hodnot odhadne, za kolik dní bude disk plný.',
      'Write a tool for your homelab that samples disk usage regularly and, from the measurements, estimates in how many days the disk will be full.',
    ),
    payoff: L(
      'Přímka ze dvou bodů přestane být školní úloha: je to předpověď, na které závisí, jestli ti v noci spadne server.',
      'A line through two points stops being a school exercise: it is a forecast that decides whether your server falls over at night.',
    ),
    concepts: ['lin.from-points', 'lin.model', 'lin.graph'],
    stack: ['Bash', 'Python', 'systemd timer'],
    hours: 5,
    difficulty: 1,
    milestones: [
      {
        id: 'sample',
        title: L('Sběr dat', 'Collect data'),
        detail: L(
          'Skript, který zapíše časové razítko a obsazené bajty (`df --output=used`) do CSV. Spouštěj ho timerem.',
          'A script that appends a timestamp and the used bytes (`df --output=used`) to a CSV. Run it from a timer.',
        ),
      },
      {
        id: 'two-point',
        title: L('Přímka ze dvou měření', 'A line from two samples'),
        detail: L(
          'Z prvního a posledního měření spočítej směrnici (bajty za den) a čas, kdy přímka protne kapacitu disku.',
          'From the first and last samples compute the slope (bytes per day) and the time at which the line reaches the disk capacity.',
        ),
      },
      {
        id: 'edge',
        title: L('Okrajové případy', 'Edge cases'),
        detail: L(
          'Co když obsazenost klesá, nebo se nemění? Co znamená záporná nebo nekonečná předpověď? Ošetři to a vypiš srozumitelnou zprávu.',
          'What if usage is falling, or flat? What does a negative or infinite forecast mean? Handle it and print a clear message.',
        ),
      },
      {
        id: 'report',
        title: L('Výstup', 'Report'),
        detail: L(
          'Jednořádkový výstup vhodný do MOTD nebo monitoringu: „/data: plný za 23 dní (při 1,8 GB/den)“.',
          'A one-line output fit for the MOTD or monitoring: “/data: full in 23 days (at 1.8 GB/day)”.',
        ),
      },
    ],
    stretch: [
      L(
        'Místo dvou bodů proložit přímku všemi měřeními metodou nejmenších čtverců.',
        'Instead of two points, fit a line to all samples by least squares.',
      ),
      L(
        'Ansible role, která nástroj nasadí na všechny stroje.',
        'An Ansible role that deploys the tool to every machine.',
      ),
    ],
  },
  {
    id: 'quad-visualiser',
    title: L('Vizualizér kvadratické funkce', 'Quadratic function visualiser'),
    brief: L(
      'Konzolová aplikace v C#, která pro zadané koeficienty $a$, $b$, $c$ vypíše vrchol, nulové body, obor hodnot a vykreslí parabolu znaky přímo v terminálu.',
      'A C# console application that, given the coefficients $a$, $b$, $c$, prints the vertex, zeros and range, and draws the parabola with characters right in the terminal.',
    ),
    payoff: L(
      'Všechno, co v kapitole počítáš ručně, musíš jednou popsat tak přesně, aby to zvládl stroj — včetně případů, na které se v písemce zapomíná.',
      'Everything you compute by hand in this chapter has to be described once precisely enough for a machine — including the cases people forget in tests.',
    ),
    concepts: ['quad.graph', 'quad.vertex', 'quad.roots-form', 'alg.quad-eq'],
    stack: ['C#', '.NET'],
    hours: 8,
    difficulty: 2,
    milestones: [
      {
        id: 'analyse',
        title: L('Rozbor funkce', 'Analyse the function'),
        detail: L(
          'Třída `Quadratic` s vlastnostmi `Vertex`, `Discriminant`, `Roots` (0, 1 nebo 2 prvky) a `Range`. Ošetři $a = 0$.',
          'A `Quadratic` class with `Vertex`, `Discriminant`, `Roots` (0, 1 or 2 items) and `Range`. Handle $a = 0$.',
        ),
      },
      {
        id: 'tests',
        title: L('Testy', 'Tests'),
        detail: L(
          'Unit testy pro všechny tři případy diskriminantu a pro zápornou hodnotu $a$. Použij úlohy z Lemmy jako testovací data.',
          'Unit tests for all three discriminant cases and for a negative $a$. Use problems from Lemma as test data.',
        ),
      },
      {
        id: 'plot',
        title: L('Vykreslení', 'Plot'),
        detail: L(
          'Převod souřadnic $[x; y]$ na řádek a sloupec terminálu — lineární funkce. Vykresli osy, graf a zvýrazni vrchol.',
          'Map coordinates $(x, y)$ to a terminal row and column — a linear function. Draw the axes and the graph, and highlight the vertex.',
        ),
      },
      {
        id: 'forms',
        title: L('Tři tvary', 'Three forms'),
        detail: L(
          'Výpis funkce v obecném, vrcholovém a součinovém tvaru (ten jen pokud existuje).',
          'Print the function in standard, vertex and factored form (the last only when it exists).',
        ),
      },
    ],
    stretch: [
      L(
        'Automatická volba měřítka tak, aby byly vidět vrchol i oba kořeny.',
        'Choose the scale automatically so that the vertex and both roots are visible.',
      ),
      L(
        'Řešení nerovnice $ax^2+bx+c < 0$ s výpisem intervalů.',
        'Solve the inequality $ax^2+bx+c < 0$ and print the intervals.',
      ),
    ],
  },
  {
    id: 'subnet-calc',
    title: L('Kalkulačka podsítí', 'Subnet calculator'),
    brief: L(
      'Nástroj, který z adresy ve tvaru `192.168.10.37/26` určí adresu sítě, broadcast, masku a počet použitelných adres.',
      'A tool that takes an address such as `192.168.10.37/26` and reports the network address, broadcast, netmask and number of usable hosts.',
    ),
    payoff: L(
      'Mocniny dvou a dvojková soustava přesně tak, jak je používáš při správě sítě — a jak je budeš potřebovat v prvním ročníku FIT.',
      'Powers of two and binary exactly as you use them when running a network — and as you will need them in the first year at FIT.',
    ),
    concepts: ['comp.binary', 'alg.powers', 'comp.boolean'],
    stack: ['C', 'C#', 'Python'],
    hours: 5,
    difficulty: 1,
    milestones: [
      {
        id: 'parse',
        title: L('Adresa jako číslo', 'An address as a number'),
        detail: L(
          'Převeď čtyři oktety na jedno 32bitové číslo a zpět. Vypiš ho i ve dvojkové soustavě.',
          'Convert four octets to a single 32-bit number and back. Print it in binary too.',
        ),
      },
      {
        id: 'mask',
        title: L('Maska', 'Mask'),
        detail: L(
          'Z délky prefixu $n$ vytvoř masku: $n$ jedniček a $32 - n$ nul. Počet adres v síti je $2^{32-n}$.',
          'From the prefix length $n$ build the mask: $n$ ones followed by $32 - n$ zeros. The network holds $2^{32-n}$ addresses.',
        ),
      },
      {
        id: 'bitwise',
        title: L('Bitové operace', 'Bitwise operations'),
        detail: L(
          'Adresa sítě je `adresa & maska`, broadcast `adresa | ~maska`. To je konjunkce a disjunkce bit po bitu.',
          'The network address is `address & mask`, the broadcast `address | ~mask`. That is conjunction and disjunction, bit by bit.',
        ),
      },
      {
        id: 'verify',
        title: L('Ověření', 'Verify'),
        detail: L(
          'Porovnej výstup s `ipcalc` pro deset různých sítí včetně /31 a /32.',
          'Compare the output with `ipcalc` for ten different networks, including /31 and /32.',
        ),
      },
    ],
    stretch: [
      L('Rozdělení sítě na $k$ stejně velkých podsítí.', 'Split a network into $k$ equal subnets.'),
      L('Podpora IPv6.', 'IPv6 support.'),
    ],
  },
  {
    id: 'search-benchmark',
    title: L('Lineární vs. binární vyhledávání', 'Linear vs. binary search'),
    brief: L(
      'Implementuj oba algoritmy, spočítej počet porovnání pro pole různých velikostí a výsledky vynes do grafu.',
      'Implement both algorithms, count the comparisons for arrays of different sizes, and plot the results.',
    ),
    payoff: L(
      'Uvidíš logaritmus vlastníma očima: zdesetinásobíš data a binární vyhledávání přidá jen zhruba tři kroky.',
      'You will see a logarithm with your own eyes: multiply the data by ten and binary search adds only about three steps.',
    ),
    concepts: ['log.definition', 'comp.complexity', 'exp.function'],
    stack: ['C', 'C#', 'gnuplot'],
    hours: 6,
    difficulty: 2,
    milestones: [
      {
        id: 'implement',
        title: L('Dva algoritmy', 'Two algorithms'),
        detail: L(
          'Lineární a binární vyhledávání v seřazeném poli, obojí s počítadlem porovnání.',
          'Linear and binary search in a sorted array, each with a comparison counter.',
        ),
      },
      {
        id: 'measure',
        title: L('Měření', 'Measure'),
        detail: L(
          'Pro $n = 10, 100, \\dots, 10^7$ změř nejhorší případ. Výsledky ulož do CSV.',
          'For $n = 10, 100, \\dots, 10^7$ measure the worst case. Save the results as CSV.',
        ),
      },
      {
        id: 'predict',
        title: L('Předpověď', 'Predict'),
        detail: L(
          'Než spustíš měření pro $n = 10^8$, předpověz výsledek: $\\lceil \\log_2 n \\rceil$. Souhlasí?',
          'Before measuring $n = 10^8$, predict the result: $\\lceil \\log_2 n \\rceil$. Does it agree?',
        ),
      },
      {
        id: 'plot',
        title: L('Graf', 'Plot'),
        detail: L(
          'Vynes obě křivky. Pak přepni osu $x$ na logaritmickou — co se stane s křivkou binárního vyhledávání?',
          'Plot both curves. Then switch the $x$-axis to logarithmic — what happens to the binary-search curve?',
        ),
      },
    ],
    stretch: [
      L(
        'Přidej třídění bublinkou a quicksort a porovnej $n^2$ s $n \\log n$.',
        'Add bubble sort and quicksort and compare $n^2$ with $n \\log n$.',
      ),
    ],
  },
  {
    id: 'complex-lib',
    title: L('Knihovna komplexních čísel', 'A complex-number library'),
    brief: L(
      'Malá knihovna v C: struktura, sčítání, násobení, dělení, převod do goniometrického tvaru a zpět, umocňování podle Moivreovy věty.',
      'A small C library: a struct, addition, multiplication, division, conversion to trigonometric form and back, and powers by De Moivre.',
    ),
    payoff: L(
      'Zkoušíš si jazyk, ve kterém se na FIT učí programovat, na matematice, kterou tam budeš potřebovat v Signálech a systémech.',
      'You practise the language FIT teaches programming in, on the mathematics you will need there in Signals and Systems.',
    ),
    concepts: ['cplx.algebraic', 'cplx.polar', 'cplx.moivre', 'trig.unit-circle'],
    stack: ['C', 'make'],
    hours: 10,
    difficulty: 3,
    milestones: [
      {
        id: 'struct',
        title: L('Struktura a základní operace', 'Struct and basic operations'),
        detail: L(
          '`typedef struct { double re, im; } cplx;` a funkce `cplx_add`, `cplx_mul`, `cplx_div`, `cplx_conj`.',
          '`typedef struct { double re, im; } cplx;` and the functions `cplx_add`, `cplx_mul`, `cplx_div`, `cplx_conj`.',
        ),
      },
      {
        id: 'polar',
        title: L('Goniometrický tvar', 'Trigonometric form'),
        detail: L(
          '`cplx_abs`, `cplx_arg` (použij `atan2` a zjisti proč, ne jen `atan`) a `cplx_from_polar`.',
          '`cplx_abs`, `cplx_arg` (use `atan2`, and find out why rather than plain `atan`) and `cplx_from_polar`.',
        ),
      },
      {
        id: 'moivre',
        title: L('Mocniny a odmocniny', 'Powers and roots'),
        detail: L(
          '`cplx_pow` pro celý exponent pomocí Moivreovy věty; `cplx_roots`, která vrátí všech $n$ $n$-tých odmocnin.',
          '`cplx_pow` for an integer exponent via De Moivre; `cplx_roots`, returning all $n$ $n$-th roots.',
        ),
      },
      {
        id: 'tests',
        title: L('Testy a porovnání', 'Tests and comparison'),
        detail: L(
          'Testy s tolerancí (`fabs(a - b) < 1e-9`) a porovnání s `<complex.h>`.',
          'Tests with a tolerance (`fabs(a - b) < 1e-9`) and a comparison against `<complex.h>`.',
        ),
      },
    ],
    stretch: [L('Vykreslení Mandelbrotovy množiny do souboru PPM.', 'Render the Mandelbrot set to a PPM file.')],
  },
  {
    id: 'tone-generator',
    title: L('Generátor tónů', 'Tone generator'),
    brief: L(
      'Program, který ze sinusovek složí zvuk a uloží ho jako soubor WAV: zadáš frekvenci, amplitudu a délku.',
      'A program that builds sound out of sine waves and saves it as a WAV file: you give frequency, amplitude and duration.',
    ),
    payoff: L(
      'Amplituda, perioda a fázový posun přestanou být parametry v předpisu a stanou se hlasitostí, výškou tónu a zpožděním.',
      'Amplitude, period and phase shift stop being parameters in a formula and become loudness, pitch and delay.',
    ),
    concepts: ['trig.graphs', 'trig.radians', 'trig.unit-circle'],
    stack: ['C#', 'C', 'Python'],
    hours: 8,
    difficulty: 2,
    milestones: [
      {
        id: 'samples',
        title: L('Vzorky', 'Samples'),
        detail: L(
          'Spočítej $y(t) = A \\sin(2\\pi f t)$ pro $t = 0, \\tfrac{1}{44100}, \\tfrac{2}{44100}, \\dots$',
          'Compute $y(t) = A \\sin(2\\pi f t)$ for $t = 0, \\tfrac{1}{44100}, \\tfrac{2}{44100}, \\dots$',
        ),
      },
      {
        id: 'wav',
        title: L('Soubor WAV', 'WAV file'),
        detail: L(
          'Zapiš hlavičku a 16bitové vzorky. Přehraj komorní A (440 Hz).',
          'Write the header and 16-bit samples. Play concert A (440 Hz).',
        ),
      },
      {
        id: 'chord',
        title: L('Akord', 'Chord'),
        detail: L(
          'Sečti tři sinusovky. Co se stane s amplitudou součtu a proč je potřeba ji hlídat?',
          'Add three sine waves. What happens to the amplitude of the sum, and why does it need watching?',
        ),
      },
      {
        id: 'octave',
        title: L('Oktáva', 'Octave'),
        detail: L(
          'Tón o oktávu výš má dvojnásobnou frekvenci; půltón je násobení číslem $2^{1/12}$. Vygeneruj stupnici.',
          'A note an octave up has double the frequency; a semitone is multiplication by $2^{1/12}$. Generate a scale.',
        ),
      },
    ],
    stretch: [
      L(
        'Dvě sinusovky s blízkými frekvencemi: uslyšíš zázněje. Vysvětli je součtovým vzorcem.',
        'Two sines with close frequencies: you will hear beats. Explain them with a sum formula.',
      ),
    ],
  },
  {
    id: 'load-model',
    title: L('Model zátěže serveru', 'Server load model'),
    brief: L(
      'Z naměřených dat (počet uživatelů, doba odezvy) najdi kvadratickou funkci, která je popisuje, a urči, při jaké zátěži překročí odezva stanovenou mez.',
      'From measured data (number of users, response time) find a quadratic function describing it, and determine the load at which response time exceeds a set limit.',
    ),
    payoff: L(
      'Parabola ze tří bodů, kvadratická nerovnice a obor hodnot v jedné úloze, která má odpověď v počtu uživatelů.',
      'A parabola through three points, a quadratic inequality and a range, in one task whose answer is a number of users.',
    ),
    concepts: ['quad.roots-form', 'quad.inequality', 'quad.optimize'],
    stack: ['Python', 'gnuplot'],
    hours: 6,
    difficulty: 2,
    milestones: [
      {
        id: 'measure',
        title: L('Data', 'Data'),
        detail: L(
          'Změř odezvu vlastní služby při třech různých zátěžích (`hey`, `wrk` nebo `ab`).',
          'Measure the response time of a service of your own at three different loads (`hey`, `wrk` or `ab`).',
        ),
      },
      {
        id: 'fit',
        title: L('Parabola třemi body', 'A parabola through three points'),
        detail: L(
          'Tři body dávají soustavu tří rovnic pro $a$, $b$, $c$. Vyřeš ji ručně a pak programem.',
          'Three points give a system of three equations for $a$, $b$, $c$. Solve it by hand, then in code.',
        ),
      },
      {
        id: 'limit',
        title: L('Mez', 'Limit'),
        detail: L(
          'Pro jakou zátěž platí $T(n) > 500$ ms? Je to kvadratická nerovnice — vyřeš ji a ověř čtvrtým měřením.',
          'For which load is $T(n) > 500$ ms? That is a quadratic inequality — solve it and verify with a fourth measurement.',
        ),
      },
    ],
    stretch: [
      L(
        'Jak moc se model mýlí mimo naměřený rozsah? Proč je extrapolace nebezpečná?',
        'How wrong is the model outside the measured range? Why is extrapolation dangerous?',
      ),
    ],
  },
];
