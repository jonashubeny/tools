import {
  type Area,
  type AssignmentKind,
  type BlockKind,
  type DiagnosticStage,
  type DiagnosticVerdict,
  type ErrorFamily,
  type ErrorType,
  type EstimateConfidence,
  type GateStatus,
  type LabTool,
  type MasteryLevel,
  type PathReason,
  type PathState,
  type PlanBlockDto,
  type PracticeContext,
  type ProblemKind,
  type ProblemWhyDto,
  type Purpose,
  type ReadinessVerdict,
  type RunKind,
  type SkillRole,
  type SlotFormat,
  type Track,
  type TutorMode,
  ERROR_INFO,
  L,
} from '@lemma/core';
import type { Translate } from './i18n';

/** Names for the app's own vocabulary. Content texts come from the server; these do not. */

export const LEVEL_NAMES: Record<MasteryLevel, L> = {
  0: L('nová', 'new'),
  1: L('představená', 'introduced'),
  2: L('procvičovaná', 'practising'),
  3: L('známá', 'familiar'),
  4: L('ovládnutá', 'proficient'),
  5: L('mistrovská', 'mastered'),
};

/** What each level means, in evidence terms. Shown wherever a level is explained. */
export const LEVEL_MEANING: Record<MasteryLevel, L> = {
  0: L('Zatím bez jakéhokoli důkazu.', 'No evidence yet.'),
  1: L('Máš za sebou výklad nebo první úlohu.', 'You have seen the lesson or tried a first problem.'),
  2: L(
    'Několik úloh za sebou; zatím to nic neříká o tom, jestli to umíš bez pomoci.',
    'A few problems done; it says nothing yet about doing it alone.',
  ),
  3: L(
    'Typové úlohy řešíš většinou samostatně — když víš, o jaké téma jde.',
    'You mostly solve the standard problems unaided — when you know what the topic is.',
  ),
  4: L(
    'Poznáš typ úlohy i ve směsi, zvládáš těžší varianty a vydrželo to přes pauzu.',
    'You recognise the problem type in a mix, handle harder variants, and it has survived a gap.',
  ),
  5: L(
    'Totéž na nejtěžších úlohách a po týdnu bez opakování, bez koncepční chyby.',
    'The same on the hardest problems and after a week away, without a conceptual error.',
  ),
};

export const AREA_NAMES: Record<Area, L> = {
  numbers: L('Čísla a počítání', 'Numbers and arithmetic'),
  data: L('Data a závislosti', 'Data and relationships'),
  algebra: L('Algebra', 'Algebra'),
  functions: L('Funkce', 'Functions'),
  explog: L('Exponenciály a logaritmy', 'Exponentials and logarithms'),
  trig: L('Goniometrie', 'Trigonometry'),
  complex: L('Komplexní čísla', 'Complex numbers'),
  geometry: L('Geometrie', 'Geometry'),
  reasoning: L('Logika a důkazy', 'Logic and proof'),
  discrete: L('Diskrétní matematika', 'Discrete mathematics'),
  computing: L('Matematika v počítačích', 'Mathematics in computing'),
};

export const TRACK_NAMES: Record<Track, L> = {
  school: L('Školní osnovy', 'School syllabus'),
  foundation: L('Základy z dřívějška', 'Earlier foundations'),
  reasoning: L('Rozšíření: uvažování', 'Enrichment: reasoning'),
  vut: L('Rozšíření: směr FIT', 'Enrichment: towards FIT'),
  basic: L('Učivo základní školy', 'Lower-secondary curriculum'),
};

export const TRACK_NOTES: Record<Track, L> = {
  school: L('Je v osnovách tvého ročníku.', 'On your year’s syllabus.'),
  foundation: L(
    'Není v letošních osnovách, ale letošní látka na tom stojí.',
    'Not on this year’s syllabus, but this year’s material stands on it.',
  ),
  reasoning: L('Není ve školních osnovách. Doporučení Lemmy.', 'Not on the school syllabus. Lemma’s recommendation.'),
  vut: L(
    'Není ve školních osnovách. Doporučení Lemmy s ohledem na FIT.',
    'Not on the school syllabus. Lemma’s recommendation with FIT in mind.',
  ),
  basic: L(
    'Z látky, ze které vychází jednotná přijímací zkouška.',
    'From the material the unified entrance examination draws on.',
  ),
};

