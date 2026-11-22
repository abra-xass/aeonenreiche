import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Engine } from '@babylonjs/core/Engines/engine';
import { CampaignView } from './campaign';
import { CityView } from './city';
import type { CityState, MapActions, MapState, WorldGeometry } from './types';
export { connectHud } from './hud';

interface ViewControls {
  reset(): void;
  zoom(factor: number): void;
}

function Viewport({ city, controls }: { city: boolean; controls: ViewControls }) {
  return (
    <>
      <canvas tabIndex={0} aria-label={city ? '3D-Ansicht der gebauten Stadt' : 'Interaktive 3D-Weltkarte'} />
      <div className="scene-labels" />
      <div className="scene-tools" aria-label="Kamerasteuerung">
        <button type="button" onClick={controls.reset}>{city ? 'Stadt zentrieren' : 'Auswahl zentrieren'}</button>
        {city && <>
          <button type="button" aria-label="Stadt verkleinern" onClick={() => controls.zoom(1 / 1.32)}>−</button>
          <button type="button" aria-label="Stadt vergrößern" onClick={() => controls.zoom(1.32)}>+</button>
        </>}
      </div>
    </>
  );
}

export function connectGraphics(world: WorldGeometry, actions: MapActions, onSite: (id: string) => void) {
  if (!Engine.IsSupported) return null;
  const worldHost = document.getElementById('world3d')!;
  const cityHost = document.getElementById('city3d')!;
  const worldRoot = createRoot(worldHost);
  let campaign: CampaignView | undefined;
  let city: CityView | undefined;
  let mapState: MapState | undefined;
  let atlas = false;
  let failed = false;
  let cityFailed = false;
  let political = false;
  let focus: string | undefined;
  let lastCity: CityState | undefined;
  flushSync(() => worldRoot.render(<Viewport city={false} controls={{
    reset: () => { if (mapState) campaign?.resetCamera(mapState.selected); },
    zoom: factor => campaign?.zoom(factor),
  }} />));

  const mapActive = () => Boolean(campaign && !atlas && !failed);
  const showMap = () => {
    worldHost.hidden = !mapActive();
    worldHost.parentElement!.classList.toggle('has-world3d', mapActive());
  };
  const showCity = () => {
    const active = Boolean(lastCity && city && !atlas && !cityFailed);
    cityHost.hidden = !active;
    cityHost.parentElement!.classList.toggle('has-city3d', active);
  };
  const failMap = (error: unknown) => {
    console.warn('Die 3D-Weltkarte konnte nicht geöffnet werden.', error);
    failed = true;
    campaign?.dispose();
    campaign = undefined;
    showMap();
  };
  worldHost.querySelector('canvas')!.addEventListener('webglcontextlost', failMap, { once: true });
  return {
    available: () => !failed,
    mapActive,
    firstFrame: () => campaign?.firstFrame() ?? Promise.resolve(),
    map(state: MapState) {
      mapState = state;
      if (failed || atlas) return;
      try {
        if (!campaign) {
          campaign = new CampaignView(worldHost.querySelector('canvas')!, worldHost.querySelector('.scene-labels')!, world,
            actions, focus || state.selected);
          campaign.togglePolitical(political);
        }
        campaign.sync(state);
        showMap();
      } catch (error) { failMap(error); }
    },
    city(state?: CityState) {
      lastCity = state;
      if (!state || atlas || cityFailed) { showCity(); return; }
      try {
        if (!city) {
          const root = createRoot(cityHost);
          flushSync(() => root.render(<Viewport city controls={{ reset: () => city?.reset(), zoom: factor => city?.zoom(factor) }} />));
          city = new CityView(cityHost.querySelector('canvas')!, cityHost.querySelector('.scene-labels')!, onSite);
          cityHost.querySelector('canvas')!.addEventListener('webglcontextlost', () => {
            cityFailed = true; city?.dispose(); city = undefined; showCity();
          }, { once: true });
        }
        city.sync(state);
        showCity();
      } catch (error) {
        console.warn('Die 3D-Stadtansicht konnte nicht geöffnet werden.', error);
        cityFailed = true;
        city?.dispose();
        city = undefined;
        showCity();
      }
    },
    routes(links: import('./types').OrderRoute[]) { campaign?.routes(links); },
    useAtlas(value: boolean) { atlas = value; showMap(); showCity(); },
    zoom(factor: number) { campaign?.zoom(factor); },
    overview(id: string) { campaign?.overview(id); },
    focusTile(id: string) { focus = id; campaign?.focusTile(id); },
    resetMap(id: string) { focus = id; campaign?.resetCamera(id); },
    focus(x: number, y: number) { campaign?.focus(x, y); },
    political(value: boolean) { political = value; campaign?.togglePolitical(value); },
  };
}
