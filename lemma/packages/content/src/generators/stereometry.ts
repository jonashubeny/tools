import { L, type FigureSpec, type Generator, type Rng } from '@lemma/core';
import { gen, mc, step } from './helpers';

/**
 * Syllabus topic 17: positions of lines and planes, on the cube ABCDEFGH.
 *
 * Nothing here is tabulated. Every position is computed from coordinates, so a question
 * and its answer cannot disagree: the bottom face is ABCD, the top face EFGH, and E lies
 * above A.
 */

type V3 = [number, number, number];

const VERTEX: Record<string, V3> = {
  A: [0, 0, 0],
  B: [1, 0, 0],
  C: [1, 1, 0],
  D: [0, 1, 0],
  E: [0, 0, 1],
  F: [1, 0, 1],
  G: [1, 1, 1],
  H: [0, 1, 1],
};
const NAMES = Object.keys(VERTEX);
const EDGES = ['AB', 'BC', 'CD', 'DA', 'EF', 'FG', 'GH', 'HE', 'AE', 'BF', 'CG', 'DH'];

const sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: V3, q: V3): number => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const isZero = (p: V3): boolean => p.every((value) => Math.abs(value) < 1e-9);
const at = (name: string): V3 => VERTEX[name]!;

/** Every line through two vertices of the cube, as a two-letter name. */
const LINES: string[] = NAMES.flatMap((p, i) => NAMES.slice(i + 1).map((q) => p + q));

type LineKind = 'edge' | 'face' | 'body';
function kindOf(line: string): LineKind {
  const d = sub(at(line[1]!), at(line[0]!));
  const length2 = dot(d, d);
  return length2 === 1 ? 'edge' : length2 === 2 ? 'face' : 'body';
}

type LinePosition = 'identical' | 'parallel' | 'intersecting' | 'skew';
function positionOfLines(first: string, second: string): LinePosition {
  const [p1, p2] = [at(first[0]!), at(second[0]!)];
  const [d1, d2] = [sub(at(first[1]!), p1), sub(at(second[1]!), p2)];
  const normal = cross(d1, d2);
  if (isZero(normal)) return isZero(cross(sub(p2, p1), d1)) ? 'identical' : 'parallel';
  return Math.abs(dot(sub(p2, p1), normal)) < 1e-9 ? 'intersecting' : 'skew';
}

/** Where two intersecting lines meet. */
function meetingPoint(first: string, second: string): V3 {
  const [p1, p2] = [at(first[0]!), at(second[0]!)];
  const [d1, d2] = [sub(at(first[1]!), p1), sub(at(second[1]!), p2)];
  const normal = cross(d1, d2);
  const s = dot(cross(sub(p2, p1), d2), normal) / dot(normal, normal);
  return [p1[0] + s * d1[0], p1[1] + s * d1[1], p1[2] + s * d1[2]];
}

/** A point of the cube named the way a person would name it. */
function pointName(point: V3): L {
  const vertex = NAMES.find((name) => isZero(sub(at(name), point)));
  if (vertex) return L(`bod $${vertex}$`, `the point $${vertex}$`);
  const halves = point.filter((value) => Math.abs(value - 0.5) < 1e-9).length;
  if (halves === 3) return L('střed krychle', 'the centre of the cube');
  const face = halves === 2 ? FACES.find((name) => inPlane(point, name)) : undefined;
  if (face) return L(`střed stěny $${face}$`, `the centre of the face $${face}$`);
  return L('jeden bod', 'a single point');
}

/** The six faces and the six diagonal planes, each named by all four of its vertices in order around it. */
const FACES = ['ABCD', 'EFGH', 'ABFE', 'DCGH', 'ADHE', 'BCGF'];
const DIAGONAL_PLANES = ['ACGE', 'BDHF', 'ABGH', 'CDEF', 'ADGF', 'BCHE'];

function normalOf(plane: string): V3 {
  return cross(sub(at(plane[1]!), at(plane[0]!)), sub(at(plane[2]!), at(plane[0]!)));
}

function inPlane(point: V3, plane: string): boolean {
  return Math.abs(dot(sub(point, at(plane[0]!)), normalOf(plane))) < 1e-9;
}

