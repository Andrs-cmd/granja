// =====================================================================
// Panel de control: estado de los personajes, recursos, huerto, órdenes y diario.
// Construye el DOM una vez y en cada refresco solo actualiza textos y barras.
// =====================================================================
import { CULTIVOS, RASGOS, TIPOS_ORDEN, ESTACIONES, TANQUE_MAX, fechaTxt, estacion, dia, anio, hora, ordenar, cancelarOrden } from './sim.js';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const EMOJI = { tomas: '👨', lucia: '👩', nube: '🐕', esmoquin: '🐈‍⬛' };
const ESTADO_PARCELA = { vacia: 'Vacía', creciendo: 'Creciendo', lista: 'Lista', muerta: 'Muerta' };
const NEC = [['comida', 'Comida'], ['agua', 'Agua'], ['energia', 'Energía'], ['salud', 'Salud']];

export function crearUI(root, ctx) {
  // ctx: { get estado(), velocidad, setVelocidad(v), nueva(), seleccionarParcela(i) }
  let quien = 'cualquiera';
  let seleccion = null;
  const refs = {};

  // ---------------------------------------------------------------- barra superior
  const speeds = [[0, '⏸'], [1, '▶'], [5, '×5'], [20, '×20'], [100, '×100']];
  const top = h('header', { class: 'top' },
    h('div', { class: 'brand' }, 'Granja', h('span', {}, 'Simulación de supervivencia')),
    refs.fecha = h('div', { class: 'fecha' }, '—'),
    refs.clima = h('div', { class: 'clima' }, '☀️'),
    h('div', { class: 'speeds' }, speeds.map(([v, txt]) => {
      const b = h('button', { class: 'speed', title: v === 0 ? 'Pausa' : `Velocidad ${txt}`, onclick: () => ctx.setVelocidad(v) }, txt);
      b.dataset.v = v; return b;
    })),
    h('button', { class: 'ghost', onclick: () => { if (confirm('¿Empezar una partida nueva? Se pierde la actual.')) ctx.nueva(); } }, 'Nueva partida'),
  );
  refs.speedBtns = [...top.querySelectorAll('.speed')];

  // ---------------------------------------------------------------- personajes
  const cards = {};
  const personajes = h('section', { class: 'card' }, h('h3', {}, 'Habitantes'));
  const grid = h('div', { class: 'agents' }); personajes.append(grid);

  // ---------------------------------------------------------------- recursos
  const recursos = h('section', { class: 'card' }, h('h3', {}, 'Recursos'),
    refs.res = h('div', { class: 'res' }),
    refs.tank = h('div', { class: 'tank' }, h('div', { class: 'tank-fill' })),
    refs.semillas = h('div', { class: 'chips' }));

  // ---------------------------------------------------------------- huerto
  const huerto = h('section', { class: 'card' }, h('h3', {}, 'Huerto', h('small', {}, 'clic en una parcela de la escena para seleccionarla')),
    refs.plots = h('div', { class: 'plots' }));

  // ---------------------------------------------------------------- órdenes
  const quienSel = h('div', { class: 'seg' }, [['cualquiera', 'Cualquiera'], ['tomas', 'Tomás'], ['lucia', 'Lucía']].map(([v, t]) => {
    const b = h('button', { onclick: () => { quien = v; pintarQuien(); } }, t); b.dataset.v = v; return b;
  }));
  const pintarQuien = () => quienSel.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === quien));
  pintarQuien();
  const orden = (o) => { ordenar(ctx.estado, { ...o, quien }); refrescar(); };
  const ordenes = h('section', { class: 'card' }, h('h3', {}, 'Órdenes'),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, '¿Quién?'), quienSel),
    h('div', { class: 'actions' },
      h('button', { onclick: () => orden({ tipo: 'sacarAgua' }) }, '🪣 Sacar agua del pozo'),
      h('button', { onclick: () => orden({ tipo: 'filtrar' }) }, '🫗 Filtrar agua'),
      h('button', { onclick: () => orden({ tipo: 'alimentar' }) }, '🍖 Alimentar animales'),
      h('button', { onclick: () => ctx.estado.parcelas.filter((p) => p.estado === 'creciendo').forEach((p) => orden({ tipo: 'regar', parcela: p.id })) }, '💧 Regar todo'),
      h('button', { onclick: () => ctx.estado.parcelas.filter((p) => p.estado === 'lista').forEach((p) => orden({ tipo: 'cosechar', parcela: p.id })) }, '🧺 Cosechar todo'),
    ),
    refs.cola = h('ol', { class: 'cola' }));

  // ---------------------------------------------------------------- rutina (órdenes permanentes)
  const chk = (key, txt) => h('label', { class: 'chk' }, refs['p_' + key] = h('input', { type: 'checkbox', onchange: (e) => { ctx.estado.permanentes[key] = e.target.checked; } }), txt);
  const rango = (key, txt, max) => h('label', { class: 'range' }, h('span', {}, txt, refs['v_' + key] = h('b', {}, '')),
    refs['p_' + key] = h('input', { type: 'range', min: 0, max, step: 5, oninput: (e) => { ctx.estado.permanentes[key] = +e.target.value; refs['v_' + key].textContent = ` ${e.target.value} L`; } }));
  refs.p_resembrar = h('select', { onchange: (e) => { ctx.estado.permanentes.resembrar = e.target.value || null; } },
    h('option', { value: '' }, 'No resembrar'), Object.entries(CULTIVOS).map(([k, c]) => h('option', { value: k }, `Resembrar ${c.nombre.toLowerCase()}`)));
  const rutina = h('section', { class: 'card' }, h('h3', {}, 'Rutina', h('small', {}, 'lo que hacen solos cuando no hay órdenes')),
    h('div', { class: 'chks' }, chk('regar', 'Regar lo que esté seco'), chk('cosechar', 'Cosechar lo que esté listo'), chk('limpiar', 'Limpiar parcelas muertas'), chk('animales', 'Cuidar a los animales')),
    h('div', { class: 'row' }, refs.p_resembrar),
    rango('potableMin', 'Mantener agua potable ≥', 100),
    rango('tanqueMin', 'Mantener el tanque ≥', 400));

  // ---------------------------------------------------------------- diario
  const diario = h('section', { class: 'card' }, h('h3', {}, 'Diario'), refs.diario = h('ul', { class: 'diario' }));

  const panel = h('aside', { class: 'panel' }, personajes, recursos, huerto, ordenes, rutina, diario);
  refs.fin = h('div', { class: 'fin hidden' });
  root.append(top, panel, refs.fin);

  // ---------------------------------------------------------------- render dinámico
  function cardAgente(a) {
    const bars = {};
    const el = h('div', { class: 'agent' },
      h('div', { class: 'agent-head' }, h('span', { class: 'emoji' }, EMOJI[a.id] || '•'), h('b', {}, a.nombre),
        h('div', { class: 'traits' }, a.rasgos.map((r) => h('span', { class: 'trait', title: RASGOS[r].desc }, RASGOS[r].nombre)))),
      bars.accion = h('div', { class: 'accion' }, ''),
      NEC.map(([k, t]) => h('div', { class: 'bar' }, h('span', {}, t), h('i', {}, bars[k] = h('em', {})))));
    cards[a.id] = { el, bars };
    grid.append(el);
  }

  let lastLog = -1, lastCola = '';
  function refrescar() {
    const s = ctx.estado;
    refs.fecha.textContent = fechaTxt(s);
    refs.clima.textContent = s.clima.lluvia ? '🌧️' : (hora(s) >= 6 && hora(s) < 19 ? '☀️' : '🌙');
    refs.clima.title = s.clima.lluvia ? 'Lloviendo' : 'Despejado';
    refs.speedBtns.forEach((b) => b.classList.toggle('on', +b.dataset.v === ctx.velocidad));

    for (const a of s.agentes) {
      if (!cards[a.id]) cardAgente(a);
      const c = cards[a.id];
      c.el.classList.toggle('dead', !a.vivo);
      c.bars.accion.textContent = a.vivo ? a.accion : `Murió el día ${Math.floor(a.murio / 1440) + 1}`;
      for (const [k] of NEC) {
        const v = a.n[k];
        c.bars[k].style.width = `${a.vivo ? v : 0}%`;
        c.bars[k].className = v < 25 ? 'low' : v < 50 ? 'mid' : '';
      }
    }

    const R = s.rec;
    const consumo = s.agentes.filter((a) => a.vivo && a.tipo === 'humano').length * 1.4 + s.agentes.filter((a) => a.vivo && a.tipo !== 'humano').length * 0.6;
    const diasComida = consumo ? Math.floor(R.raciones / consumo) : 0;
    refs.res.replaceChildren(
      h('div', {}, h('span', {}, '🥔 Raciones'), h('b', { class: R.raciones < 10 ? 'warn' : '' }, `${Math.floor(R.raciones)}`), h('small', {}, `≈ ${diasComida} días`)),
      h('div', {}, h('span', {}, '🚰 Agua potable'), h('b', { class: R.potable < 5 ? 'warn' : '' }, `${Math.floor(R.potable)} L`)),
      h('div', {}, h('span', {}, '🛢️ Agua cruda'), h('b', {}, `${Math.floor(R.cruda)} / ${TANQUE_MAX} L`)),
      h('div', {}, h('span', {}, '🐾 Comedero'), h('b', { class: R.comedero < 0.3 ? 'warn' : '' }, `${R.comedero.toFixed(1)} rac · ${Math.floor(R.bebedero)} L`)),
    );
    refs.tank.firstChild.style.width = `${(R.cruda / TANQUE_MAX) * 100}%`;
    refs.semillas.replaceChildren(h('span', { class: 'lbl' }, 'Semillas:'), ...Object.entries(CULTIVOS).map(([k, c]) => {
      const ok = c.estaciones.includes(estacion(s));
      return h('span', { class: `chip ${ok ? '' : 'off'}`, title: `${c.nombre}: ${c.dias} días, ${c.raciones} raciones. Se da en ${c.estaciones.map((e) => ESTACIONES[e].toLowerCase()).join(', ')}.` }, `${c.nombre} ${R.semillas[k] || 0}`);
    }));

    // huerto
    if (!refs.plotRows) {
      refs.plotRows = s.parcelas.map((p) => {
        const r = {};
        r.el = h('div', { class: 'plot', onclick: () => seleccionar(p.id) },
          h('b', {}, `P${p.id + 1}`), r.info = h('span', { class: 'pinfo' }), r.prog = h('i', { class: 'prog' }, h('em', {})), r.btns = h('div', { class: 'pbtns' }));
        refs.plots.append(r.el);
        return r;
      });
    }
    s.parcelas.forEach((p, i) => {
      const r = refs.plotRows[i], C = p.cultivo && CULTIVOS[p.cultivo];
      r.el.classList.toggle('sel', seleccion === i);
      r.el.dataset.estado = p.estado;
      r.info.textContent = C ? `${C.nombre} · ${ESTADO_PARCELA[p.estado]} · 💧${Math.round(p.agua)}%` : `${ESTADO_PARCELA[p.estado]} · 💧${Math.round(p.agua)}%`;
      r.prog.firstChild.style.width = C ? `${Math.min(100, (p.crec / C.dias) * 100)}%` : '0%';
      const key = `${p.estado}|${estacion(s)}|${quien}`;
      if (r.key !== key) {
        r.key = key;
        const b = [];
        if (p.estado === 'vacia') {
          for (const [k, c] of Object.entries(CULTIVOS)) if (c.estaciones.includes(estacion(s)))
            b.push(h('button', { onclick: (e) => { e.stopPropagation(); orden({ tipo: 'sembrar', parcela: p.id, cultivo: k }); } }, `🌱 ${c.nombre}`));
          if (!b.length) b.push(h('span', { class: 'muted' }, 'Nada se da en esta estación'));
        }
        if (p.estado === 'creciendo' || p.estado === 'lista') b.push(h('button', { onclick: (e) => { e.stopPropagation(); orden({ tipo: 'regar', parcela: p.id }); } }, '💧 Regar'));
        if (p.estado === 'lista') b.push(h('button', { class: 'go', onclick: (e) => { e.stopPropagation(); orden({ tipo: 'cosechar', parcela: p.id }); } }, '🧺 Cosechar'));
        if (p.estado === 'muerta') b.push(h('button', { onclick: (e) => { e.stopPropagation(); orden({ tipo: 'limpiar', parcela: p.id }); } }, '🧹 Limpiar'));
        r.btns.replaceChildren(...b);
      }
    });

    // cola de órdenes
    const colaKey = s.ordenes.map((o) => `${o.id}${o.asignada}`).join(',');
    if (colaKey !== lastCola) {
      lastCola = colaKey;
      refs.cola.replaceChildren(...(s.ordenes.length ? s.ordenes.map((o) => h('li', {},
        h('span', {}, `${TIPOS_ORDEN[o.tipo]}${o.parcela != null ? ` P${o.parcela + 1}` : ''}${o.cultivo ? ` (${CULTIVOS[o.cultivo].nombre.toLowerCase()})` : ''}`),
        h('small', {}, o.asignada ? `→ ${s.agentes.find((a) => a.id === o.asignada).nombre}` : o.quien === 'cualquiera' ? 'pendiente' : `para ${o.quien === 'tomas' ? 'Tomás' : 'Lucía'}`),
        h('button', { class: 'x', title: 'Cancelar', onclick: () => { cancelarOrden(s, o.id); refrescar(); } }, '✕')))
        : [h('li', { class: 'muted' }, 'Sin órdenes pendientes: siguen su rutina.')]));
    }

    // rutina (solo si el usuario no está tocando el control)
    const P = s.permanentes;
    for (const k of ['regar', 'cosechar', 'limpiar', 'animales']) if (document.activeElement !== refs['p_' + k]) refs['p_' + k].checked = !!P[k];
    if (document.activeElement !== refs.p_resembrar) refs.p_resembrar.value = P.resembrar || '';
    for (const k of ['potableMin', 'tanqueMin']) if (document.activeElement !== refs['p_' + k]) { refs['p_' + k].value = P[k]; refs['v_' + k].textContent = ` ${P[k]} L`; }

    // diario
    const top = s.diario[0];
    const sello = top ? top.t + top.texto : '';
    if (sello !== lastLog) {
      lastLog = sello;
      refs.diario.replaceChildren(...s.diario.slice(0, 60).map((e) => {
        const d = Math.floor(e.t / 1440), hh = String(Math.floor((e.t % 1440) / 60)).padStart(2, '0');
        return h('li', { class: e.tipo }, h('small', {}, `Día ${d + 1} · ${hh}h`), e.texto);
      }));
    }

    // fin de la partida
    refs.fin.classList.toggle('hidden', !s.fin);
    if (s.fin && !refs.fin.dataset.shown) {
      refs.fin.dataset.shown = '1';
      const años = Math.floor(s.fin.dias / 112), dias = s.fin.dias % 112;
      refs.fin.replaceChildren(h('div', { class: 'fin-box' },
        h('h2', {}, 'La granja quedó vacía'),
        h('p', {}, `Sobrevivieron ${años ? `${años} año${años > 1 ? 's' : ''} y ` : ''}${dias} días.`),
        h('p', { class: 'muted' }, `Cosechas: ${s.stats.cosechas} · Raciones producidas: ${s.stats.raciones} · Agua del pozo: ${Math.round(s.stats.litrosPozo)} L`),
        h('button', { class: 'go', onclick: () => ctx.nueva() }, 'Empezar de nuevo')));
    }
    if (!s.fin) delete refs.fin.dataset.shown;
  }

  function seleccionar(i) { seleccion = seleccion === i ? null : i; ctx.seleccionarParcela(seleccion); refrescar(); refs.plotRows?.[i]?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

  return { refrescar, seleccionar, reiniciar() { grid.replaceChildren(); for (const k in cards) delete cards[k]; lastLog = -1; lastCola = '_'; } };
}
