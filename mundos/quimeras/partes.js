// =====================================================================
// Catálogo de la Arena de quimeras: animales, partes por ranura y habilidades.
// Datos puros (sin three ni DOM) para que la simulación se pruebe en Node y la escena arme los modelos con lo mismo.
// Estadísticas de cada parte: s = [vida, fuerza, defensa, velocidad, agilidad, alcance] (se suman a la base).
// =====================================================================

// pre/suf arman el nombre compuesto: prefijo de la cabeza + sufijo del torso («Leo» + «guila» = Leoguila)
export const ANIMALES = {
  leon: { nom: 'León', pre: 'Leo', suf: 'león', c: [0xc8964a, 0x7a4a22] },
  aguila: { nom: 'Águila', pre: 'Agui', suf: 'guila', c: [0x6a4a2e, 0xf2efe6] },
  toro: { nom: 'Toro', pre: 'Toro', suf: 'toro', c: [0x3a2a22, 0xd8cfc0] },
  serpiente: { nom: 'Serpiente', pre: 'Serpi', suf: 'sierpe', c: [0x4f8a3a, 0xd8c860] },
  lobo: { nom: 'Lobo', pre: 'Lupi', suf: 'lobo', c: [0x7a7f88, 0xd9d6cf] },
  oso: { nom: 'Oso', pre: 'Urso', suf: 'oso', c: [0x5a3a24, 0x2e1e14] },
  escorpion: { nom: 'Escorpión', pre: 'Escorpi', suf: 'pión', c: [0x2a2a30, 0xb8642a] },
  murcielago: { nom: 'Murciélago', pre: 'Murci', suf: 'ciélago', c: [0x3a3038, 0x8a5a6a] },
  cocodrilo: { nom: 'Cocodrilo', pre: 'Coco', suf: 'drilo', c: [0x4a5e32, 0xb8b47a] },
  tiburon: { nom: 'Tiburón', pre: 'Tibu', suf: 'burón', c: [0x6a7f92, 0xeef0f2] },
  rinoceronte: { nom: 'Rinoceronte', pre: 'Rino', suf: 'ceronte', c: [0x8a8680, 0x5e5a56] },
  arana: { nom: 'Araña', pre: 'Ara', suf: 'raña', c: [0x26202a, 0xc0302a] },
  mantis: { nom: 'Mantis', pre: 'Manti', suf: 'mantis', c: [0x7ab84a, 0xd8e87a] },
  gorila: { nom: 'Gorila', pre: 'Gori', suf: 'rila', c: [0x2e2c30, 0x6a625e] },
  pulpo: { nom: 'Pulpo', pre: 'Pulpi', suf: 'pulpo', c: [0xb8506a, 0xf0a8a0] },
  ciervo: { nom: 'Ciervo', pre: 'Cier', suf: 'ciervo', c: [0xa8703a, 0xf0e2c8] },
  tortuga: { nom: 'Tortuga', pre: 'Tortu', suf: 'tuga', c: [0x6a8a4a, 0x6a5232] },
  buho: { nom: 'Búho', pre: 'Bu', suf: 'búho', c: [0x8a6a48, 0xe8dcc0] },
  // sin animal propio: solo aparece como extra
  puercoespin: { nom: 'Puercoespín', pre: 'Espi', suf: 'espín', c: [0x4a3a2a, 0xe8e0d0] },
};

