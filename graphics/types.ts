export interface Tile {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
  seed: number;
  name: string;
  biome: string;
  continent: string;
  capital: boolean;
}

export interface Landmass {
  name: string;
}

export interface WorldGeometry {
  bounds: { width: number; height: number };
  radius: number;
  step: number;
  map: Tile[];
  lookup: Record<string, Tile>;
  landmasses: Landmass[];
  geography(mass: Landmass, x: number, y: number): { mountain: number; latitude: number; moisture: number };
  coastField(mass: Landmass, x: number, y: number): number;
}

export interface Province {
  id: string;
  owner: string | null;
  color: string;
  own: boolean;
  visible: boolean;
  discovered: boolean;
  reachable: boolean;
  city: number;
  age: number;
  fortified: boolean;
  count: number;
  strength: number;
  encounter: 'dragon' | 'treasure' | null;
}

export interface Troop {
  id: string;
  name: string;
  role: string;
  count: number;
}

export interface March {
  id: number;
  from: string;
  to: string;
  owner: string;
  color: string;
  sea: boolean;
  returning: boolean;
  turnaround: number;
  started: number;
  due: number;
  roster: Troop[];
  strength: number;
  count: number;
}

export interface MapState {
  provinces: Province[];
  marches: March[];
  crossings: [string, string][];
  selected: string;
  selectedMarch: number | null;
}

export interface OrderRoute {
  from: string;
  to: string;
  kind: 'friendly' | 'hostile' | 'scouting' | 'blocked';
  selected: boolean;
  sea: boolean;
}

export interface CityState {
  id: string;
  name: string;
  faction: string;
  color: string;
  biome: string;
  age: number;
  selected: string | null;
  sites: { id: string; name: string; level: number }[];
}

export interface MapActions {
  pick(id: string, action: 'province' | 'garrison' | 'context', event: PointerEvent | MouseEvent): void;
  march(id: number): void;
  tick(now: number): number;
  view(x: number, y: number, span: number): void;
}
