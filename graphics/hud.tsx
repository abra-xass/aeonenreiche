import { createRoot } from 'react-dom/client';

export interface DockState {
  city: boolean;
  selected: string;
  canEnterCity: boolean;
  buildOpen: boolean;
  ordersOpen: boolean;
  realmOpen: boolean;
}

export interface BuildingCommands {
  key: string;
  name: string;
  level: number;
  next?: { stage: number; time: string; costs: { name: string; value: number }[]; blocked?: string; bundled: boolean };
  queue: { title: string; status: string }[];
}

function Icon({ index }: { index: number }) {
  return <span className="hud-icon" aria-hidden="true" style={{
    backgroundPosition: `${(index % 6) * 20}% ${Math.floor(index / 6) * 100 / 3}%`,
  }} />;
}

function CommandDock({ state }: { state: DockState }) {
  return <>
    <div className="hud-commands">
      <button type="button" data-do="screen" data-key="province" aria-current={state.city ? undefined : 'page'}>
        <Icon index={7} /> Weltkarte
      </button>
      <button type="button" data-do="screen" data-key="city" aria-current={state.city ? 'page' : undefined}
        disabled={!state.canEnterCity}>
        <Icon index={8} /> Stadt
      </button>
      {state.city && <button type="button" data-do="hud-build" aria-controls="cityContent" aria-expanded={state.buildOpen}>
        <Icon index={3} /> Bau
      </button>}
      <button type="button" data-do="hud-orders" aria-controls="orderPanel" aria-expanded={state.ordersOpen}>
        <Icon index={11} /> {state.city ? 'Garnison' : 'Befehle'}
      </button>
      <button type="button" data-do="hud-realm" aria-controls="realmPanel" aria-expanded={state.realmOpen}>
        <Icon index={10} /> Reich
      </button>
      <button type="button" data-do="history"><Icon index={19} /> Chronik</button>
    </div>
    <span className="hud-selection" title={state.selected}>{state.selected}</span>
  </>;
}

function BuildingCard({ building }: { building: BuildingCommands }) {
  const { name, level, next, queue, key } = building;
  return <>
    <header>
      <div><h2>{name}</h2><p>Stufe {level}</p></div>
      <button type="button" data-do="hud-dismiss" aria-label="Gebäudemenü schließen">×</button>
    </header>
    {next ? <>
      <dl className="hud-build-facts">
        <div><dt>Bauzeit</dt><dd>{next.time}</dd></div>
        {!!next.costs.length && <div><dt>{next.bundled ? 'Gesamtkosten' : 'Kosten'}</dt>
          <dd>{next.costs.map(({ name, value }) => `${value} ${name}`).join(' · ')}</dd></div>}
      </dl>
      {next.blocked && <p className="hud-building-blocked">{next.blocked}</p>}
      <button type="button" className="hud-build-action" data-do="build" data-key={key} disabled={Boolean(next.blocked)}>
        {next.bundled ? 'Ausbau einplanen' : `Auf Stufe ${next.stage} ausbauen`}
      </button>
    </> : <p className="hud-building-blocked">Höchste Stufe erreicht</p>}
    <div className="hud-queue">
      <div><strong>Bauwarteschlange</strong><button type="button" data-do="hud-build">Öffnen</button></div>
      {queue.length ? <ul>{queue.slice(0, 3).map(({ title, status }, i) =>
        <li key={`${title}/${i}`}><span>{title}</span><small>{status}</small></li>)}</ul> : <p>Keine Aufträge</p>}
      {queue.length > 3 && <p>{queue.length - 3} weitere Aufträge</p>}
    </div>
  </>;
}

export function connectHud() {
  const dock = document.getElementById('hudDock')!;
  const card = document.getElementById('buildingHud')!;
  const dockRoot = createRoot(dock);
  const cardRoot = createRoot(card);
  let dockSignature = '', cardSignature = '';
  return {
    dock(state?: DockState) {
      dock.hidden = !state;
      if (!state) return;
      const signature = JSON.stringify(state);
      if (signature === dockSignature) return;
      dockSignature = signature;
      dockRoot.render(<CommandDock state={state} />);
    },
    building(state?: BuildingCommands) {
      card.hidden = !state;
      if (!state) return;
      const signature = JSON.stringify(state);
      if (signature === cardSignature) return;
      cardSignature = signature;
      cardRoot.render(<BuildingCard building={state} />);
    },
  };
}
