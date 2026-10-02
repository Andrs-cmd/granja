# Granja 3D: simulación de supervivencia

Una pareja (Tomás y Lucía), su perro (Nube) y su gato (Esmoquin) viven dentro de un orbe de vidrio. Tienen que cultivar, sacar y filtrar agua y cuidarse entre ellos para sobrevivir durante años. **Tú das las órdenes, y si no se cuidan, mueren.**

## Cómo se juega
- **Tiempo:** un día dura 72 s a velocidad ×1. También están ×5, ×20 y ×100, para ver pasar años. Atajos: `espacio` pausa; `1`–`4` cambian la velocidad.
- **Calendario:** cada estación dura 28 días, así que un año son 112 días. **En invierno no crece nada**: hay que guardar comida antes.
- **Órdenes puntuales:** sembrar un cultivo en una parcela, regar, cosechar, limpiar, sacar agua del pozo, filtrar agua y alimentar a los animales. Se pueden asignar a *cualquiera*, a Tomás o a Lucía, y se cancelan desde la cola.
- **Rutina (órdenes permanentes):** lo que hacen solos cuando no tienen órdenes:
  - regar lo que esté seco, cosechar lo que esté listo y limpiar parcelas muertas;
  - cuidar a los animales;
  - resembrar un cultivo;
  - mantener un mínimo de agua potable y de agua en el tanque.
- **Supervivencia (lo deciden solos):** comen, beben y duermen cuando lo necesitan, siempre que haya con qué.

## Reglas de la simulación (`js/sim.js`)
- **Necesidades** (0–100): comida, agua, energía y salud. La salud baja si la comida, el agua o la energía llegan a 0, y en 0 de salud el personaje muere.
  - Sin agua, alguien aguanta alrededor de un día y medio; sin comida, unos tres días.
  - Si tomar agua del tanque sin filtrar es lo único que queda, tiene 40 % de probabilidad de enfermar.
- **Rasgos:**

  | Personaje | Rasgos |
  |---|---|
  | Tomás | *Fuerte* (+50 % de agua del pozo) y *Comilón* (+20 % de hambre) |
  | Lucía | *Mano verde* (trabaja el huerto 40 % más rápido y cosecha 15 % más) y *Ahorradora* (−15 % de hambre) |
  | Nube | *Leal* (sigue a la pareja) |
  | Esmoquin | *Cazador* (caza ratones en el huerto si tiene hambre) |

- **Cultivos:**

  | Cultivo | Días | Raciones | Estaciones |
  |---|---|---|---|
  | Lechuga | 7 | 6 | primavera y otoño |
  | Papa | 14 | 14 | primavera, verano y otoño |
  | Fríjol | 12 | 10 | primavera y verano |
  | Maíz | 18 | 20 | solo verano |

  Una parcela sin agua o fuera de temporada muere a los 2 días. Lo que está listo y no se cosecha se pudre a los 6 días. Cada cosecha devuelve semillas.
- **Agua:** la lluvia llena el tanque (600 L) y riega el huerto, con más lluvia en primavera. El pozo da 40 L por hora (60 L con Tomás). Filtrar convierte agua cruda en potable.
- **Despensa:** la comida guardada se echa a perder un 0,4 % por día.
- **Animales:** comen y beben del comedero y del bebedero, que la pareja tiene que llenar.

El estado completo es un JSON que se guarda solo en el navegador (`localStorage`) cada día de juego y al cerrar la página.

## Archivos
- `js/sim.js`: el motor. Es lógica pura, sin gráficos, así que se puede probar con Node.
- `js/escena.js`: el orbe 3D, que dibuja el estado: huerto, pozo, tanque, lluvia, personajes y lápidas.
- `js/ui.js`: el panel de habitantes, recursos, huerto, órdenes, rutina y diario.
- `index.html`: une todo y corre el bucle de tiempo.

Hay que servirlo con un servidor local (por ejemplo `php -S 127.0.0.1:8805 -t .`).

## Próximas fases
2. Personalidad: ánimo, habilidades que suben con la práctica y la relación de pareja.
3. Granja: gallinas, el perro guardián y el gato contra las plagas.
4. Eventos y progreso: sequías, plagas, enfermedades, construcciones (invernadero, compostera, más parcelas) e hijos.