const P = (id, s, hab = [], extra = {}) => ({ id, s, hab, ...extra });
// tipo de patas: cuadrupedo | bipedo | brazos | aracnido | tentaculos | mantis | reptar
export const PARTES = {
  cabeza: [
    P('leon', [20, 7, 2, 0, 2, 0.3], ['mordida', 'rugido']),
    P('aguila', [10, 6, 0, 0, 6, 0.4], ['picotazo', 'vistaAguda']),
    P('toro', [24, 6, 4, 0, 0, 0.2], ['embestida']),
    P('serpiente', [8, 4, 0, 0, 7, 0.6], ['colmillos']),
    P('lobo', [15, 6, 1, 1, 4, 0.3], ['mordida', 'aullido']),
    P('oso', [26, 8, 3, 0, 0, 0.2], ['mordida']),
    P('escorpion', [12, 5, 5, 0, 2, 0.2], ['mordida']),
    P('murcielago', [12, 5, 1, 1, 6, 0.2], ['vampiro', 'ecolocacion']),
    P('cocodrilo', [20, 6, 4, 0, 0, 0.4], ['giroMortal']),
    P('tiburon', [18, 6, 2, 0, 1, 0.4], ['desgarro', 'frenesi']),
    P('rinoceronte', [24, 5, 6, 0, 0, 0.3], ['cuernoRino']),
    P('arana', [14, 5, 1, 0, 5, 0.2], ['colmillos', 'telarana']),
    P('mantis', [8, 6, 0, 0, 8, 0.2], ['vistaAguda']),
    P('gorila', [24, 7, 2, 0, 2, 0.2], ['golpePecho']),
    P('pulpo', [18, 5, 2, 0, 5, 0.4], ['tinta']),
    P('ciervo', [14, 4, 1, 1, 4, 0.3], ['astas']),
    P('tortuga', [18, 4, 7, 0, 0, 0.2], ['mordida']),
    P('buho', [10, 4, 1, 0, 6, 0.3], ['picotazo', 'sabiduria']),
  ],
  torso: [
    P('leon', [70, 5, 4, 2, 3, 0]),
    P('aguila', [56, 3, 3, 2, 7, 0]),
    P('toro', [95, 5, 6, 0, 0, 0]),
    P('serpiente', [58, 2, 3, 1, 5, 0.3], ['regeneracion']),
    P('lobo', [62, 4, 3, 3, 5, 0]),
    P('oso', [92, 4, 6, 0, 0, 0]),
    P('escorpion', [65, 3, 10, 0, 2, 0]),
    P('murcielago', [54, 2, 2, 2, 9, 0]),
    P('cocodrilo', [85, 3, 9, -1, 0, 0]),
    P('tiburon', [78, 6, 4, 2, 2, 0]),
    P('rinoceronte', [100, 3, 11, -1, -2, 0]),
    P('arana', [64, 3, 4, 1, 6, 0], ['telarana']),
    P('mantis', [42, 4, 1, 2, 9, 0]),
    P('gorila', [86, 6, 5, 0, 2, 0]),
    P('pulpo', [58, 2, 2, 0, 6, 0], ['regeneracion']),
    P('ciervo', [56, 3, 2, 4, 6, 0]),
    P('tortuga', [86, 1, 14, -1, -3, 0], ['caparazon']),
    P('buho', [62, 3, 3, 1, 8, 0]),
  ],
  patas: [
    P('leon', [10, 3, 0, 4, 4, 0.2], ['zarpazo'], { tipo: 'cuadrupedo' }),
    P('aguila', [5, 3, 0, 2, 4, 0.2], ['zarpazo'], { tipo: 'bipedo' }),
    P('toro', [15, 3, 2, 3, 0, 0], [], { tipo: 'cuadrupedo' }),
    P('lobo', [8, 2, 0, 5, 5, 0], [], { tipo: 'cuadrupedo' }),
    P('oso', [12, 3, 1, 2, 1, 0.2], ['zarpazo'], { tipo: 'cuadrupedo' }),
    P('escorpion', [10, 2, 3, 2, 2, 0.4], ['pinzas'], { tipo: 'aracnido', n: 6 }),
    P('arana', [8, 2, 1, 3, 7, 0], [], { tipo: 'aracnido', n: 8 }),
    P('cocodrilo', [16, 3, 3, 2, 1, 0], [], { tipo: 'cuadrupedo', corto: true }),
    P('gorila', [12, 3, 1, 2, 2, 0.4], ['punetazo'], { tipo: 'brazos' }),
    P('pulpo', [8, 1, 0, 1, 4, 0.6], ['constriccion'], { tipo: 'tentaculos' }),
    P('ciervo', [8, 2, 1, 6, 8, 0], [], { tipo: 'cuadrupedo', largo: true }),
    P('mantis', [4, 2, 0, 3, 4, 0.4], ['guadana'], { tipo: 'mantis' }),
    P('rinoceronte', [22, 2, 5, 2, 0, 0], [], { tipo: 'cuadrupedo' }),
    P('tortuga', [22, 2, 5, 0, 1, 0], [], { tipo: 'cuadrupedo', corto: true }),
    P('serpiente', [6, 2, 2, 2, 7, 0.2], ['constriccion'], { tipo: 'reptar' }),
  ],
  cola: [
    P('ninguna', [0, 1, 0, 1, 2, 0]),
    P('leon', [5, 1, 0, 0, 2, 0]),
    P('toro', [6, 1, 1, 0, 1, 0]),
    P('serpiente', [5, 1, 0, 0, 2, 0.4], ['constriccion']),
    P('lobo', [4, 0, 0, 1, 2, 0]),
    P('escorpion', [3, 1, 0, 0, 0, 0.6], ['aguijon']),
    P('cocodrilo', [5, 1, 1, 0, 0, 0.3], ['coletazo']),
    P('tiburon', [5, 1, 0, 1, 3, 0], ['coletazo']),
    P('ciervo', [3, 0, 0, 1, 4, 0]),
    P('oso', [7, 1, 1, 0, 1, 0]),
  ],
  alas: [
    P('ninguna', [0, 0, 0, 0, 0, 0]),
    P('aguila', [3, 1, 0, 1, 2, 0], ['vuelo']),
    P('murcielago', [3, 0, 0, 1, 5, 0], ['vuelo']),
    P('buho', [4, 0, 0, 1, 4, 0], ['vuelo']),
    P('mantis', [2, 0, 0, 2, 4, 0], ['vuelo']),
  ],
  extra: [
    P('ninguno', [0, 1, 0, 1, 2, 0], [], { nom: 'Ninguno' }),
    P('cuernos', [3, 1, 1, 0, 0, 0.1], ['embestida'], { nom: 'Cuernos de toro', animal: 'toro' }),
    P('cuernoRino', [3, 1, 1, 0, 0, 0.1], ['cuernoRino'], { nom: 'Cuerno de rinoceronte', animal: 'rinoceronte' }),
    P('astas', [3, 1, 1, 0, 1, 0.4], ['astas'], { nom: 'Astas de ciervo', animal: 'ciervo' }),
    P('caparazon', [25, 0, 12, -2, -3, 0], ['caparazon'], { nom: 'Caparazón', animal: 'tortuga' }),
    P('puas', [5, 0, 4, 0, 0, 0], ['puas'], { nom: 'Púas', animal: 'puercoespin' }),
    P('melena', [10, 1, 3, 0, 0, 0], ['melena'], { nom: 'Melena', animal: 'leon' }),
    P('pinzas', [3, 2, 1, 0, 0, 0.3], ['pinzas'], { nom: 'Pinzas', animal: 'escorpion' }),
    P('aleta', [5, 1, 0, 1, 2, 0], ['frenesi'], { nom: 'Aleta dorsal', animal: 'tiburon' }),
  ],
};
export const RANURAS = ['cabeza', 'torso', 'patas', 'cola', 'alas', 'extra'];
export const NOM_RANURA = { cabeza: 'Cabeza', torso: 'Torso', patas: 'Patas', cola: 'Cola', alas: 'Alas', extra: 'Extra' };
export const parte = (ranura, id) => PARTES[ranura].find((p) => p.id === id) || PARTES[ranura][0];
export const nomParte = (ranura, id) => { const p = parte(ranura, id); return p.nom || ANIMALES[p.id]?.nom || 'Ninguna'; };
export const animalDe = (ranura, id) => { const p = parte(ranura, id); return p.animal || (ANIMALES[p.id] ? p.id : null); };

