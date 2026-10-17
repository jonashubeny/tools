import { L, type Concept } from '@lemma/core';

/** Syllabus topics 11–15: trigonometric functions, equations, identities, complex numbers, trigonometry. */
export const TRIG_CONCEPTS: Concept[] = [
  // ------------------------------------------------------------ 11 trigonometric functions
  {
    id: 'trig.radians',
    title: L('Orientovaný úhel a oblouková míra', 'Directed angles and radians'),
    summary: L(
      'Převádět mezi stupni a radiány a najít základní velikost orientovaného úhlu.',
      'Convert between degrees and radians and find the principal value of a directed angle.',
    ),
    area: 'trig',
    track: 'school',
    syllabusTopic: 11,
    prereqs: ['geo.right-triangle'],
    why: {
      intuition: L(
        'Radián měří úhel délkou oblouku: úhel 1 rad vytne na jednotkové kružnici oblouk délky 1. Celá kružnice má délku $2\\pi$, proto $360^\\circ = 2\\pi$.',
        'A radian measures an angle by arc length: an angle of 1 rad cuts an arc of length 1 on the unit circle. The whole circle has length $2\\pi$, hence $360^\\circ = 2\\pi$.',
      ),
      algebraic: L(
        '$180^\\circ = \\pi$. Ze stupňů na radiány násobíš $\\frac{\\pi}{180}$, zpět $\\frac{180}{\\pi}$.',
        '$180^\\circ = \\pi$. Degrees to radians: multiply by $\\frac{\\pi}{180}$; back: by $\\frac{180}{\\pi}$.',
      ),
      it: L(
        '`Math.Sin` v C#, `sin` v C i skoro každá knihovna čekají radiány. Dosazení stupňů je jedna z nejčastějších chyb v herní matematice.',
        '`Math.Sin` in C#, `sin` in C, and almost every library expect radians. Passing degrees is one of the most common bugs in game maths.',
      ),
    },
    terms: [
      { cs: 'oblouková míra', en: 'radian measure' },
      { cs: 'orientovaný úhel', en: 'directed angle' },
    ],
    fit: ['ISM', 'IMA1'],
    lab: { tool: 'unitcircle' },
  },
  {
    id: 'trig.unit-circle',
    title: L('Sinus a kosinus na jednotkové kružnici', 'Sine and cosine on the unit circle'),
    summary: L(
      'Určit přesné hodnoty goniometrických funkcí významných úhlů ve všech kvadrantech.',
      'Find exact values of the trigonometric functions of special angles in every quadrant.',
    ),
    area: 'trig',
    track: 'school',
    syllabusTopic: 11,
    prereqs: ['trig.radians'],
    why: {
      intuition: L(
        'Bod na jednotkové kružnici pod úhlem $x$ má souřadnice $[\\cos x; \\sin x]$. Kosinus je „jak daleko doprava“, sinus „jak vysoko“.',
        'The point on the unit circle at angle $x$ has coordinates $(\\cos x, \\sin x)$. Cosine is “how far right”, sine is “how high”.',
      ),
      visual: L(
        'Znaménka v kvadrantech nejsou tabulka nazpaměť: stačí se podívat, jestli je bod vpravo/vlevo a nahoře/dole.',
        'The signs in the quadrants are not a table to memorise: just look whether the point is right/left and above/below.',
      ),
      formal: L(
        '$\\operatorname{tg} x = \\frac{\\sin x}{\\cos x}$ pro $\\cos x \\ne 0$, $\\operatorname{cotg} x = \\frac{\\cos x}{\\sin x}$ pro $\\sin x \\ne 0$.',
        '$\\tan x = \\frac{\\sin x}{\\cos x}$ for $\\cos x \\ne 0$, $\\cot x = \\frac{\\cos x}{\\sin x}$ for $\\sin x \\ne 0$.',
      ),
      it: L(
        'Otočit objekt o úhel $\\varphi$ znamená spočítat $\\cos\\varphi$ a $\\sin\\varphi$. Pohyb „dopředu“ ve hře je `x += cos(a) * v; y += sin(a) * v`.',
        'Rotating an object by $\\varphi$ means computing $\\cos\\varphi$ and $\\sin\\varphi$. Moving “forward” in a game is `x += cos(a) * v; y += sin(a) * v`.',
      ),
    },
    terms: [
      { cs: 'jednotková kružnice', en: 'unit circle' },
      { cs: 'kvadrant', en: 'quadrant' },
      { cs: 'tangens (tg), kotangens (cotg)', en: 'tangent (tan), cotangent (cot)' },
    ],
    fit: ['ISM', 'IMA1', 'ISS'],
    lab: { tool: 'unitcircle' },
  },
  {
    id: 'trig.graphs',
    title: L('Grafy goniometrických funkcí', 'Graphs of trigonometric functions'),
    summary: L(
      'Z předpisu $y = a\\sin(bx + c) + d$ určit amplitudu, periodu a posunutí.',
      'Read amplitude, period and shifts from $y = a\\sin(bx + c) + d$.',
    ),
    area: 'trig',
    track: 'school',
    syllabusTopic: 11,
    prereqs: ['trig.unit-circle', 'fn.transform'],
    encompasses: [{ id: 'fn.transform', w: 0.5 }],
    why: {
      intuition: L(
        'Sinusoida je výška bodu, který rovnoměrně obíhá kružnici, vynesená v čase.',
        'A sine wave is the height of a point going steadily round a circle, plotted against time.',
      ),
      formal: L(
        'Pro $y = a\\sin(bx + c) + d$: amplituda $|a|$, perioda $\\frac{2\\pi}{|b|}$, obor hodnot $\\langle d - |a|; d + |a|\\rangle$.',
        'For $y = a\\sin(bx + c) + d$: amplitude $|a|$, period $\\frac{2\\pi}{|b|}$, range $[d - |a|, d + |a|]$.',
      ),
      it: L(
        'Zvuk, střídavé napětí i rádiový signál jsou součty sinusovek. Předmět Signály a systémy na FIT stojí na tom, že jakýkoli signál jde na sinusovky rozložit.',
        'Sound, AC voltage and radio signals are sums of sine waves. The FIT course Signals and Systems is built on the fact that any signal can be decomposed into them.',
      ),
    },
    terms: [
      { cs: 'perioda', en: 'period' },
      { cs: 'amplituda', en: 'amplitude' },
    ],
    fit: ['ISM', 'IMA1', 'ISS', 'IEL'],
    lab: { tool: 'sinusoid' },
  },

  // ------------------------------------------------------------ 12 trigonometric equations
  {
    id: 'trigeq.basic',
    title: L('Základní goniometrické rovnice', 'Basic trigonometric equations'),
    summary: L(
      'Vyřešit $\\sin x = a$, $\\cos x = a$, $\\operatorname{tg} x = a$ v daném intervalu i obecně.',
      'Solve $\\sin x = a$, $\\cos x = a$, $\\tan x = a$ on a given interval and in general.',
    ),
    area: 'trig',
    track: 'school',
    syllabusTopic: 12,
    prereqs: ['trig.unit-circle'],
    encompasses: [{ id: 'trig.unit-circle', w: 0.6 }],
    why: {
      intuition: L(
        'Rovnice $\\sin x = \\frac{1}{2}$ se ptá, ve kterých bodech kružnice je výška $\\frac{1}{2}$. Takové body jsou v jedné otáčce dva — a pak se opakují.',
        'The equation $\\sin x = \\frac{1}{2}$ asks at which points of the circle the height is $\\frac{1}{2}$. There are two in one turn — and then they repeat.',
      ),
      formal: L(
        'Všechna řešení: přičti celočíselné násobky periody. $x = x_0 + 2k\\pi$, $k \\in \\mathbb{Z}$ (pro tangens $x = x_0 + k\\pi$).',
        'All solutions: add integer multiples of the period. $x = x_0 + 2k\\pi$, $k \\in \\mathbb{Z}$ (for tangent, $x = x_0 + k\\pi$).',
      ),
    },
    fit: ['ISM'],
    lab: { tool: 'unitcircle' },
  },
  {
    id: 'trigeq.advanced',
    title: L('Goniometrické rovnice: substituce a rozklad', 'Trigonometric equations: substitution and factoring'),
    summary: L(
      'Řešit rovnice převoditelné na kvadratickou substitucí nebo rozkladem na součin.',
      'Solve equations reducible to a quadratic by substitution or by factoring.',
    ),
    area: 'trig',
    track: 'school',
    syllabusTopic: 12,
    prereqs: ['trigeq.basic', 'alg.quad-eq', 'trigid.basic'],
    encompasses: [
      { id: 'trigeq.basic', w: 0.6 },
      { id: 'alg.quad-eq', w: 0.4 },
    ],
    why: {
      intuition: L(
        'Substituce $t = \\sin x$ promění rovnici v kvadratickou. Nová je jen podmínka $-1 \\le t \\le 1$ — kořen mimo ni žádné $x$ nedá.',
        'The substitution $t = \\sin x$ turns the equation into a quadratic. The only new thing is the condition $-1 \\le t \\le 1$ — a root outside it gives no $x$.',
      ),
      algebraic: L(
        'Nikdy nekrať rovnici výrazem, který může být nula (např. $\\cos x$): ztratíš řešení. Místo toho vytkni a rozlož na součin.',
        'Never divide an equation by something that may be zero (such as $\\cos x$): you lose solutions. Factor it out instead.',
      ),
    },
    fit: ['ISM'],
  },

  // ------------------------------------------------------------- 13 trigonometric identities
  {
    id: 'trigid.basic',
    title: L('Základní goniometrické vztahy', 'Basic trigonometric identities'),
    summary: L(
      'Používat $\\sin^2 x + \\cos^2 x = 1$ a vztahy mezi funkcemi k úpravě výrazů.',
      'Use $\\sin^2 x + \\cos^2 x = 1$ and the relations between the functions to simplify expressions.',
    ),
    area: 'trig',
    track: 'school',
    syllabusTopic: 13,
    prereqs: ['trig.unit-circle', 'alg.expressions'],
    why: {
      intuition: L(
        '$\\sin^2 x + \\cos^2 x = 1$ je Pythagorova věta pro trojúhelník v jednotkové kružnici: odvěsny $\\sin x$ a $\\cos x$, přepona 1.',
        '$\\sin^2 x + \\cos^2 x = 1$ is the Pythagorean theorem for the triangle inside the unit circle: legs $\\sin x$ and $\\cos x$, hypotenuse 1.',
      ),
      formal: L(
        'Identita platí pro všechna $x$ z definičního oboru. Při úpravách proto vždy uveď podmínky (např. $\\cos x \\ne 0$).',
        'An identity holds for every $x$ in its domain. So always state the conditions when simplifying (e.g. $\\cos x \\ne 0$).',
      ),
    },
    fit: ['ISM', 'IMA1'],
  },
  {
    id: 'trigid.sum',
    title: L('Součtové vzorce a dvojnásobný úhel', 'Sum formulas and double angle'),
    summary: L(
      'Použít vzorce pro $\\sin(x \\pm y)$, $\\cos(x \\pm y)$, $\\sin 2x$ a $\\cos 2x$.',
      'Apply the formulas for $\\sin(x \\pm y)$, $\\cos(x \\pm y)$, $\\sin 2x$ and $\\cos 2x$.',
    ),
    area: 'trig',
    track: 'school',
    syllabusTopic: 13,
    prereqs: ['trigid.basic'],
    why: {
      formal: L(
        '$\\sin 2x = 2\\sin x\\cos x$, $\\cos 2x = \\cos^2 x - \\sin^2 x$. Obojí plyne ze součtových vzorců dosazením $y = x$.',
        '$\\sin 2x = 2\\sin x\\cos x$, $\\cos 2x = \\cos^2 x - \\sin^2 x$. Both follow from the sum formulas with $y = x$.',
      ),
      it: L(
        'Součtové vzorce jsou přesně to, co dělá rotační matice: otočení o $x$ a pak o $y$ je otočení o $x + y$. Tak se skládají rotace v grafice.',
        'The sum formulas are exactly what a rotation matrix does: rotating by $x$ and then by $y$ is rotating by $x + y$. That is how rotations compose in graphics.',
      ),
    },
    fit: ['ISM', 'ILG', 'ISS'],
  },

  // ------------------------------------------------------------- 14 complex, trigonometric form
  {
    id: 'cplx.polar',
    title: L('Goniometrický tvar komplexního čísla', 'Trigonometric form of a complex number'),
    summary: L(
      'Určit absolutní hodnotu a argument a převádět mezi algebraickým a goniometrickým tvarem.',
      'Find modulus and argument, and convert between algebraic and trigonometric form.',
    ),
    area: 'complex',
    track: 'school',
    syllabusTopic: 14,
    prereqs: ['cplx.algebraic', 'trig.unit-circle'],
    encompasses: [{ id: 'trig.unit-circle', w: 0.5 }],
    why: {
      intuition: L(
        'Bod v rovině můžeš popsat dvěma způsoby: „kolik doprava a kolik nahoru“ (algebraický tvar), nebo „jak daleko a kterým směrem“ (goniometrický tvar).',
        'A point in the plane can be described two ways: “how far right and how far up” (algebraic form), or “how far and in which direction” (trigonometric form).',
      ),
      formal: L(
        '$z = |z|(\\cos\\varphi + \\mathrm{i}\\sin\\varphi)$, kde $|z| = \\sqrt{a^2 + b^2}$ a $\\cos\\varphi = \\frac{a}{|z|}$, $\\sin\\varphi = \\frac{b}{|z|}$.',
        '$z = |z|(\\cos\\varphi + \\mathrm{i}\\sin\\varphi)$, where $|z| = \\sqrt{a^2 + b^2}$ and $\\cos\\varphi = \\frac{a}{|z|}$, $\\sin\\varphi = \\frac{b}{|z|}$.',
      ),
      it: L(
        'Sinusový signál má amplitudu a fázi — přesně absolutní hodnotu a argument komplexního čísla. První cvičení předmětu Signály a systémy na FIT je „komplexní čísla, kosinusovky a komplexní exponenciály“.',
        'A sinusoidal signal has an amplitude and a phase — exactly the modulus and argument of a complex number. The first exercise of FIT’s Signals and Systems course is “complex numbers, cosines and complex exponentials”.',
      ),
    },
    terms: [
      { cs: 'absolutní hodnota komplexního čísla', en: 'modulus' },
      { cs: 'argument', en: 'argument' },
      { cs: 'goniometrický tvar', en: 'trigonometric (polar) form' },
    ],
    fit: ['ISM', 'ISS', 'IEL'],
    lab: { tool: 'complex' },
  },
  {
    id: 'cplx.moivre',
    title: L('Násobení, dělení a Moivreova věta', "Multiplication, division and De Moivre's theorem"),
    summary: L(
      'Násobit, dělit a umocňovat komplexní čísla v goniometrickém tvaru.',
      'Multiply, divide and raise complex numbers to powers in trigonometric form.',
    ),
    area: 'complex',
    track: 'school',
    syllabusTopic: 14,
    prereqs: ['cplx.polar'],
    encompasses: [{ id: 'cplx.polar', w: 0.6 }],
    why: {
      intuition: L(
        'Násobení komplexním číslem je otočení a natažení: absolutní hodnoty se násobí, argumenty sčítají. Násobit číslem $\\mathrm{i}$ znamená otočit o $90^\\circ$.',
        'Multiplying by a complex number is a rotation and a stretch: moduli multiply, arguments add. Multiplying by $\\mathrm{i}$ means turning by $90^\\circ$.',
      ),
      formal: L(
        'Moivreova věta: $\\left[|z|(\\cos\\varphi + \\mathrm{i}\\sin\\varphi)\\right]^n = |z|^n(\\cos n\\varphi + \\mathrm{i}\\sin n\\varphi)$.',
        'De Moivre: $\\left[|z|(\\cos\\varphi + \\mathrm{i}\\sin\\varphi)\\right]^n = |z|^n(\\cos n\\varphi + \\mathrm{i}\\sin n\\varphi)$.',
      ),
      it: L(
        '2D rotaci ve hře jde zapsat jedním komplexním násobením místo matice. Ve 3D dělají totéž kvaterniony.',
        'A 2D rotation in a game can be written as a single complex multiplication instead of a matrix. In 3D, quaternions do the same job.',
      ),
    },
    terms: [{ cs: 'Moivreova věta', en: "De Moivre's theorem" }],
    fit: ['ISM', 'ISS'],
    lab: { tool: 'complex', preset: { mode: 'multiply' } },
  },

  // ----------------------------------------------------------------------- 15 trigonometry
  {
    id: 'trigo.sine-rule',
    title: L('Sinová věta', 'The law of sines'),
    summary: L(
      'Dopočítat strany a úhly obecného trojúhelníku pomocí sinové věty.',
      'Find sides and angles of a general triangle using the law of sines.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 15,
    prereqs: ['geo.right-triangle', 'trig.unit-circle'],
    why: {
      intuition: L(
        'Proti větší straně leží větší úhel — a to v přesném poměru sinů.',
        'A longer side lies opposite a larger angle — in the exact ratio of the sines.',
      ),
      formal: L(
        '$\\frac{a}{\\sin\\alpha} = \\frac{b}{\\sin\\beta} = \\frac{c}{\\sin\\gamma}$. Použiješ ji, když znáš stranu a protilehlý úhel.',
        '$\\frac{a}{\\sin\\alpha} = \\frac{b}{\\sin\\beta} = \\frac{c}{\\sin\\gamma}$. Use it when you know a side and its opposite angle.',
      ),
      it: L(
        'Triangulace: ze dvou stanovišť a dvou změřených úhlů určíš polohu třetího bodu. Tak funguje zaměřování i odhad polohy z vysílačů.',
        'Triangulation: from two stations and two measured angles you locate a third point. That is how surveying and transmitter-based positioning work.',
      ),
    },
    fit: ['ISM'],
  },
  {
    id: 'trigo.cosine-rule',
    title: L('Kosinová věta', 'The law of cosines'),
    summary: L(
      'Dopočítat stranu ze dvou stran a úhlu, nebo úhel ze tří stran.',
      'Find a side from two sides and the included angle, or an angle from three sides.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 15,
    prereqs: ['geo.right-triangle', 'trig.unit-circle'],
    why: {
      intuition: L(
        'Je to Pythagorova věta s opravou za to, že úhel není pravý. Pro $\\gamma = 90^\\circ$ oprava zmizí.',
        'It is the Pythagorean theorem with a correction for the angle not being right. For $\\gamma = 90^\\circ$ the correction vanishes.',
      ),
      formal: L('$c^2 = a^2 + b^2 - 2ab\\cos\\gamma$.', '$c^2 = a^2 + b^2 - 2ab\\cos\\gamma$.'),
      it: L(
        'Skalární součin vektorů je kosinová věta v jiném zápisu: $\\vec u \\cdot \\vec v = |\\vec u||\\vec v|\\cos\\gamma$. Tak hra zjistí úhel mezi dvěma směry.',
        'The dot product of vectors is the law of cosines in other clothes: $\\vec u \\cdot \\vec v = |\\vec u||\\vec v|\\cos\\gamma$. That is how a game finds the angle between two directions.',
      ),
    },
    fit: ['ISM', 'ILG'],
  },
  {
    id: 'trigo.area',
    title: L('Obsah trojúhelníku a úlohy z praxe', 'Triangle area and applied problems'),
    summary: L(
      'Vypočítat obsah z dvou stran a úhlu a řešit praktické úlohy kombinací vět.',
      'Compute area from two sides and the included angle, and solve applied problems combining the laws.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 15,
    prereqs: ['trigo.sine-rule', 'trigo.cosine-rule'],
    why: {
      formal: L(
        '$S = \\frac{1}{2}ab\\sin\\gamma$ — výška na stranu $a$ je $b\\sin\\gamma$.',
        '$S = \\frac{1}{2}ab\\sin\\gamma$ — the height onto side $a$ is $b\\sin\\gamma$.',
      ),
    },
    fit: ['ISM'],
  },
];