export const KIND_NAMES: Record<ProblemKind, L> = {
  warmup: L('rozcvička', 'warm-up'),
  core: L('typová', 'core'),
  hard: L('těžší', 'hard'),
  boss: L('boss', 'boss'),
  speed: L('na rychlost', 'speed'),
  debug: L('najdi chybu', 'find the mistake'),
  reverse: L('obrácená', 'reverse'),
  applied: L('aplikovaná', 'applied'),
  programming: L('programátorská', 'programming'),
  estimate: L('odhad', 'estimate'),
  explain: L('vysvětli', 'explain'),
  graph: L('graf', 'graph'),
};

export const CONTEXT_NAMES: Record<PracticeContext, L> = {
  lesson: L('Kontrola v lekci', 'Lesson check'),
  blocked: L('Procvičování', 'Practice'),
  mixed: L('Smíšené opakování', 'Mixed review'),
  drill: L('Cílený trénink', 'Targeted drill'),
  challenge: L('Výzva', 'Challenge'),
  exam: L('Zkouška nanečisto', 'Mock exam'),
  diagnostic: L('Rozřazovací test', 'Placement test'),
};

/** A run is one context throughout, or a session that chooses as it goes. */
export const RUN_NAMES: Record<RunKind, L> = {
  ...CONTEXT_NAMES,
  adaptive: L('Adaptivní procvičování', 'Adaptive practice'),
};

export const BLOCK_NAMES: Record<BlockKind, L> = {
  review: L('Opakování', 'Review'),
  lesson: L('Nová látka', 'New material'),
  practice: L('Procvičování', 'Practice'),
  prereq: L('Zpevnit základ', 'Shore up a prerequisite'),
  challenge: L('Výzva', 'Challenge'),
  drill: L('Trénink proti chybám', 'Error drill'),
  mock: L('Test nanečisto', 'Mock test'),
  experiment: L('Experiment', 'Experiment'),
  diagnostic: L('Rozřazovací test', 'Placement test'),
  adaptive: L('Adaptivní procvičování', 'Adaptive practice'),
  assigned: L('Zadaná práce', 'Assigned work'),
};

// ------------------------------------------------------------- goals, paths and reasons

/** Where a skill stands on the learner's path. Always shown as a word, never as colour alone. */
export const PATH_NAMES: Record<PathState, L> = {
  'not-started': L('nezačato', 'not started'),
  diagnosed: L('rozřazeno', 'diagnosed'),
  learning: L('učení', 'learning'),
  practising: L('procvičování', 'practising'),
  consolidating: L('upevňování', 'consolidating'),
  mastered: L('zvládnuto', 'mastered'),
  'needs-review': L('k zopakování', 'needs review'),
};

/** The rule that put a skill in its state, in a sentence. */
export const PATH_REASONS: Record<PathReason, L> = {
  'no-evidence': L('Zatím bez jediné úlohy.', 'No problem tried yet.'),
  'placed-high': L(
    'Podle rozřazovacího testu to nejspíš umíš. Vlastní úlohy to ještě nepotvrdily.',
    'The placement test suggests you can do this. No problems of your own have confirmed it yet.',
  ),
  'placed-low': L('Rozřazovací test tu ukázal mezeru.', 'The placement test showed a gap here.'),
  'placed-unclear': L('Rozřazovací test tu nedal jasnou odpověď.', 'The placement test gave no clear answer here.'),
  introduced: L('První kroky: výklad nebo pár úloh.', 'First steps: the lesson or a few problems.'),
  familiar: L(
    'Typové úlohy řešíš bez pomoci, když víš, o jaké téma jde.',
    'You solve the standard problems unaided when you know what the topic is.',
  ),
  proficient: L(
    'Poznáš typ úlohy i ve směsi a vydrželo to přes pauzu. Chybí nejtěžší úlohy a delší odstup.',
    'You recognise the problem type in a mix and it has survived a gap. The hardest problems and a longer gap are missing.',
  ),
  'all-gates': L('Všechny důkazy jsou splněné.', 'Every piece of evidence is there.'),
  'review-due': L('Nastal čas si to připomenout.', 'It is time to recall it.'),
  fading: L('Podle odhadu se to začíná vytrácet z paměti.', 'By the estimate it is starting to fade from memory.'),
  'review-failed': L('Poslední opakování se nepovedlo.', 'The last review did not go well.'),
};