// tipo: ataque (cuerpo a cuerpo) | carga (embestida a distancia media) | grito | vuelo | escudo | distancia | agarre | pasiva
// mult: multiplicador de la fuerza; cd: recarga en segundos; alc: alcance extra; el resto son efectos
export const HAB = {
  golpe: { nom: 'Golpe', tipo: 'ataque', cd: 0, mult: 1 },
  mordida: { nom: 'Mordida', tipo: 'ataque', cd: 3, mult: 1.5, sangrado: 0.25, desc: 'Muerde fuerte; puede hacer sangrar.' },
  picotazo: { nom: 'Picotazo', tipo: 'ataque', cd: 2, mult: 1.15, crit: 0.25, desc: 'Rápido y preciso: busca el crítico.' },
  zarpazo: { nom: 'Zarpazo', tipo: 'ataque', cd: 3, mult: 1.25, sangrado: 0.45, desc: 'Garras que abren heridas sangrantes.' },
  desgarro: { nom: 'Desgarro', tipo: 'ataque', cd: 4, mult: 1.35, sangrado: 0.6, desc: 'Dientes de sierra: sangrado seguro.' },
  giroMortal: { nom: 'Giro mortal', tipo: 'ataque', cd: 9, mult: 2.1, sangrado: 0.5, desc: 'Muerde y gira: daño brutal, recarga larga.' },
  colmillos: { nom: 'Colmillos venenosos', tipo: 'ataque', cd: 5, mult: 0.8, veneno: 1.6, desc: 'Inyecta veneno que corroe con el tiempo.' },
  aguijon: { nom: 'Aguijón', tipo: 'ataque', cd: 7, mult: 0.8, veneno: 1.3, alc: 0.5, desc: 'Pica por encima: veneno fuerte.' },
  vampiro: { nom: 'Mordida vampira', tipo: 'ataque', cd: 4, mult: 1.1, robo: 0.6, desc: 'Se cura con la sangre del rival.' },
  guadana: { nom: 'Guadaña', tipo: 'ataque', cd: 3, mult: 1.2, crit: 0.35, desc: 'Tajo veloz con altísimo crítico.' },
  punetazo: { nom: 'Puñetazo', tipo: 'ataque', cd: 4, mult: 1.35, aturdir: [0.25, 0.9], desc: 'Golpe que puede aturdir.' },
  pinzas: { nom: 'Pinzas', tipo: 'ataque', cd: 5, mult: 1.25, atrapar: 1.2, desc: 'Atenaza al rival un instante.' },
  coletazo: { nom: 'Coletazo', tipo: 'ataque', cd: 5, mult: 1.25, empuje: 3, alc: 0.8, aturdir: [0.15, 0.7], desc: 'Barre y empuja lejos.' },
  embestida: { nom: 'Embestida', tipo: 'carga', cd: 9, mult: 1.8, aturdir: [0.4, 1.1], empuje: 3, desc: 'Toma impulso y embiste: aturde.' },
  cuernoRino: { nom: 'Cornada de rino', tipo: 'carga', cd: 9, mult: 2.1, aturdir: [0.5, 1.2], empuje: 4, desc: 'Embestida demoledora.' },
  astas: { nom: 'Astas', tipo: 'carga', cd: 7, mult: 1.3, empuje: 4, sangrado: 0.2, desc: 'Carga ágil con las astas.' },
  rugido: { nom: 'Rugido', tipo: 'grito', cd: 13, miedo: 3, desc: 'Asusta al rival: huye y pega menos.' },
  aullido: { nom: 'Aullido', tipo: 'grito', cd: 14, furia: 6, desc: 'Se enardece: más fuerza un rato.' },
  golpePecho: { nom: 'Golpe de pecho', tipo: 'grito', cd: 14, furia: 6, miedo: 1.5, desc: 'Se enfurece e intimida.' },
  vuelo: { nom: 'Vuelo', tipo: 'vuelo', cd: 11, dur: 4, mult: 1.7, desc: 'Se eleva: casi intocable; cae en picada.' },
  caparazon: { nom: 'Caparazón', tipo: 'escudo', cd: 12, dur: 3, desc: 'Se encierra: aguanta 70 % menos daño y se cura.' },
  tinta: { nom: 'Chorro de tinta', tipo: 'distancia', cd: 13, ceguera: 4, desc: 'Ciega al rival: falla mucho más.' },
  telarana: { nom: 'Telaraña', tipo: 'distancia', cd: 11, lento: 4, desc: 'Lo enreda: más lento y torpe.' },
  constriccion: { nom: 'Constricción', tipo: 'agarre', cd: 12, atrapar: 2.2, mult: 0.35, desc: 'Lo aprieta: no se mueve y sufre.' },
  // pasivas
  regeneracion: { nom: 'Regeneración', tipo: 'pasiva', desc: 'Recupera vida poco a poco.' },
  ecolocacion: { nom: 'Ecolocación', tipo: 'pasiva', desc: 'Inmune a la ceguera; más puntería.' },
  vistaAguda: { nom: 'Vista aguda', tipo: 'pasiva', desc: '+8 % de crítico.' },
  sabiduria: { nom: 'Sabiduría nocturna', tipo: 'pasiva', desc: 'Esquiva más y lee los golpes.' },
  frenesi: { nom: 'Frenesí', tipo: 'pasiva', desc: '+25 % de daño a quien sangra.' },
  puas: { nom: 'Púas', tipo: 'pasiva', desc: 'Devuelve parte del daño cuerpo a cuerpo.' },
  melena: { nom: 'Melena', tipo: 'pasiva', desc: 'No siente miedo; protege el cuello.' },
};