/** A plane is quoted by three of its points, as in school: "rovina ABC". */
const short = (plane: string): string => plane.slice(0, 3);

type LinePlanePosition = 'inside' | 'parallel' | 'crossing';
function positionOfLineAndPlane(line: string, plane: string): LinePlanePosition {
  const direction = sub(at(line[1]!), at(line[0]!));
  if (Math.abs(dot(direction, normalOf(plane))) > 1e-9) return 'crossing';
  return inPlane(at(line[0]!), plane) ? 'inside' : 'parallel';
}

/** Where a line crosses a plane. */
function piercingPoint(line: string, plane: string): V3 {
  const p = at(line[0]!);
  const d = sub(at(line[1]!), p);
  const n = normalOf(plane);
  const s = dot(sub(at(plane[0]!), p), n) / dot(d, n);
  return [p[0] + s * d[0], p[1] + s * d[1], p[2] + s * d[2]];
}

// ----------------------------------------------------------------------------- drawing

/** Oblique projection: the y-axis runs back and to the right. */
const project = ([x, y, z]: V3): [number, number] => [x + 0.5 * y, z + 0.36 * y];

function cubeFigure(lines: string[] = [], plane?: string): FigureSpec {
  const centre = project([0.5, 0.5, 0.5]);
  const colors = ['a', 'b'] as const;
  const polygon = (): [number, number][] => {
    // The plane's vertices in order around their centre, so the outline does not cross itself.
    const points = plane!.split('').map((name) => project(at(name)));
    const [cx, cy] = [
      points.reduce((sum, p) => sum + p[0], 0) / points.length,
      points.reduce((sum, p) => sum + p[1], 0) / points.length,
    ];
    return points.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
  };
  return {
    view: { xMin: -0.3, xMax: 1.8, yMin: -0.25, yMax: 1.6 },
    aspect: 0.88,
    maxWidth: 420,
    bare: true,
    polygons: plane ? [{ points: polygon(), color: 'c' }] : [],
    segments: [
      // Edges that meet at D are hidden behind the cube.
      ...EDGES.map((edge) => ({
        from: project(at(edge[0]!)),
        to: project(at(edge[1]!)),
        color: 'muted' as const,
        dashed: edge.includes('D'),
      })),
      ...lines.map((line, index) => ({
        from: project(at(line[0]!)),
        to: project(at(line[1]!)),
        color: colors[index % 2]!,
      })),
    ],
    labels: NAMES.map((name) => {
      const [x, y] = project(at(name));
      const away = Math.hypot(x - centre[0], y - centre[1]);
      return { x: x + ((x - centre[0]) / away) * 0.11, y: y + ((y - centre[1]) / away) * 0.11, text: name };
    }),
  };
}

const CUBE = L(
  'V krychli $ABCDEFGH$ (dolní stěna $ABCD$, vrchol $E$ nad $A$)',
  'In the cube $ABCDEFGH$ (bottom face $ABCD$, vertex $E$ above $A$)',
);

const LINE_OPTION: Record<Exclude<LinePosition, 'identical'>, L> = {
  parallel: L('rovnoběžné (různé)', 'parallel (and distinct)'),
  intersecting: L('různoběžné', 'intersecting'),
  skew: L('mimoběžné', 'skew'),
};

/** Pick a random element satisfying a condition; the pool is shuffled so every seed gets a fair choice. */
function pickWhere<T>(r: Rng, pool: readonly T[], holds: (item: T) => boolean): T {
  const found = r.shuffle(pool).find(holds);
  if (found === undefined) throw new Error('no candidate satisfies the condition');
  return found;
}