export const PURPOSE_NAMES: Record<Purpose, L> = {
  new: L('nová látka', 'new material'),
  repair: L('doplnění základu', 'repairing a gap'),
  consolidate: L('upevnění', 'consolidation'),
  review: L('opakování', 'review'),
  exam: L('jako u zkoušky', 'exam-style'),
  stretch: L('těžší výzva', 'stretch'),
  assigned: L('zadaná práce', 'assigned'),
  confidence: L('na rozjezd', 'a sure one'),
};

export const ROLE_NAMES: Record<SkillRole, L> = {
  tested: L('ve zkoušce', 'in the examination'),
  prerequisite: L('předpoklad', 'prerequisite'),
  enrichment: L('nad rámec zkoušky', 'beyond the examination'),
};

export const ROLE_NOTES: Record<SkillRole, L> = {
  tested: L(
    'V testech, které byly přečteny, se objevila úloha na tuhle dovednost, nebo ji uvádí specifikace pro tuto zkoušku.',
    'A task on this skill appeared in the tests that were read, or the specification for this examination lists it.',
  ),
  prerequisite: L(
    'Sama se takto nezkouší, ale stojí na ní to, co se zkouší.',
    'Not asked in this form itself, but what is asked stands on it.',
  ),
  enrichment: L(
    'Patří až k vyššímu ročníku. Nabídne se, až bude všechno zkoušené aspoň „známé“.',
    'It belongs to a later grade. It is offered once everything examined is at least “familiar”.',
  ),
};

export const CONFIDENCE_NAMES: Record<EstimateConfidence, L> = {
  none: L('bez dat', 'no data'),
  low: L('málo dat', 'little data'),
  medium: L('středně jisté', 'fairly sure'),
  high: L('dobře podložené', 'well supported'),
};

export const VERDICT_NAMES: Record<DiagnosticVerdict, L> = {
  strong: L('jisté', 'strong'),
  sound: L('v pořádku', 'sound'),
  shaky: L('nejisté', 'shaky'),
  gap: L('mezera', 'gap'),
  untested: L('nezkoušeno', 'not asked'),
};

export const VERDICT_NOTES: Record<DiagnosticVerdict, L> = {
  strong: L('Vyřešena běžná i těžší úloha.', 'Both the standard and the harder problem were solved.'),
  sound: L(
    'Běžná úloha vyřešena; těžší ne, nebo na ni nedošlo.',
    'The standard problem was solved; the harder one was not, or was not asked.',
  ),
  shaky: L('Běžná úloha ne, lehčí ano.', 'The standard problem was missed, the easier one solved.'),
  gap: L('Nepovedla se běžná ani lehčí úloha.', 'Neither the standard nor the easier problem was solved.'),
  untested: L('Na tuhle dovednost test nedošel.', 'The test did not get to this skill.'),
};

export const STAGE_NAMES: Record<DiagnosticStage, L> = {
  anchor: L('běžná úloha', 'standard problem'),
  'second-chance': L('druhá, lehčí', 'second, easier'),
  prerequisite: L('o krok níž', 'one step down'),
  harder: L('těžší', 'harder'),
};

export const READINESS_NAMES: Record<ReadinessVerdict, L> = {
  'no-data': L('Zatím není z čeho soudit', 'Nothing to judge from yet'),
  building: L('Staví se základ', 'The base is being built'),
  practising: L('Procvičování napříč látkou', 'Practising across the curriculum'),
  'test-ready': L('Je čas na test nanečisto', 'Time for a timed practice test'),
};

export const READINESS_NOTES: Record<ReadinessVerdict, L> = {
  'no-data': L(
    'Po rozřazovacím testu nebo prvních úlohách tu bude víc.',
    'There will be more here after the placement test or the first problems.',
  ),
  building: L(
    'Procvičena je zatím menší část toho, co zkouška obsahuje. Nejdřív pokrýt látku, test na čas až potom.',
    'A smaller part of what the examination contains has been practised so far. Cover the material first; a timed test comes later.',
  ),
  practising: L(
    'Větší část látky už je rozpracovaná. Test nanečisto dává smysl, až bude většina aspoň „známá“.',
    'Most of the material is under way. A timed practice test makes sense once most of it is at least “familiar”.',
  ),
  'test-ready': L(
    'Většina látky je procvičená a aspoň „známá“. Test na čas teď ukáže, jak to drží pohromadě.',
    'Most of the material has been practised and is at least “familiar”. A timed test now shows how it holds together.',
  ),
};

