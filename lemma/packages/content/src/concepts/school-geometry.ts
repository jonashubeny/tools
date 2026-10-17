import { L, type Concept } from '@lemma/core';

/** Syllabus topics 16–17: planimetry and stereometry I. */
export const GEOMETRY_CONCEPTS: Concept[] = [
  {
    id: 'plan.angles',
    title: L('Úhly a trojúhelník', 'Angles and the triangle'),
    summary: L(
      'Používat vlastnosti úhlů u rovnoběžek a součet úhlů v trojúhelníku a mnohoúhelníku.',
      'Use angle properties of parallel lines and the angle sums of triangles and polygons.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 16,
    prereqs: ['alg.linear-eq'],
    why: {
      intuition: L(
        'Součet úhlů v trojúhelníku je $180^\\circ$, protože když vedeš vrcholem rovnoběžku s protější stranou, tři úhly se složí do přímého.',
        'The angles of a triangle sum to $180^\\circ$ because drawing a parallel to the opposite side through a vertex lines the three angles up into a straight angle.',
      ),
      formal: L(
        'Součet vnitřních úhlů $n$-úhelníku je $(n-2) \\cdot 180^\\circ$ — rozdělíš ho na $n-2$ trojúhelníků.',
        'The interior angles of an $n$-gon sum to $(n-2) \\cdot 180^\\circ$ — split it into $n-2$ triangles.',
      ),
    },
    terms: [
      { cs: 'střídavé, souhlasné úhly', en: 'alternate, corresponding angles' },
      { cs: 'vnitřní, vnější úhel', en: 'interior, exterior angle' },
    ],
    fit: [],
  },
  {
    id: 'plan.circle',
    title: L('Kružnice a úhly v ní', 'Circles and their angles'),
    summary: L(
      'Použít vztah středového a obvodového úhlu a Thaletovu větu.',
      'Apply the inscribed-angle theorem and Thales’ theorem.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 16,
    prereqs: ['plan.angles'],
    why: {
      formal: L(
        'Obvodový úhel je polovinou středového úhlu nad týmž obloukem. Thaletova věta je zvláštní případ: nad průměrem je obvodový úhel pravý.',
        'An inscribed angle is half the central angle on the same arc. Thales’ theorem is the special case: the angle on a diameter is a right angle.',
      ),
    },
    terms: [
      { cs: 'středový úhel', en: 'central angle' },
      { cs: 'obvodový úhel', en: 'inscribed angle' },
      { cs: 'Thaletova věta', en: "Thales' theorem" },
    ],
    fit: [],
  },
  {
    id: 'plan.similarity',
    title: L('Shodnost a podobnost', 'Congruence and similarity'),
    summary: L(
      'Rozhodnout o podobnosti trojúhelníků a z poměru podobnosti dopočítat délky a obsahy.',
      'Decide whether triangles are similar and use the scale factor to find lengths and areas.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 16,
    prereqs: ['plan.angles'],
    why: {
      intuition: L(
        'Podobné útvary jsou stejný obrázek v jiném měřítku. Délky se násobí $k$, obsahy $k^2$.',
        'Similar figures are the same picture at a different scale. Lengths multiply by $k$, areas by $k^2$.',
      ),
      it: L(
        'Obrázek zvětšený dvakrát má čtyřikrát tolik pixelů. Proto má snímek ve 4K (3840 × 2160) čtyřikrát víc pixelů než Full HD (1920 × 1080), ne dvakrát.',
        'An image scaled by two has four times the pixels. That is why a 4K frame (3840 × 2160) has four times the pixels of Full HD (1920 × 1080), not twice.',
      ),
    },
    terms: [
      { cs: 'poměr podobnosti', en: 'scale factor' },
      { cs: 'věty sss, sus, usu, uu', en: 'SSS, SAS, ASA, AA criteria' },
    ],
    fit: [],
  },
  {
    id: 'plan.area',
    title: L('Obvody a obsahy', 'Perimeters and areas'),
    summary: L(
      'Počítat obvody a obsahy trojúhelníků, čtyřúhelníků, kruhu a jeho částí.',
      'Compute perimeters and areas of triangles, quadrilaterals, circles and their parts.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 16,
    prereqs: ['geo.right-triangle'],
    why: {
      intuition: L(
        'Skoro každý vzorec pro obsah je obdélník v převleku: rovnoběžník je obdélník s posunutým vrškem, trojúhelník je půlka rovnoběžníku.',
        'Nearly every area formula is a rectangle in disguise: a parallelogram is a rectangle with its top slid over, a triangle is half a parallelogram.',
      ),
    },
    fit: [],
  },
  {
    id: 'ster.positions',
    title: L('Polohové vlastnosti v prostoru', 'Positions of lines and planes in space'),
    summary: L(
      'Určit vzájemnou polohu přímek a rovin v krychli a kvádru.',
      'Determine the mutual position of lines and planes in a cube or cuboid.',
    ),
    area: 'geometry',
    track: 'school',
    syllabusTopic: 17,
    prereqs: ['plan.angles'],
    why: {
      intuition: L(
        'V rovině jsou dvě přímky buď rovnoběžné, nebo se protnou. V prostoru přibývá třetí možnost: mimoběžky — neprotnou se, a přesto nejsou rovnoběžné.',
        'In a plane two lines are either parallel or they meet. Space adds a third option: skew lines — they never meet, yet are not parallel.',
      ),
      it: L(
        'Test „protíná paprsek tuto stěnu?“ je základ raycastingu i detekce kolizí. Je to přesně úloha o vzájemné poloze přímky a roviny.',
        'The test “does this ray hit this face?” is the core of raycasting and collision detection. It is exactly a question about the mutual position of a line and a plane.',
      ),
    },
    terms: [
      { cs: 'mimoběžky', en: 'skew lines' },
      { cs: 'rovnoběžné, různoběžné', en: 'parallel, intersecting' },
      { cs: 'řez tělesa', en: 'section of a solid' },
    ],
    fit: ['ILG'],
  },
];
