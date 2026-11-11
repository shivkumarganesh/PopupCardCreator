/**
 * Built-in shape library. Each shape is a list of sub-paths in a 100 × 100
 * box (y down). `fill` paths are unioned; `holes` are punched out afterwards.
 */
export interface LibraryShape {
  id: string;
  name: string;
  fill: string[];
  holes?: string[];
  /** Drawing box, default 100 × 100. Wide strips (hills, waves) use a wider one. */
  w?: number;
  h?: number;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

function star(points: number, cx: number, cy: number, r1: number, r2: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

const petals = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
  return circle(50 + 17 * Math.cos(a), 30 + 17 * Math.sin(a), 12.5);
});

const scallops = (n: number, w: number, top: number, dip: number, h: number) => {
  const step = w / n;
  let d = `M0 ${h}V${dip}`;
  for (let i = 0; i < n; i++) d += `C${(i + 0.2) * step} ${top} ${(i + 0.8) * step} ${top} ${(i + 1) * step} ${dip}`;
  return `${d}V${h}Z`;
};

const blades = (n: number, w: number, h: number, base: number) => {
  const step = w / n;
  let d = `M0 ${h}V${h - base}`;
  for (let i = 0; i < n; i++) {
    const tip = i % 3 === 0 ? 0 : i % 3 === 1 ? h * 0.35 : h * 0.18;
    d += `L${(i + 0.5 + (i % 2 ? 0.25 : -0.2)) * step} ${tip}L${(i + 1) * step} ${h - base}`;
  }
  return `${d}V${h}Z`;
};

const pickets = Array.from({ length: 9 }, (_, i) => {
  const x = 4 + i * 22;
  return `M${x} 60V12L${x + 7} 2L${x + 14} 12V60Z`;
});