// técnicas que aprenden al subir de nivel (2, 4, 6, 8, 10)
export const TECNICAS = {
  contraataque: { nom: 'Contraataque', desc: 'Tras esquivar, a veces responde al instante.' },
  instinto: { nom: 'Instinto asesino', desc: '+10 % de crítico.' },
  segundoAliento: { nom: 'Segundo aliento', desc: 'Una vez por pelea, al borde de caer, recupera 25 % de vida.' },
  finta: { nom: 'Finta', desc: '+6 % de esquiva.' },
  furiaFinal: { nom: 'Furia final', desc: '+30 % de daño con menos de 30 % de vida.' },
  pielCurtida: { nom: 'Piel curtida', desc: '+15 % de defensa.' },
  aguante: { nom: 'Aguante', desc: 'Los estados le duran 40 % menos.' },
  cazador: { nom: 'Cazador', desc: 'Recargas 15 % más rápidas.' },
};

export const TEMPERAMENTOS = {
  agresivo: { nom: 'Agresivo', desc: 'Va siempre al frente y pega más, pero se cubre menos.' },
  cauteloso: { nom: 'Cauteloso', desc: 'Golpea y se retira; se defiende y se rinde antes de morir.' },
  astuto: { nom: 'Astuto', desc: 'Debilita primero y remata cuando el rival está indefenso.' },
};

export const HERIDAS = {
  pata: { nom: 'Pata coja', stat: 'velocidad', k: 0.75 },
  ojo: { nom: 'Ojo herido', stat: 'agilidad', k: 0.75 },
  costillas: { nom: 'Costillas rotas', stat: 'vida', k: 0.85 },
  colmillo: { nom: 'Colmillo partido', stat: 'fuerza', k: 0.85 },
  ala: { nom: 'Ala rota', stat: 'vuelo', k: 0 },
};