export const STEREOMETRY_GENERATORS: Generator[] = [
  gen({
    id: 'ster.positions.lines',
    concept: 'ster.positions',
    kind: 'core',
    levels: [1, 2, 3],
    title: L('Vzájemná poloha dvou přímek', 'The mutual position of two lines'),
    tags: ['annual-review'],
    est: (lv) => 40 + 15 * lv,
    make(r, lv) {
      const allowed = (line: string): boolean =>
        lv === 1 ? kindOf(line) === 'edge' : lv === 2 ? kindOf(line) !== 'body' : true;
      // The harder levels must actually contain a diagonal.
      const needs = (first: string, second: string): boolean =>
        lv === 1
          ? true
          : lv === 2
            ? kindOf(first) === 'face' || kindOf(second) === 'face'
            : kindOf(first) === 'body' || kindOf(second) === 'body';
      const pool = LINES.filter(allowed);
      const target = r.pick(['parallel', 'intersecting', 'skew'] as const);
      const pairs = pool.flatMap((first, i) => pool.slice(i + 1).map((second) => [first, second] as const));
      // Body diagonals are never parallel to anything else; fall back to another position then.
      const usable = pairs.filter(([first, second]) => needs(first, second));
      const candidates = usable.filter(([first, second]) => positionOfLines(first, second) === target);
      const [first, second] = r.pick(
        candidates.length > 0 ? candidates : usable.filter(([p, q]) => positionOfLines(p, q) === 'skew'),
      );
      const position = positionOfLines(first, second) as Exclude<LinePosition, 'identical'>;
      const meet = position === 'intersecting' ? pointName(meetingPoint(first, second)) : null;
      const plane = [...FACES, ...DIAGONAL_PLANES].find((name) =>
        [first, second].every((line) => inPlane(at(line[0]!), name) && inPlane(at(line[1]!), name)),
      );
      const reason =
        position === 'parallel'
          ? L(
              `Obě přímky mají stejný směr a nemají společný bod${plane ? ` (leží v rovině $${short(plane)}$)` : ''}.`,
              `Both lines have the same direction and no common point${plane ? ` (they lie in the plane $${short(plane)}$)` : ''}.`,
            )
          : position === 'intersecting'
            ? L(
                `Přímky leží v jedné rovině${plane ? ` ($${short(plane)}$)` : ''}, nejsou rovnoběžné a protínají se: jejich průsečík je ${meet!.cs}.`,
                `The lines lie in one plane${plane ? ` ($${short(plane)}$)` : ''}, are not parallel, and meet: their intersection is ${meet!.en}.`,
              )
            : L(
                'Přímky nemají stejný směr, a přesto se neprotnou — neexistuje rovina, která by obsahovala obě.',
                'The lines do not have the same direction and yet never meet — no plane contains them both.',
              );
      return {
        prompt: L(
          `${CUBE.cs} určete vzájemnou polohu přímek $${first}$ a $${second}$.`,
          `${CUBE.en}, determine the mutual position of the lines $${first}$ and $${second}$.`,
        ),
        figure: cubeFigure([first, second]),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: (['parallel', 'intersecting', 'skew'] as const).map((id) => ({ id, text: LINE_OPTION[id] })),
          correct: [position],
        },
        hints: [
          L(
            'Nejdřív: mají přímky stejný směr? Pokud ano, jsou rovnoběžné.',
            'First: do the lines have the same direction? If so, they are parallel.',
          ),
          L(
            'Pokud ne: najdeš rovinu (stěnu nebo úhlopříčný řez), ve které leží obě? Pak se protínají. Když taková rovina není, jsou mimoběžné.',
            'If not: can you find a plane (a face or a diagonal section) containing both? Then they intersect. If there is no such plane, they are skew.',
          ),
        ],
        solution: [
          { text: reason },
          step(
            'Přímky jsou tedy:',
            'So the lines are:',
            L(`\\text{${LINE_OPTION[position].cs}}`, `\\text{${LINE_OPTION[position].en}}`),
          ),
        ],
        misconceptions: [
          ...(position === 'skew'
            ? [
                mc(
                  'parallel',
                  'concept',
                  'Rovnoběžky musí mít stejný směr. „Neprotínají se“ v prostoru nestačí — to splňují i mimoběžky.',
                  'Parallel lines must have the same direction. “They do not meet” is not enough in space — skew lines do not meet either.',
                ),
                mc(
                  'intersecting',
                  'graph',
                  'Na obrázku se úsečky mohou křížit, ale v prostoru jedna vede před druhou. Najdi rovinu, ve které by ležely obě.',
                  'In the drawing the segments may cross, but in space one passes in front of the other. Look for a plane containing both.',
                ),
              ]
            : []),
          ...(position === 'intersecting'
            ? [
                mc(
                  'skew',
                  'concept',
                  `Přímky nekončí ve vrcholech — jsou nekonečné. Obě leží v jedné rovině${plane ? ` ($${short(plane)}$)` : ''}, a tam se protnou.`,
                  `Lines do not stop at the vertices — they are infinite. Both lie in one plane${plane ? ` ($${short(plane)}$)` : ''}, and there they meet.`,
                ),
                mc('parallel', 'concept', 'Směry přímek jsou různé.', 'The directions of the lines differ.'),
              ]
            : []),
          ...(position === 'parallel'
            ? [
                mc(
                  'skew',
                  'concept',
                  'Přímky mají stejný směr, takže jimi lze proložit rovinu: jsou rovnoběžné.',
                  'The lines have the same direction, so a plane passes through both: they are parallel.',
                ),
                mc(
                  'intersecting',
                  'concept',
                  'Přímky se stejným směrem se neprotnou.',
                  'Lines with the same direction do not meet.',
                ),
              ]
            : []),
        ],
      };
    },
  }),

  gen({
    id: 'ster.positions.line-plane',
    concept: 'ster.positions',
    kind: 'core',
    levels: [2, 3],
    title: L('Vzájemná poloha přímky a roviny', 'The mutual position of a line and a plane'),
    est: (lv) => 55 + 20 * (lv - 2),
    make(r, lv) {
      const planes = lv === 2 ? FACES : [...FACES, ...DIAGONAL_PLANES];
      const lines = LINES.filter((line) => (lv === 2 ? kindOf(line) !== 'body' : true));
      const target = r.pick(['inside', 'parallel', 'crossing'] as const);
      const all = planes.flatMap((plane) => lines.map((line) => [line, plane] as const));
      const [line, plane] = pickWhere(
        r,
        all,
        ([candidate, where]) =>
          positionOfLineAndPlane(candidate, where) === target &&
          (lv === 2 || DIAGONAL_PLANES.includes(where) || kindOf(candidate) !== 'edge'),
      );
      const options = [
        { id: 'inside', text: L('přímka leží v rovině', 'the line lies in the plane') },
        {
          id: 'parallel',
          text: L(
            'přímka je s rovinou rovnoběžná a neleží v ní',
            'the line is parallel to the plane and does not lie in it',
          ),
        },
        {
          id: 'crossing',
          text: L(
            'přímka je s rovinou různoběžná (protíná ji v jednom bodě)',
            'the line intersects the plane (in exactly one point)',
          ),
        },
      ];
      // A line of the plane with the same direction shows that the line is parallel to it.
      const witness = LINES.find(
        (other) =>
          other !== line &&
          inPlane(at(other[0]!), plane) &&
          inPlane(at(other[1]!), plane) &&
          ['parallel', 'identical'].includes(positionOfLines(line, other)),
      );
      const reason =
        target === 'inside'
          ? L(
              `Oba body $${line[0]}$ i $${line[1]}$ leží v rovině $${short(plane)}$, proto v ní leží celá přímka.`,
              `Both points $${line[0]}$ and $${line[1]}$ lie in the plane $${short(plane)}$, so the whole line does.`,
            )
          : target === 'parallel'
            ? L(
                `Přímka $${line}$ je rovnoběžná s přímkou $${witness}$, která v rovině leží, a sama v rovině neleží.`,
                `The line $${line}$ is parallel to the line $${witness}$, which lies in the plane, and does not lie in the plane itself.`,
              )
            : L(
                `Přímka není rovnoběžná s žádnou přímkou roviny. Protíná ji v jediném bodě: je to ${pointName(piercingPoint(line, plane)).cs}.`,
                `The line is parallel to no line of the plane. It meets the plane in a single point: ${pointName(piercingPoint(line, plane)).en}.`,
              );
      return {
        prompt: L(
          `${CUBE.cs} určete vzájemnou polohu přímky $${line}$ a roviny $${short(plane)}$.`,
          `${CUBE.en}, determine the mutual position of the line $${line}$ and the plane $${short(plane)}$.`,
        ),
        figure: cubeFigure([line], plane),
        answer: { kind: 'choice', fixedOrder: true, options, correct: [target] },
        hints: [
          L(
            'Leží oba body přímky v rovině? Pak v ní leží celá.',
            'Do both points of the line lie in the plane? Then the whole line does.',
          ),
          L(
            'Jinak hledej v rovině přímku rovnoběžnou s danou přímkou. Najdeš-li ji, je přímka s rovinou rovnoběžná; jinak ji protíná.',
            'Otherwise look in the plane for a line parallel to the given one. If there is one, the line is parallel to the plane; otherwise it meets it.',
          ),
        ],
        solution: [{ text: reason }],
        misconceptions: [
          ...(target === 'crossing'
            ? [
                mc(
                  'parallel',
                  'concept',
                  'Rovina nekončí na stěně krychle a přímka nekončí ve vrcholu. Po prodloužení se protnou.',
                  'A plane does not end at the face of the cube, nor a line at a vertex. Extended, they meet.',
                ),
              ]
            : []),
          ...(target === 'parallel'
            ? [
                mc(
                  'crossing',
                  'concept',
                  `V rovině leží přímka $${witness}$ rovnoběžná s $${line}$, takže se s rovinou nikdy neprotne.`,
                  `The plane contains the line $${witness}$ parallel to $${line}$, so the line never meets the plane.`,
                ),
              ]
            : []),
          ...(target === 'inside'
            ? [
                mc(
                  'crossing',
                  'concept',
                  'Přímka má s rovinou společné aspoň dva body, a pak v ní leží celá.',
                  'The line shares at least two points with the plane, and then it lies in it entirely.',
                ),
                mc(
                  'parallel',
                  'concept',
                  'Přímka má s rovinou společné body, není tedy „mimo“ ni.',
                  'The line shares points with the plane, so it is not “outside” it.',
                ),
              ]
            : []),
        ],
      };
    },
  }),

  gen({
    id: 'ster.positions.planes',
    concept: 'ster.positions',
    kind: 'core',
    levels: [2, 3],
    title: L('Vzájemná poloha dvou rovin', 'The mutual position of two planes'),
    est: (lv) => 60 + 30 * (lv - 2),
    make(r, lv) {
      const planes = [...FACES, ...DIAGONAL_PLANES];
      const pairs = planes.flatMap((first, i) => planes.slice(i + 1).map((second) => [first, second] as const));
      const shared = (first: string, second: string): string[] =>
        NAMES.filter((name) => inPlane(at(name), first) && inPlane(at(name), second));
      const parallel = (first: string, second: string): boolean => isZero(cross(normalOf(first), normalOf(second)));
      if (lv === 2) {
        const wantParallel = r.bool(0.4);
        const [first, second] = pickWhere(
          r,
          pairs,
          ([p, q]) => parallel(p, q) === wantParallel && (wantParallel || shared(p, q).length === 2),
        );
        const line = shared(first, second).join('');
        return {
          prompt: L(
            `${CUBE.cs} určete vzájemnou polohu rovin $${short(first)}$ a $${short(second)}$.`,
            `${CUBE.en}, determine the mutual position of the planes $${short(first)}$ and $${short(second)}$.`,
          ),
          figure: cubeFigure([], first),
          answer: {
            kind: 'choice',
            fixedOrder: true,
            options: [
              { id: 'parallel', text: L('rovnoběžné (různé)', 'parallel (and distinct)') },
              { id: 'crossing', text: L('různoběžné (protínají se v přímce)', 'intersecting (in a line)') },
            ],
            correct: [wantParallel ? 'parallel' : 'crossing'],
          },
          hints: [
            L(
              'Dvě různé roviny jsou buď rovnoběžné, nebo se protínají v přímce. Jiná možnost není.',
              'Two distinct planes are either parallel or meet in a line. There is no other option.',
            ),
            L(
              'Mají roviny nějaký společný bod? Projdi vrcholy krychle.',
              'Do the planes have a common point? Go through the vertices of the cube.',
            ),
          ],
          solution: [
            wantParallel
              ? step(
                  `Roviny nemají žádný společný bod — jsou to protější stěny krychle.`,
                  `The planes have no common point — they are opposite faces of the cube.`,
                )
              : step(
                  `Roviny mají společné body $${line[0]}$ a $${line[1]}$, protínají se tedy v přímce $${line}$.`,
                  `The planes share the points $${line[0]}$ and $${line[1]}$, so they meet in the line $${line}$.`,
                ),
          ],
          misconceptions: [
            wantParallel
              ? mc(
                  'crossing',
                  'concept',
                  'Rovnoběžné roviny se neprotnou ani po prodloužení.',
                  'Parallel planes never meet, however far they are extended.',
                )
              : mc(
                  'parallel',
                  'concept',
                  `Roviny mají společný bod (například $${line[0]}$), takže rovnoběžné nejsou.`,
                  `The planes have a common point (for instance $${line[0]}$), so they are not parallel.`,
                ),
          ],
        };
      }
      const [first, second] = pickWhere(
        r,
        pairs,
        ([p, q]) =>
          !parallel(p, q) && shared(p, q).length === 2 && (DIAGONAL_PLANES.includes(p) || DIAGONAL_PLANES.includes(q)),
      );
      const line = shared(first, second).join('');
      // Distractors: lines that lie in exactly one of the two planes.
      const inFirst = pickWhere(
        r,
        LINES,
        (other) =>
          other !== line &&
          inPlane(at(other[0]!), first) &&
          inPlane(at(other[1]!), first) &&
          !(inPlane(at(other[0]!), second) && inPlane(at(other[1]!), second)),
      );
      const inSecond = pickWhere(
        r,
        LINES,
        (other) =>
          other !== line &&
          other !== inFirst &&
          inPlane(at(other[0]!), second) &&
          inPlane(at(other[1]!), second) &&
          !(inPlane(at(other[0]!), first) && inPlane(at(other[1]!), first)),
      );
      const liesIn = (other: string, plane: string): boolean =>
        inPlane(at(other[0]!), plane) && inPlane(at(other[1]!), plane);
      // Preferably a line with the right direction; otherwise any line outside both planes.
      const off = LINES.filter((other) => !liesIn(other, first) && !liesIn(other, second));
      const outside = r.pick(
        off.some((other) => positionOfLines(other, line) === 'parallel')
          ? off.filter((other) => positionOfLines(other, line) === 'parallel')
          : off,
      );
      const sameDirection = positionOfLines(outside, line) === 'parallel';
      const options = r.shuffle([line, inFirst, inSecond, outside]);
      return {
        prompt: L(
          `${CUBE.cs} určete průsečnici rovin $${short(first)}$ a $${short(second)}$.`,
          `${CUBE.en}, find the line in which the planes $${short(first)}$ and $${short(second)}$ meet.`,
        ),
        figure: cubeFigure([], first),
        answer: {
          kind: 'choice',
          fixedOrder: true,
          options: options.map((name) => ({ id: name, text: L(`přímka $${name}$`, `the line $${name}$`) })),
          correct: [line],
        },
        hints: [
          L(
            'Průsečnice je přímka, která leží v obou rovinách zároveň.',
            'The line of intersection lies in both planes at once.',
          ),
          L(
            'Stačí najít dva body společné oběma rovinám. Projdi vrcholy krychle a u každého rozhodni, jestli leží v první i v druhé rovině.',
            'Two points common to both planes are enough. Go through the vertices of the cube and decide for each whether it lies in the first plane and in the second.',
          ),
        ],
        solution: [
          step(
            `V obou rovinách leží právě vrcholy $${line[0]}$ a $${line[1]}$. Dva společné body určují průsečnici:`,
            `Exactly the vertices $${line[0]}$ and $${line[1]}$ lie in both planes. Two common points determine the line of intersection:`,
            `${line}`,
          ),
        ],
        misconceptions: [
          mc(
            inFirst,
            'concept',
            `Přímka $${inFirst}$ leží v rovině $${short(first)}$, ale ne v rovině $${short(second)}$.`,
            `The line $${inFirst}$ lies in the plane $${short(first)}$ but not in the plane $${short(second)}$.`,
          ),
          mc(
            inSecond,
            'concept',
            `Přímka $${inSecond}$ leží v rovině $${short(second)}$, ale ne v rovině $${short(first)}$.`,
            `The line $${inSecond}$ lies in the plane $${short(second)}$ but not in the plane $${short(first)}$.`,
          ),
          mc(
            outside,
            'concept',
            sameDirection
              ? `Přímka $${outside}$ má správný směr, ale neleží ani v jedné z rovin.`
              : `Přímka $${outside}$ neleží ani v jedné z rovin.`,
            sameDirection
              ? `The line $${outside}$ has the right direction but lies in neither plane.`
              : `The line $${outside}$ lies in neither plane.`,
          ),
        ],
      };
    },
  }),

  gen({
    id: 'ster.positions.count',
    concept: 'ster.positions',
    kind: 'warmup',
    levels: [1, 2],
    title: L('Kolik přímek je mimoběžných?', 'How many lines are skew?'),
    est: (lv) => 50 + 25 * (lv - 1),
    make(r, lv) {
      // Level 1 counts edges against an edge; level 2 counts edges or face diagonals against a face diagonal.
      const line = r.pick(LINES.filter((candidate) => kindOf(candidate) === (lv === 1 ? 'edge' : 'face')));
      const family = lv === 1 ? 'edge' : r.pick(['edge', 'face'] as const);
      const members = LINES.filter((candidate) => kindOf(candidate) === family);
      const target = r.pick(['parallel', 'intersecting', 'skew'] as const);
      const groups = { parallel: [] as string[], intersecting: [] as string[], skew: [] as string[] };
      for (const member of members) {
        const position = positionOfLines(line, member);
        if (position !== 'identical') groups[position].push(member);
      }
      const count = groups[target].length;
      const what = family === 'edge' ? L('hran', 'edges') : L('stěnových úhlopříček', 'face diagonals');
      const word = {
        parallel: L('rovnoběžných', 'parallel to'),
        intersecting: L('různoběžných', 'intersecting'),
        skew: L('mimoběžných', 'skew to'),
      }[target];
      const own = kindOf(line) === family;
      const list = (lines: string[]): string =>
        lines.length === 0 ? '—' : lines.map((name) => `$${name}$`).join(', ');
      return {
        prompt: L(
          `${CUBE.cs}: kolik ${what.cs} krychle je ${word.cs} s přímkou $${line}$?${own ? ' (Přímku samotnou nepočítejte.)' : ''}`,
          `${CUBE.en}: how many ${what.en} of the cube are ${word.en} the line $${line}$?${own ? ' (Do not count the line itself.)' : ''}`,
        ),
        figure: cubeFigure([line]),
        answer: { kind: 'number', value: `${count}` },
        hints: [
          L(
            `Krychle má 12 ${what.cs}. Projdi je postupně: nejdřív ty, které mají s přímkou společný bod, pak ty se stejným směrem.`,
            `A cube has 12 ${what.en}. Go through them in turn: first those sharing a point with the line, then those with the same direction.`,
          ),
          L('Co zbude, je mimoběžné.', 'Whatever is left is skew.'),
        ],
        solution: [
          step(
            `Různoběžné (mají s přímkou společný bod): ${list(groups.intersecting)}.`,
            `Intersecting (sharing a point with the line): ${list(groups.intersecting)}.`,
          ),
          step(`Rovnoběžné: ${list(groups.parallel)}.`, `Parallel: ${list(groups.parallel)}.`),
          step(`Mimoběžné: ${list(groups.skew)}.`, `Skew: ${list(groups.skew)}.`),
          step('Hledaný počet:', 'The number sought:', `${count}`),
        ],
        misconceptions: (['parallel', 'intersecting', 'skew'] as const)
          .filter((other) => other !== target)
          .map((other) =>
            mc(
              `${groups[other].length}`,
              'misread',
              `To je počet ${other === 'parallel' ? 'rovnoběžných' : other === 'intersecting' ? 'různoběžných' : 'mimoběžných'}.`,
              `That is the number of ${other === 'parallel' ? 'parallel' : other === 'intersecting' ? 'intersecting' : 'skew'} ones.`,
            ),
          ),
        // All twelve, less the line itself and the two other groups.
        verify: [
          {
            kind: 'value',
            expr: `12-${own ? 1 : 0}-${(['parallel', 'intersecting', 'skew'] as const)
              .filter((other) => other !== target)
              .map((other) => groups[other].length)
              .join('-')}`,
          },
        ],
      };
    },
  }),
];