export const SHAPES: LibraryShape[] = [
  {
    id: 'heart',
    name: 'Heart',
    fill: ['M50 92C20 66 5 49 5 31C5 16 17 6 30 6C39 6 46 11 50 19C54 11 61 6 70 6C83 6 95 16 95 31C95 49 80 66 50 92Z'],
  },
  { id: 'star', name: 'Star', fill: [star(5, 50, 52, 50, 21)] },
  {
    id: 'tree',
    name: 'Pine tree',
    fill: ['M50 3L72 34H63L81 61H70L92 89H57V100H43V89H8L30 61H19L37 34H28Z'],
  },
  {
    id: 'cake',
    name: 'Cake',
    fill: [
      'M50 0C55 6 55 11 50 13C45 11 45 6 50 0Z',
      'M47 10h6v10h-6z',
      'M32 19h36a4 4 0 0 1 4 4v23h-44v-23a4 4 0 0 1 4-4z',
      'M18 44h64a4 4 0 0 1 4 4v52h-72v-52a4 4 0 0 1 4-4z',
    ],
  },
  {
    id: 'balloon',
    name: 'Balloon',
    fill: [
      'M50 2C74 2 90 20 90 42C90 62 72 78 54 82L57 89H43L46 82C28 78 10 62 10 42C10 20 26 2 50 2Z',
      'M48 88h4v12h-4z',
    ],
  },
  {
    id: 'gift',
    name: 'Gift',
    fill: [
      'M10 36h80v16h-80z',
      'M17 50h66v50h-66z',
      'M50 37C40 16 20 12 19 24C18 34 36 37 50 37Z',
      'M50 37C60 16 80 12 81 24C82 34 64 37 50 37Z',
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud',
    fill: [circle(28, 72, 26), circle(52, 50, 30), circle(76, 74, 22), 'M28 70h48v28h-48z'],
  },
  {
    id: 'house',
    name: 'House',
    fill: ['M50 5L96 46H84V100H16V46H4Z', 'M68 12h11v24h-11z'],
    holes: ['M41 56h18v18h-18z'],
  },
  {
    id: 'flower',
    name: 'Flower',
    fill: [
      ...petals,
      circle(50, 30, 10),
      'M47.5 40h5v60h-5z',
      'M50 84C36 80 28 68 30 60C41 62 49 71 50 84Z',
      'M50 76C64 72 72 60 70 52C59 54 51 63 50 76Z',
    ],
  },
  { id: 'moon', name: 'Moon', fill: ['M60 4A47 47 0 1 0 96 62A38 38 0 0 1 60 4Z'] },
  { id: 'mountains', name: 'Mountains', fill: ['M0 100L26 34L40 58L62 8L100 100Z'] },
  {
    id: 'skyline',
    name: 'Skyline',
    fill: ['M0 100V56H13V32H29V50H37V12H55V44H63V34H77V20H90V60H100V100Z'],
    holes: ['M42 20h8v7h-8z', 'M42 33h8v7h-8z', 'M17 38h8v7h-8z', 'M80 27h7v7h-7z', 'M80 40h7v7h-7z'],
  },
  { id: 'rainbow', name: 'Rainbow', fill: ['M3 100A47 47 0 0 1 97 100H80A30 30 0 0 0 20 100Z'] },
  { id: 'sun', name: 'Sun', fill: [star(14, 50, 50, 50, 37)] },
  {
    id: 'snowman',
    name: 'Snowman',
    fill: [circle(50, 76, 24), circle(50, 45, 17), circle(50, 24, 12), 'M39 2h22v13h-22z', 'M32 13h36v5h-36z'],
  },
  {
    id: 'rocket',
    name: 'Rocket',
    fill: ['M50 2C64 16 68 36 68 60L86 82V96L66 86H34L14 96V82L32 60C32 36 36 16 50 2Z', 'M40 84h20v16h-20z'],
    holes: [circle(50, 38, 8)],
  },
  { id: 'crown', name: 'Crown', fill: ['M10 100L3 38L28 62L50 20L72 62L97 38L90 100Z'] },
  // ── scenery ──
  { id: 'hills', name: 'Hills', w: 200, h: 60, fill: ['M0 60V30C22 4 52 2 78 26C104 -2 150 0 200 34V60Z'] },
  { id: 'waves', name: 'Waves', w: 200, h: 30, fill: [scallops(8, 200, 0, 14, 30)] },
  { id: 'grass', name: 'Grass', w: 200, h: 26, fill: [blades(26, 200, 26, 9)] },
  { id: 'fence', name: 'Fence', w: 200, h: 60, fill: [...pickets, 'M0 22h200v8h-200z', 'M0 42h200v8h-200z'] },
  {
    id: 'roundtree',
    name: 'Leafy tree',
    fill: [circle(50, 34, 32), circle(28, 48, 20), circle(72, 48, 20), 'M43 58h14v42h-14z'],
  },
  {
    id: 'palm',
    name: 'Palm tree',
    fill: [
      'M44 100C44 72 48 52 54 34L64 36C58 54 56 74 58 100Z',
      'M58 38C44 12 18 12 4 32C24 26 42 30 58 38Z',
      'M58 38C72 12 94 14 99 36C84 28 70 30 58 38Z',
      'M58 38C50 20 56 6 72 1C66 14 64 26 58 38Z',
      'M58 36C38 34 24 46 20 66C32 52 46 44 60 42Z',
      'M58 36C78 36 90 50 92 68C82 54 70 46 56 42Z',
      circle(58, 38, 6),
    ],
  },
  {
    id: 'cactus',
    name: 'Cactus',
    fill: [
      'M41 20h18v80h-18z',
      circle(50, 20, 9),
      'M20 40h13v30h-13z',
      'M20 57h24v13h-24z',
      circle(26.5, 40, 6.5),
      'M67 28h13v30h-13z',
      'M56 45h24v13h-24z',
      circle(73.5, 28, 6.5),
    ],
  },
  {
    id: 'sailboat',
    name: 'Sailboat',
    fill: ['M8 78H92L78 100H22Z', 'M48 6h4v74h-4z', 'M55 10L88 72H55Z', 'M45 24L16 72H45Z'],
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse',
    fill: ['M39 30H61L70 100H30Z', 'M33 25h34v7h-34z', 'M41 11h18v16h-18z', 'M37 13L50 1L63 13Z'],
    holes: [circle(50, 52, 4.5), 'M46 70h8v12h-8z'],
  },
  {
    id: 'castle',
    name: 'Castle',
    fill: [
      'M8 100V24H14V16H20V24H26V16H32V24H38V44H44V36H50V44H56V36H62V44V24H68V16H74V24H80V16H86V24H92V100Z',
      'M20 16L23 2L26 16Z',
      'M74 16L77 2L80 16Z',
    ],
    holes: ['M19 38h8v14h-8z', 'M73 38h8v14h-8z', 'M43 62h14v16h-14z'],
  },
  { id: 'tent', name: 'Tent', fill: ['M50 6L97 100H3Z', 'M48 0h4v12h-4z'], holes: ['M50 50L64 90H36Z'] },
  {
    id: 'barn',
    name: 'Barn',
    fill: ['M12 100V46L30 20H70L88 46V100Z'],
    holes: ['M39 58h22v28h-22z', circle(50, 38, 6)],
  },
  {
    id: 'windmill',
    name: 'Windmill',
    fill: [
      'M38 100L45 38H55L62 100Z',
      'M47 38L43 2H57L53 38Z',
      'M47 38L43 74H57L53 38Z',
      'M50 35L14 31V45L50 41Z',
      'M50 35L86 31V45L50 41Z',
      circle(50, 38, 6),
    ],
  },
  {
    id: 'church',
    name: 'Chapel',
    fill: ['M20 100V54H80V100Z', 'M14 56L50 30L86 56Z', 'M42 44V18L50 3L58 18V44Z'],
    holes: [circle(50, 66, 6), 'M28 70h8v14h-8z', 'M64 70h8v14h-8z'],
  },
  {
    id: 'mushroom',
    name: 'Mushroom',
    fill: ['M6 58C6 26 26 6 50 6C74 6 94 26 94 58Z', 'M37 54h26v46h-26z'],
    holes: [circle(34, 34, 6), circle(62, 28, 7), circle(72, 46, 4)],
  },
  { id: 'circle', name: 'Circle', fill: [circle(50, 50, 48), 'M36 86h28v14h-28z'] },
];

export const shapeById = (id: string) => SHAPES.find((s) => s.id === id)!;