export const ASSIGNMENT_NAMES: Record<AssignmentKind, L> = {
  practice: L('Procvičování', 'Practice'),
  review: L('Opakování', 'Review'),
  remediation: L('Doplnění základu', 'Catching up'),
  lesson: L('Výklad a řešený příklad', 'Lesson and worked example'),
  test: L('Test nanečisto', 'Timed practice test'),
};

export const FORMAT_NAMES: Record<SlotFormat, L> = {
  open: L('otevřená', 'open'),
  choice: L('výběr z pěti', 'one of five'),
  truefalse: L('ano / ne', 'true / false'),
  matching: L('přiřazení', 'matching'),
};

/** Why a problem of an adaptive session was chosen, as one sentence. */
export function whyText(why: ProblemWhyDto, t: Translate): string {
  if (why.purpose === 'confidence')
    return t('Po dvou nezdarech něco, co obvykle vyjde.', 'After two misses, something that usually goes well.');
  if (why.purpose === 'assigned') return t('Je to součást zadané práce.', 'It is part of assigned work.');
  switch (why.because) {
    case 'unlock':
      return why.forSkill
        ? t(
            `Stojí na tom „${t(why.forSkill.title)}“ — nejdřív základ.`,
            `“${t(why.forSkill.title)}” stands on this — the foundation first.`,
          )
        : t('Stojí na tom další látka — nejdřív základ.', 'More material stands on this — the foundation first.');
    case 'review':
      return t('Je čas si to připomenout, než se to vytratí.', 'Time to recall it before it fades.');
    case 'errors':
      return t(
        'V posledních úlohách tu byly chyby v postupu nebo v porozumění.',
        'Recent attempts here had errors of procedure or understanding.',
      );
    case 'school':
      return t('Probíráte to teď ve škole.', 'Your class is on it now.');
    case 'info':
      return t('O téhle dovednosti toho zatím aplikace ví málo.', 'The app knows little about this skill so far.');
    case 'assigned':
      return t('Poznamenáno při doučování: vrátit se k tomu.', 'Noted in a tutoring session: come back to this.');
    default:
      break;
  }
  switch (why.purpose) {
    case 'new':
      return t(
        'Další nová látka, která má u zkoušky váhu.',
        'The next new material that carries weight in the examination.',
      );
    case 'repair':
      return t(
        'Tady je mezera, která u zkoušky stojí body.',
        'There is a gap here that costs points in the examination.',
      );
    case 'exam':
      return t(
        'Tohle už znáš — teď bez nápovědy, o jaké téma jde.',
        'You know this — now without being told what the topic is.',
      );
    case 'stretch':
      return t('Tohle ti jde; těžší úloha řekne víc.', 'This goes well for you; a harder problem tells more.');
    case 'review':
      return t('Je čas si to připomenout, než se to vytratí.', 'Time to recall it before it fades.');
    default:
      return t(
        'Rozpracovaná dovednost, která má u zkoušky váhu.',
        'A skill under way that carries weight in the examination.',
      );
  }
}

export const LENS_NAMES: Record<'intuition' | 'formal' | 'visual' | 'algebraic' | 'it', L> = {
  intuition: L('Intuice', 'Intuition'),
  formal: L('Formálně', 'Formally'),
  visual: L('Obrazem', 'Visually'),
  algebraic: L('Algebraicky', 'Algebraically'),
  it: L('V IT', 'In IT'),
};

export const FAMILY_NAMES: Record<ErrorFamily, L> = {
  slip: L('Nepozornost', 'Slips'),
  procedure: L('Postup', 'Procedure'),
  concept: L('Porozumění', 'Understanding'),
};

export const FAMILY_NOTES: Record<ErrorFamily, L> = {
  slip: L(
    'Víš, jak na to, ale něco uteklo. Léčí se návykem kontroly, ne dalším výkladem.',
    'You know how, but something slipped. The cure is a checking habit, not more explanation.',
  ),
  procedure: L(
    'Krok, který neplatí, nebo zapomenutá podmínka. Léčí se pravidlem a důvodem, proč platí.',
    'A step that is not valid, or a forgotten condition. The cure is the rule and why it holds.',
  ),
  concept: L(
    'Chybí samotná myšlenka. Léčí se návratem k výkladu a k předpokladům.',
    'The idea itself is missing. The cure is going back to the lesson and the prerequisites.',
  ),
};

