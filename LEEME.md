# Granja 3D: simulación autónoma

Una pareja (Tomás y Lucía), su perro (Nube) y su gato (Esmoquin) viven dentro de un orbe de vidrio. **Nadie los controla**: deciden solos qué sembrar, cuándo regar, sacar y filtrar agua, comer, dormir y cuidar a los animales. La idea es mirar cuánto duran y cómo avanzan.

## Cómo se ve
- **Pantalla:** la escena con los datos en dos columnas a los lados, fuera del orbe: habitantes a la izquierda y despensa, granja, hogar y diario a la derecha. Se ocultan con **Datos** o la tecla `D`. En celulares (menos de 480 px) los datos van abajo y el orbe se acomoda arriba.
- **Velocidad:** por defecto ×120 (un día dura 12 minutos). También hay ×60, ×600 y ×3600; teclas `1`–`4`.
- **Vida continua:** al volver a abrir la página se simula lo que pasó mientras estaba cerrada, al mismo ritmo y hasta 30 días.
- **Generaciones:** si mueren los dos humanos, a los 20 s empieza una generación nueva.

## El mundo
Bloque de 44×44 dentro de un orbe de vidrio:
- casa con terraza y huerto de 6 parcelas;
- pozo y tanque de lluvia;
- **corral**, con establo, pesebre y bebedero, para la vaca **Canela** y las ovejas **Algodón** y **Nieve**;
- **gallinero**, con cuatro gallinas y el gallo **Kiko**;
- **piscina**;
- banca, tronco para tallar, mirador, caseta del perro y faroles.

- **Granja:**
  - se ordeña a la vaca en la mañana (leche) y se recogen huevos del nido;
  - las ovejas se esquilan en primavera y verano (lana), y la lana se teje en **abrigos** (sin abrigo, el invierno cansa más y enferma);
  - en verano y otoño se siega el pasto y se guarda **heno** para el invierno, cuando el pasto no crece;
  - la leche y los huevos se comen junto con las verduras, pero se echan a perder rápido.
- **Reproducción:** hay machos y hembras (toro **Tronco**, carnero **Copito**, gallo **Kiko**).
  - **Vacas y ovejas:** paren en primavera; las ovejas pueden tener gemelos.
  - **Gallinas:** se ponen *cluecas* en primavera y verano y empollan 21 días; nacen de 1 a 3 pollitos.
  - **Crías:** nacen con nombre propio, siguen a su madre, brincan y crecen a la vista. El ternero tarda un año, el cordero medio año y el pollito un mes; al crecer, el pollito se vuelve gallina o gallo.
  - **Límite de espacio:** el corral admite 9 animales grandes y el gallinero 14 aves. A más animales, más heno guardan para el invierno.
- **Reacciones al entorno:**
  - **lluvia:** todos se refugian. La pareja entra a la casa a leer, tejer o conversar, el perro va a su caseta, el gato a la casa, el ganado al establo y las gallinas al gallinero;
  - **arcoíris** al escampar, que salen a contemplar;
  - **calor de verano:** nadan o duermen la siesta;
  - **frío de invierno:** más tiempo dentro.
- **Rutas:** rodean la casa y entran al corral y al gallinero por sus puertas.

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
