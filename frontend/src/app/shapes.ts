/**
 * Built-in shape library. Each shape is a list of sub-paths in a 100 × 100
 * box (y down). `fill` paths are unioned; `holes` are punched out afterwards.
 */
export interface LibraryShape {
  id: string;
  name: string;
  fill: string[];
  holes?: string[];
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
  { id: 'circle', name: 'Circle', fill: [circle(50, 50, 48), 'M36 86h28v14h-28z'] },
];

export const shapeById = (id: string) => SHAPES.find((s) => s.id === id)!;
