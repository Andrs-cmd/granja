# Granja 3D: simulación autónoma

Una pareja (Tomás y Lucía), su perro (Nube) y su gato (Esmoquin) viven dentro de un orbe de vidrio. **Nadie los controla**: deciden solos qué sembrar, cuándo regar, sacar y filtrar agua, comer, dormir y cuidar a los animales. La idea es mirar cuánto duran y cómo avanzan.

## Cómo se ve
- **Pantalla:** solo la escena, sin indicadores.
- **Velocidad:** abajo hay un control que se esconde solo (*Tiempo real*, ×60, ×600, ×3600; teclas `1`–`4`).
- **Tiempo real:** por defecto un minuto de la granja es un minuto real, y el reloj arranca a la hora del equipo. Si es de noche donde estás, en el orbe también.
- **Vida continua:** al volver a abrir la página se simula lo que pasó mientras estaba cerrada (hasta 120 días).
- **Generaciones:** si mueren los dos humanos, a los 20 s empieza una generación nueva, y cada generación queda registrada en el historial.

## Las fichas (`js/personajes.js`)
Las características de cada personaje se definen ahí y cambian su comportamiento real:
- **Rasgos:** modifican números de la simulación (hambre, sed, cansancio, velocidad por área, agua del pozo, cosecha, aprendizaje, probabilidad de enfermar).
- **Físico:** la forma de andar (*zancada* desde los hombros o *cadera* fluida) y detalles visibles (sombrero, barba, pecas, diadema, collar, pañuelo).
- **Psique:**
  - motivación;
  - rol, que es el área que prefiere cuando hay varias tareas;
  - reacción al estrés cuando escasea la comida o el agua: *trabaja* (20 % más rápido, pero se cansa más) o *raciona* (aguanta más antes de comer);
  - estilo de comunicación.
- **Para aplicar cambios:** al cambiar `CONFIG`, la granja empieza de cero con las fichas nuevas.

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