/** Which categorical series slot each family wears, everywhere. */
export const FAMILY_COLOR: Record<ErrorFamily, string> = {
  slip: 'var(--series-1)',
  procedure: 'var(--series-2)',
  concept: 'var(--series-3)',
};

export const errorName = (type: ErrorType): L => ERROR_INFO[type].title;

export const LAB_NAMES: Record<LabTool, L> = {
  grapher: L('Graf funkce', 'Function grapher'),
  transform: L('Transformace grafu', 'Graph transformations'),
  linear: L('Lineární funkce', 'Linear function'),
  quadratic: L('Kvadratická funkce', 'Quadratic function'),
  absolute: L('Absolutní hodnota', 'Absolute value'),
  power: L('Mocninné funkce', 'Power functions'),
  inverse: L('Inverzní funkce', 'Inverse functions'),
  explog: L('Exponenciála a logaritmus', 'Exponential and logarithm'),
  unitcircle: L('Jednotková kružnice', 'Unit circle'),
  sinusoid: L('Sinusoida', 'Sinusoid'),
  complex: L('Komplexní rovina', 'Complex plane'),
};

export const LAB_BLURBS: Record<LabTool, L> = {
  grapher: L('Zadej předpis a dívej se, co dělá.', 'Type a formula and watch what it does.'),
  transform: L('Posuny, natažení a překlopení jednoho grafu.', 'Shifts, stretches and reflections of one graph.'),
  linear: L('Směrnice a posun: co který parametr dělá.', 'Slope and intercept: what each parameter does.'),
  quadratic: L(
    'Tři tvary jedné paraboly, vrchol, kořeny, diskriminant.',
    'Three forms of one parabola, its vertex, roots and discriminant.',
  ),
  absolute: L('Graf tvaru V a rovnice s absolutní hodnotou.', 'The V-shaped graph and equations with absolute value.'),
  power: L(
    'x na n-tou pro kladné, záporné a lomené exponenty.',
    'x to the n for positive, negative and fractional exponents.',
  ),
  inverse: L(
    'Zrcadlení podle osy prvního kvadrantu a kdy inverze existuje.',
    'Mirroring in the line y = x, and when an inverse exists.',
  ),
  explog: L('Růst, rozpad a logaritmus jako jeho zrcadlo.', 'Growth, decay and the logarithm as its mirror.'),
  unitcircle: L('Odkud se berou sinus a kosinus.', 'Where sine and cosine come from.'),
  sinusoid: L('Amplituda, perioda, fáze — a jak zní.', 'Amplitude, period, phase — and what it sounds like.'),
  complex: L('Sčítání a násobení jako posun a otočení.', 'Addition and multiplication as shifting and turning.'),
};

export const TUTOR_MODE_NAMES: Record<TutorMode, L> = {
  socratic: L('Sokratovsky', 'Socratic'),
  simple: L('Vysvětli jednoduše', 'Explain simply'),
  formal: L('Vysvětli formálně', 'Explain formally'),
  hint: L('Jen nápověda', 'Just a hint'),
  check: L('Zkontroluj řešení', 'Check my solution'),
  mistake: L('Najdi mou chybu', 'Find my mistake'),
  challenge: L('Dej mi výzvu', 'Challenge me'),
  programming: L('Propoj s programováním', 'Connect to programming'),
  reallife: L('Propoj s praxí', 'Connect to real life'),
  oral: L('Zkoušení u tabule', 'Oral exam'),
};

