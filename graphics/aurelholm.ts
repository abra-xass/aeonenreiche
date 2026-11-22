export const AURELHOLM = '10:9';
export const VALLEY_SCALE = 8;

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export const riverX = (z: number) => 15.4 + 2.0 * Math.sin(z * .14) + 1.1 * Math.sin(z * .075 + .5);
export const riverLevel = (z: number) => -.24 + z * .009;

type Lot = { x: number; z: number; y: number; angle: number };
const lots = {
  hall: [-3, 3, 2.20, -.10], barracks: [-10, -3.5, .64, .22], farm: [6.5, -8.2, .24, -.19],
  market: [-2.8, -5.7, .88, -.06], granary: [5.1, .3, .71, -.31], lumber: [-16, 1.8, 1.13, .14],
  wall: [-7.2, -11.7, .24, -.12], watch: [-13, 9.5, 2.47, .18], temple: [-5.1, 11, 2.43, -.08],
  quarry: [-21.7, -4.1, 1.02, -.22], range: [-13.5, -10.9, .29, .13], stable: [1.5, -15, .25, -.09],
  forge: [6.2, 8, 1.06, -.31], mine: [-20.2, 9.3, 2.32, -.12], academy: [1.6, 13.5, 1.46, .14],
  mint: [8.2, -15.9, .27, .19], spy: [-13, 16, 2.50, -.27], lab: [8.5, 15.5, .97, .27],
  foundry: [-20.6, -12, .49, .1], factory: [-9.4, -18.4, .41, .08], observatory: [-8, 21.7, 2.6, -.29],
  gate: [.7, 21.5, 1.57, -.07], signature: [-19.4, 17.4, 2.91, .29],
} satisfies Record<string, [number, number, number, number]>;
const footprints = Object.values(lots);

export const nearValleyLot = (x: number, z: number, distance = 3.55) =>
  footprints.some(([px, pz]) => Math.hypot(x - px, z - pz) < distance);

export function valleyLot(site: string): Lot | undefined {
  const key = site.startsWith('sig-site') ? 'signature' : site;
  const entry = lots[key as keyof typeof lots];
  if (!entry) return;
  const [x, z, y, angle] = entry;
  return { x, z, y, angle };
}

export function valleyHeight(x: number, z: number, city = false) {
  const rise = (cx: number, cz: number, rx: number, rz: number) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  const westernSpur = 6.1 * rise(-29, 10, 12, 24) + 3.45 * rise(-18, 28, 13, 12);
  const easternSpur = 6.5 * rise(32, 11, 9, 25);
  const terrace = 2.02 * rise(-4.2, 5.8, 13, 11);
  const distance = Math.abs(x - riverX(z));
  const floor = .14 + .11 * Math.cos(x * .37 + z * .22) + z * .008;
  let y = floor + terrace + (westernSpur + easternSpur) *
    (.81 + .18 * Math.sin(x * .52 + z * .26) + .1 * Math.cos(x * .88 - z * .4));
  const bank = 1 - smooth((distance - .98) / 4.4);
  y = y * (1 - bank) + (riverLevel(z) - .61) * bank;
  if (city) for (const [px, pz, elevation] of footprints) {
    const pad = 1 - smooth((Math.hypot(x - px, z - pz) - 3.15) / .94);
    y += (elevation - y) * pad;
  }
  return y;
}

export function regionalHeight(x: number, z: number, background: number) {
  const influence = 1 - smooth((Math.hypot(x * .90, z * .82) - 23) / 26);
  return background + (Math.max(.045, valleyHeight(x, z) * .71 + .56) - background) * influence;
}
