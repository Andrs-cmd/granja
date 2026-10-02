# Granja 3D: simulación autónoma

Una pareja (Tomás y Lucía), su perro (Nube) y su gato (Esmoquin) viven dentro de un orbe de vidrio. **Nadie los controla**: deciden solos qué sembrar, cuándo regar, sacar y filtrar agua, comer, dormir y cuidar a los animales. La idea es mirar cuánto duran y cómo avanzan.

## Cómo se ve
- **Pantalla:** solo la escena, sin indicadores.
- **Velocidad:** abajo hay un control que se esconde solo (*Tiempo real*, ×60, ×600, ×3600; teclas `1`–`4`).
- **Tiempo real:** por defecto un minuto de la granja es un minuto real, y el reloj arranca a la hora del equipo. Si es de noche donde estás, en el orbe también.
- **Vida continua:** al volver a abrir la página se simula lo que pasó mientras estaba cerrada (hasta 120 días).
- **Generaciones:** si mueren los dos humanos, a los 20 s empieza una generación nueva, y cada generación queda registrada en el historial.

## Las fichas (`js/personajes.js`)
Cada personaje tiene una ficha. Cada dato cambia su comportamiento real, no es solo texto:
- **Rasgos:** modificadores numéricos (hambre, sed, cansancio, velocidad por área, agua del pozo, cosecha, aprendizaje, riesgo de enfermar).
- **Personalidad (Big Five):**
  - *Apertura:* varía cultivos y prueba recetas nuevas.
  - *Responsabilidad:* riega antes, guarda más agua, limpia la casa y prefiere trabajar antes que el ocio.
  - *Extraversión:* necesita compañía más seguido y busca conversar.
  - *Amabilidad:* comparte la comida en la escasez y discute menos.
  - *Neuroticismo:* las malas noticias le afectan más y puede llorar si se pierde una cosecha.
- **Hábitos:**
  - *cronotipo:* madrugador, normal o noctámbulo;
  - *ocio favorito:* leer, tallar, contemplar, jugar con el gato o pasear al perro;
  - *comida favorita*;
  - *afinidad con cada mascota*;
  - *reacción al estrés:* trabaja más o raciona;
  - *rol:* área que prefiere en la granja.
- **Físico:** forma de andar y detalles visibles.
- **Para aplicar cambios:** al cambiar `CONFIG`, empieza una generación nueva con las fichas actualizadas.

## La vida diaria
- **Necesidades:** comida, agua, energía, salud, **compañía** y **diversión**.
- **Ánimo:** sale de las necesidades más "recuerdos" que se desvanecen (una buena cosecha, una discusión, una cena juntos, un duelo). Con ánimo alto trabajan más rápido y con ánimo bajo se encorvan.
- **Ocio:** leer en la banca, tallar madera en el tronco, contemplar el paisaje desde el mirador, jugar con el gato, pasear al perro alrededor del bloque y siesta.
- **Pareja:**
  - charlas en la banca, que pueden acabar en discusión según el ánimo, el hambre, el cansancio y qué tan distintos son;
  - abrazos al cruzarse;
  - cena juntos todas las noches (cocina quien tenga más mano o más apertura);
  - **relación** de 0 a 100, que se enfría sola si no se cuida;
  - momentos íntimos insinuados, fuera de cámara: solo de noche, con privacidad, buen ánimo y la casa limpia. El gato puede interrumpirlos.
- **Mascotas:** el gato duerme con quien esté más triste (y lo calma), pide atención cuando alguien cocina y caza ratones, aunque a veces pisotea el huerto. El perro necesita paseos y espanta plagas.

## Datos flotantes
- **Sobre cada personaje:** cara de ánimo, nombre, lo que hace y 4 barritas (comida, agua, energía, salud). Si está en casa, la etiqueta queda junto a la puerta.
- **Sobre las parcelas:** avance de cada cultivo.
- **Tarjeta general:** generación, fecha, reservas, relación y limpieza de la casa.
- **Para ocultarlos:** botón **Datos** o tecla `D`.

## Reglas
- **Necesidades** (0–100): comida, agua, energía y salud. En 0 de salud el personaje muere.
- **Habilidades:** huerto, agua y cuidado suben con la práctica hasta el nivel 10, y con cada nivel trabajan más rápido.
- **Cultivos:**

  | Cultivo | Días | Raciones | Estaciones |
  |---|---|---|---|
  | Lechuga | 7 | 6 | primavera y otoño |
  | Papa | 14 | 14 | primavera, verano y otoño |
  | Fríjol | 12 | 10 | primavera y verano |
  | Maíz | 18 | 20 | solo verano |

  En invierno no crece nada. Eligen qué sembrar según lo que alcance a madurar en la estación.
- **Agua:** la lluvia llena el tanque (600 L) y el pozo da 40 L por hora. El agua sin filtrar puede enfermar.
- **Riesgos:**
  - sequías de verano;
  - plagas, que el gato puede frenar;
  - heladas a finales de otoño;
  - enfermedades, más probables con la edad o la salud baja;
  - vejez: los animales viven unos 13–16 años de la granja y los humanos unos 70.
- **Despensa:** la comida guardada se pudre un 0,8 % por día.
- **Calendario:** cada estación dura 28 días, así que un año son 112 días.

## Archivos
- `js/personajes.js`: las fichas.
- `js/sim.js`: el motor. Es lógica pura, se puede probar con Node.
- `js/escena.js`: el orbe 3D que dibuja el estado.
- `index.html`: une todo y corre el reloj.

Hay que servirlo con un servidor local (por ejemplo `php -S 127.0.0.1:8805 -t .`).