export const TUTOR_MODE_HINTS: Record<TutorMode, L> = {
  socratic: L('Vede tě otázkami; odpověď neřekne.', 'Leads with questions; does not give the answer.'),
  simple: L('Myšlenka obyčejnými slovy a jeden příklad.', 'The idea in plain words with one example.'),
  formal: L('Přesná definice, podmínky, zdůvodnění.', 'Precise definition, conditions, justification.'),
  hint: L('Jedna nejmenší nápověda, nic víc.', 'One smallest hint, nothing more.'),
  check: L('Vlož svůj postup; ověří ho řádek po řádku.', 'Paste your working; it is verified line by line.'),
  mistake: L(
    'Najde první chybný krok a řekne, jakého je druhu.',
    'Finds the first wrong step and says what kind it is.',
  ),
  challenge: L('Jedna ověřená úloha kousek nad tvou úrovní.', 'One verified problem a little above your level.'),
  programming: L('Kde se to objevuje v kódu a v systémech.', 'Where it shows up in code and systems.'),
  reallife: L('Kde to dělá skutečnou práci.', 'Where it does real work.'),
  oral: L('Otázka po otázce jako u tabule.', 'Question by question, as at the board.'),
};

/** One evidence gate as a sentence, with where the learner stands. */
export function gateText(gate: GateStatus, level: MasteryLevel, t: Translate): { label: string; value: string } {
  const count = `${Math.min(gate.have, gate.need)} / ${gate.need}`;
  switch (gate.key) {
    case 'attempts':
      return { label: t('Vyřešené úlohy', 'Problems worked'), value: count };
    case 'ability':
      return {
        label: t('Obtížnost, kterou spolehlivě zvládáš', 'Difficulty you handle reliably'),
        value: `${gate.have.toFixed(1)} / ${gate.need.toFixed(1)}`,
      };
    case 'recent':
      return {
        label: t('Poslední úlohy bez pomoci', 'Recent problems without help'),
        value: `${Math.round(gate.have * 100)} % / ${Math.round(gate.need * 100)} %`,
      };
    case 'mixed':
      return {
        label: t(
          'Samostatně ve smíšeném opakování (téma předem neznáš)',
          'Unaided in mixed review (topic not announced)',
        ),
        value: count,
      };
    case 'delay':
      return {
        label:
          level >= 5
            ? t('Správně po týdnu bez opakování', 'Correct after a week away')
            : t('Správně po aspoň dvou dnech pauzy', 'Correct after at least two days away'),
        value: gate.done ? t('ano', 'yes') : t('zatím ne', 'not yet'),
      };
    case 'hard': {
      // The level asked for is capped by the hardest problems this skill has.
      const usual = level >= 5 ? 4 : 3;
      const asked = gate.level ?? usual;
      const capped =
        asked < usual ? t(' (těžší tato dovednost zatím nemá)', ' (the hardest this skill has so far)') : '';
      return {
        label: `${t(`Úloha úrovně ${asked} nebo vyšší bez pomoci`, `A problem of level ${asked} or higher without help`)}${capped}`,
        value: gate.done ? t('ano', 'yes') : t('zatím ne', 'not yet'),
      };
    }
    case 'variety':
      return {
        label: t(
          'Bez pomoci v různých typech úloh, ne jen v jednom',
          'Unaided in different kinds of problem, not just one',
        ),
        value: count,
      };
    case 'clean':
      return {
        label: t('Poslední úlohy bez koncepční chyby', 'Recent problems free of conceptual errors'),
        value: gate.done ? t('ano', 'yes') : t('zatím ne', 'not yet'),
      };
  }
}

/** Why a block is in today's plan, from the reason the planner recorded. */
export function reasonText(block: PlanBlockDto, t: Translate, titleOf: (id: string) => string): string {
  const d = block.reason.data;
  const n = (key: string): number => (typeof d[key] === 'number' ? (d[key] as number) : 0);
  const s = (key: string): string => (typeof d[key] === 'string' ? titleOf(d[key] as string) : '');
  switch (block.reason.code) {
    case 'review-due':
      return n('overdueDays') > 0
        ? t(
            `Na opakování čeká ${n('count')} dovedností; nejstarší ${n('overdueDays')} dní po termínu. Krátké připomenutí teď ušetří učení od nuly později.`,
            `${n('count')} skills are due for review; the oldest is ${n('overdueDays')} days overdue. A short recall now saves relearning from scratch later.`,
          )
        : t(
            `Na opakování čeká ${n('count')} dovedností. Vybavit si je těsně před zapomenutím je nejúčinnější.`,
            `${n('count')} skills are due for review. Recalling them just before forgetting is when it works best.`,
          );
    case 'review-test':
      return t(
        `Test je ${dayWord(n('inDays'), 'cs')}. Opakování toho, co v něm bude, namíchané dohromady.`,
        `The test is ${dayWord(n('inDays'), 'en')}. A mixed review of what it will cover.`,
      );
    case 'lesson-next':
      return t(
        'Další nová látka v kapitole, kterou právě probíráte.',
        'The next new material in the chapter your class is on.',
      );
    case 'practice-weakest':
      return t(
        `Nejslabší místo aktuální kapitoly (úroveň ${n('level')} z 5).`,
        `The weakest spot in the current chapter (level ${n('level')} of 5).`,
      );
    case 'practice-test':
      return t(
        `Test je ${dayWord(n('inDays'), 'cs')}. Tohle je z toho, co v něm bude, nejslabší (úroveň ${n('level')} z 5).`,
        `The test is ${dayWord(n('inDays'), 'en')}. Of what it will cover, this is the weakest (level ${n('level')} of 5).`,
      );
    case 'practice-keep-fresh':
      return t(
        'Kapitolu máš zvládnutou; tohle ji udržuje při životě.',
        'You have the chapter in hand; this keeps it alive.',
      );
    case 'prereq-weak':
      return t(
        `„${s('skill')}“ na tomhle stojí a zatím je to na úrovni ${n('level')} z 5. Nejdřív základ.`,
        `“${s('skill')}” stands on this, and it is at level ${n('level')} of 5. Foundation first.`,
      );
    case 'challenge-ready':
      return t(
        `Na úrovni ${n('level')} z 5 už typové úlohy nic nového neřeknou. Jedna těžší.`,
        `At level ${n('level')} of 5 the standard problems tell you nothing new. One harder one.`,
      );
    case 'drill-pattern': {
      const type =
        typeof d.errorType === 'string' && d.errorType in ERROR_INFO
          ? t(ERROR_INFO[d.errorType as ErrorType].title)
          : '';
      return t(
        `Chyba „${type}“ se v posledních úlohách objevila ${n('count')}×. Dá se natrénovat.`,
        `“${type}” came up ${n('count')} times in recent problems. It can be trained.`,
      );
    }
    case 'mock-before-test':
      return t(
        `Test je ${dayWord(n('inDays'), 'cs')}. Krátká zkouška na čas ukáže, co ještě nesedí.`,
        `The test is ${dayWord(n('inDays'), 'en')}. A short timed run shows what does not sit yet.`,
      );
    case 'experiment-see-it':
      return t(
        'Volitelně: podívej se, jak se to chová, když hýbeš parametry.',
        'Optional: see how it behaves when you move the parameters.',
      );
    case 'diagnostic-first':
      return t(
        'Krátký test napříč látkou ukáže, odkud začít — bez něj by všechno začínalo úplně od začátku. Nic se neznámkuje a „tohle neumím“ je v pořádku.',
        'A short test across the curriculum shows where to start — without it everything would begin at the very beginning. Nothing is graded, and “I do not know this” is fine.',
      );
    case 'adaptive-mix': {
      const picks = [1, 2, 3]
        .filter((i) => typeof d[`s${i}`] === 'string')
        .map((i) => {
          const purpose = d[`p${i}`];
          const name =
            typeof purpose === 'string' && purpose in PURPOSE_NAMES ? t(PURPOSE_NAMES[purpose as Purpose]) : '';
          return name ? `${s(`s${i}`)} (${name})` : s(`s${i}`);
        });
      const due = n('due') > 0 ? t(` Na opakování čeká ${n('due')}.`, ` ${n('due')} due for review.`) : '';
      return t(
        `Úlohy se vybírají jedna po druhé podle toho, co teď nejvíc pomůže. Právě je to hlavně: ${picks.join(', ')}.${due}`,
        `Problems are chosen one at a time by what helps most right now. At the moment that is mainly: ${picks.join(', ')}.${due}`,
      );
    }
    case 'assigned-by-teacher':
      return t('Tohle ti bylo zadáno.', 'This was set for you.');
    case 'mock-ready':
      return t(
        'Většina látky je procvičená. Test na čas ukáže, jak to drží pohromadě — a co ještě ne.',
        'Most of the material has been practised. A timed test shows how it holds together — and what does not yet.',
      );
  }
}

function dayWord(days: number, locale: 'cs' | 'en'): string {
  if (locale === 'cs')
    return days <= 0 ? 'dnes' : days === 1 ? 'zítra' : days < 5 ? `za ${days} dny` : `za ${days} dní`;
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}
