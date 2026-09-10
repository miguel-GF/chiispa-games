# Análisis crítico de CHISPA V3

## 1. Dictamen ejecutivo

La propuesta tiene una tesis de producto clara y defendible: **la televisión es
el escenario público y el teléfono aporta entrada inmediata o información
privada**. Esa restricción es más valiosa que la lista de microjuegos porque sirve
como criterio para aceptar o descartar ideas.

La V3 mejora sustancialmente el concepto original en cuatro puntos:

1. reemplaza la carrera por cantidad de contenido por validación de repetición;
2. adelanta Mini Bomba para probar la ventaja estructural del formato;
3. separa microjuegos, juegos sociales y jefes;
4. difiere cuentas, pagos y expansión hasta obtener evidencia de uso repetido.

El mayor riesgo no es técnico. Crear una sala y retransmitir entradas por
WebSocket es relativamente directo. Los riesgos decisivos son **conseguir una
primera risa rápidamente**, sostener el ritmo entre rondas y fabricar contenido
que siga siendo gracioso después de desaparecer la sorpresa.

**Recomendación:** aprobar únicamente Fase 0 y Fase 1 como inversión inicial. No
aprobar todavía Cloudflare, pagos, Laboratorio, plataformas externas ni un
catálogo grande. El siguiente hito no debe ser “la arquitectura está completa”,
sino “dos de tres grupos pidieron otra partida sin ayuda”.

## 2. Lo más sólido del documento

### 2.1 Restricciones que producen decisiones

“La pantalla grande es el juego” y “entrada privada, resolución pública” permiten
evaluar mecánicas sin depender del gusto personal. Una idea que obliga a mirar el
teléfono durante toda la ronda o resuelve el resultado en privado queda fuera,
aunque técnicamente sea entretenida.

### 2.2 El teléfono se usa por sus ventajas reales

El concepto evita imitar un gamepad genérico. Tacto, movimiento, micrófono,
teclado, dibujo e información secreta son capacidades diferenciadoras. Mini
Bomba, Impostor y La mentira justifican mejor la arquitectura que un simple botón
remoto.

### 2.3 Validación orientada a comportamiento

“Otra”, repetición sin el creador, mirada hacia la pantalla compartida y tiempo a
la primera risa son señales más útiles que visitas o retención diaria para un
producto de reuniones. Además, el criterio de corte evita responder a un núcleo
débil produciendo más contenido.

### 2.4 Monetización congruente con el contexto

Starter permanente, compra por anfitrión y Party Pass plantean una escalera
coherente con uso ocasional. Es importante mantenerlos como hipótesis comerciales,
no como funcionalidades comprometidas antes de validar repetición.

## 3. Tensiones y decisiones pendientes

El texto recibido contiene dos copias prácticamente completas del documento. En
la documentación canónica conviene mantener una sola V3 y mover la V2 a historial;
de otro modo, decisiones antiguas como la rotación semanal gratis compiten con la
decisión posterior de Starter permanente.

### 3.1 Microjuegos de cinco segundos frente a permisos

Movimiento y micrófono no deben estar en el primer camino crítico. Los permisos,
compatibilidad y calibración pueden consumir más tiempo que la propia ronda. La
Fase 0 debe usar solo toque; Fase 1 puede añadir movimiento tras una comprobación
de capacidades previa y nunca solicitar permisos durante una cuenta regresiva.

### 3.2 Inmediatez frente a presentación de dos segundos

Una presentación fija de dos segundos antes de cada microjuego puede representar
una parte excesiva de una sesión de rondas de tres a cinco segundos. Debe medirse y
reducirse después de las primeras rondas: por ejemplo, 2 s al inicio, 1 s después,
o integrarla con la instrucción y la cuenta regresiva.

### 3.3 Rejilla frente a “todos miran lo mismo”

La rejilla permite ver fracasos, pero divide la atención. El primer microjuego
debería preferir un escenario compartido: un objetivo público y contribuciones
identificadas por color/forma. La rejilla se valida más adelante y nunca debe ser
la única representación del resultado.

### 3.4 Reconexión “con el mismo código” es insuficiente

El código identifica la sala, no el asiento. El controlador necesita conservar un
`resumeToken` opaco en almacenamiento local; el servidor debe reservar el asiento
por un periodo limitado y rotar o invalidar el token cuando corresponda. Usar solo
nombre + código permite secuestrar la identidad de otro jugador.

### 3.5 Tiempo del cliente frente a autoridad del servidor

Enviar `t` es útil para telemetría y estimación de latencia, pero no debe permitir
que un cliente retrodate entradas. El servidor debe validar cada entrada contra
una ventana de ronda calculada en reloj monotónico del servidor y aplicar una
tolerancia explícita. Para el prototipo, es preferible una regla comprensible y
algo generosa a una falsa precisión.

### 3.6 Azar de remontada frente a justicia percibida

Un golpe aleatorio capaz de invertir el marcador puede conservar interés, pero
también invalidar el desempeño anterior. Debe presentarse de antemano, limitar su
magnitud y requerir alguna acción. “Multiplicador final visible” es más defendible
que reasignar puntos arbitrariamente.

### 3.7 Supervivencia aumenta demasiado el primer alcance

Convertir eliminados en público activo exige votación, sabotajes, balance y nuevos
estados del controlador. Para validar el núcleo basta que los eliminados sigan
participando en rondas sin puntuar o animando con una única reacción. El sistema
de sabotaje pertenece a una fase posterior.

## 4. Alcance recomendado para el primer prototipo

### 4.1 Flujo vertical mínimo

1. La pantalla abre una conexión y crea una sala.
2. El servidor devuelve código de cuatro letras y URL de acceso.
3. La pantalla genera y muestra el QR desde esa URL.
4. Dos a seis controladores escriben nombre y se unen.
5. Cada uno recibe color, forma, `playerId` y `resumeToken`.
6. El anfitrión inicia una ronda de toque.
7. El servidor anuncia la ronda con al menos un segundo de anticipación.
8. Los teléfonos muestran feedback local inmediato al tocar.
9. El servidor valida entradas y publica el resultado.
10. La pantalla presenta ganador, marcador y opción de repetir.
11. Un teléfono recarga y recupera su asiento.

Todo lo que no sea necesario para demostrar este flujo queda fuera de Fase 0.

### 4.2 Primer microjuego recomendado

**¡APLASTA!** es adecuado si mantiene la acción en la pantalla compartida:

- aparece públicamente un objetivo después de una espera aleatoria;
- los teléfonos son botones grandes del color/forma de cada jugador;
- tocar antes de tiempo bloquea al jugador o aplica una penalización clara;
- la primera entrada válida aplasta el objetivo;
- la pantalla muestra públicamente quién acertó y quién se precipitó;
- la ventana válida es amplia y el servidor es autoritativo.

Esto prueba conexión, anticipación, feedback local, entradas concurrentes,
resultado público y marcador con una sola mecánica.

### 4.3 Fuera de alcance explícito

- cuentas y autenticación del anfitrión;
- pagos, Starter, CHISPA+ y Party Pass;
- analítica de producto en producción;
- micrófono, dibujo y movimiento;
- Durable Objects, AirConsole, Capacitor y PWA;
- editor o contenido creado por usuarios;
- selección sofisticada del director;
- Traidor, sabotajes y público activo;
- arte final, audio final y catálogo parametrizado.

## 5. Arquitectura mínima propuesta

Un monorepo TypeScript sigue siendo una buena elección, pero la frontera útil no
es solo por dispositivo. También debe separar lógica determinista de render y
transporte:

```text
apps/
  screen/          # interfaz de pantalla compartida
  controller/      # interfaz móvil
  server/          # autoridad de salas y rondas
packages/
  protocol/        # mensajes y validación en runtime
  game-core/       # ciclo de vida y tipos compartidos
  games/
    reaction/      # lógica pura del primer motor
```

### 5.1 Contrato de juego

No conviene incluir objetos del DOM o Canvas en el contrato central, porque eso
mezcla reglas con presentación e impide ejecutar la lógica en Node. El núcleo debe
ser puro y serializable:

```ts
type PlayerId = string;

interface PlayerResult {
  success: boolean;
  score: number;
  rank?: number;
  timeMs?: number;
  accuracy?: number;
  metadata?: Record<string, unknown>;
}

interface GameDefinition<State, Input> {
  id: string;
  kind: 'micro' | 'social' | 'boss';
  requirements: readonly InputCapability[];
  metadata: GameMetadata;
  create(players: readonly PlayerId[], seed: number): State;
  reduce(state: State, event: GameEvent<Input>): State;
  result(state: State): Record<PlayerId, PlayerResult> | null;
}
```

`screen` y `controller` deben tener renderizadores separados que consuman una
vista del estado autorizada para cada audiencia. Esto es crítico para impedir que
la pantalla pública reciba secretos de Mini Bomba o Impostor.

### 5.2 Estado de sala explícito

Una máquina de estados evita comandos imposibles y carreras:

```text
LOBBY → COUNTDOWN → PLAYING → REVEAL → SCOREBOARD
  ↑                                      |
  └──────────────────────────────────────┘
```

Cada comando debe incluir `roomId`, versión o `roundId` e identidad de conexión.
El servidor ignora entradas de rondas antiguas y hace idempotentes, cuando sea
posible, unión, listo y reconexión.

### 5.3 Protocolo discriminado y validado

Los tipos TypeScript no validan mensajes de red en ejecución. Cada mensaje debe
ser una unión discriminada y validarse al entrar al servidor. Como mínimo:

```text
screen.createRoom
screen.startRound
controller.join
controller.resume
controller.ready
controller.input
server.roomSnapshot
server.roundScheduled
server.roundResolved
server.error
```

La pantalla no debería poder enviar resultados; únicamente solicita transiciones.
El servidor crea el estado, procesa las entradas y calcula el resultado.

### 5.4 Semillas y visibilidad

Una semilla compartida permite animaciones reproducibles, pero no debe revelar de
antemano objetivos secretos o momentos que habiliten trampas. Deben distinguirse:

- semilla pública de presentación;
- estado privado por jugador;
- decisiones secretas conservadas únicamente en servidor;
- estado público derivado para pantalla.

## 6. Requisitos no funcionales de Fase 0

| Área | Criterio inicial |
|---|---|
| Entrada | feedback visual local en el mismo frame del toque |
| Autoridad | ningún cliente calcula o publica el ganador |
| Reconexión | recargar el controlador recupera asiento y color |
| Duplicados | una entrada repetida no puntúa dos veces |
| Sala | códigos no ambiguos y comparación sin distinguir mayúsculas |
| Ritmo | del último jugador listo a la acción hay pocos segundos |
| Accesibilidad | color siempre acompañado de forma y texto útil |
| Responsive | controlador usable con una mano y sin scroll accidental |
| Seguridad | límites de frecuencia, tamaño y esquema de mensajes |
| Observabilidad | logs con sala anonimizada, ronda y transición de estado |

El código de cuatro letras es una herramienta de acceso cómodo, no un secreto de
alta seguridad. Aun así, deben limitarse intentos de unión, tamaño de nombres y
frecuencia de entradas para evitar que una sala sea trivialmente inutilizable.

## 7. Estrategia de pruebas

### 7.1 Automatizadas

- pruebas unitarias del reductor del juego con reloj y semilla controlados;
- entradas antes, dentro y después de la ventana válida;
- dos entradas simultáneas y desempate determinista;
- repetición y reordenamiento de mensajes;
- reconexión durante lobby, ronda y resultado;
- serialización y validación de todos los mensajes;
- transición inválida rechazada por la máquina de estados;
- proyección pública sin campos privados.

### 7.2 Técnica multidispositivo

- iOS Safari y Android Chrome reales;
- laptop conectada por Wi-Fi y por cable;
- pestaña en segundo plano, bloqueo de pantalla y recarga;
- red lenta, latencia artificial y pérdida breve de conexión;
- dos jugadores con el mismo nombre;
- seis controladores enviando entradas casi simultáneas;
- QR abierto desde una URL HTTPS accesible, no desde `localhost` del anfitrión.

### 7.3 Sesiones de producto

Usar una hoja de observación idéntica para los tres grupos:

| Métrica | Cómo registrar |
|---|---|
| tiempo a primera acción | desde que aparece el QR |
| tiempo a primera risa | cronómetro y marca de ronda |
| risas | conteo por ronda, sin interpretar intensidad |
| atención | TV / teléfono / conversación por ronda |
| explicación externa | qué tuvo que explicar el moderador |
| repetición inmediata | quién la pidió y después de qué juego |
| recuerdo | juegos nombrados al final sin mostrar lista |
| regreso | nueva sala creada sin presencia del desarrollador |

Las métricas no sustituyen notas cualitativas. Conviene registrar también la frase
exacta que provocó confusión, el momento muerto y el fracaso público que generó
risa.

## 8. Puertas de decisión

### Puerta T — viabilidad técnica

Avanzar si dos a seis teléfonos pueden unirse, jugar, ver un resultado coherente y
recuperar asiento sin intervención manual. Si falla, corregir transporte y flujo;
no añadir microjuegos.

### Puerta A — diversión inicial

Avanzar si al menos dos de tres grupos piden espontáneamente otra partida y la
atención permanece principalmente en la pantalla grande. Si falla, iterar orden,
feedback, instrucciones y mecánicas antes de aumentar catálogo.

### Puerta B — repetición

Avanzar a contenido premium solo si aparecen salas creadas posteriormente sin el
desarrollador y algunos juegos mantienen repetición. Una sesión exitosa puede ser
novedad; el regreso demuestra utilidad.

### Puerta C — disposición a pagar

Antes de integrar pagos, probar ofertas ficticias o entrevistas posteriores a la
sesión, sin bloquear el juego. Comparar intención y luego conversión real entre
Party Pass, mes y año. No fijar precio por intuición.

## 9. Secuencia recomendada de entrega

### Semana de prototipo técnico

- sala, QR y unión;
- identidad color + forma;
- máquina de estados;
- ¡APLASTA! autoritativo;
- resultado y marcador;
- reconexión con token;
- pruebas del protocolo y del reductor.

### Paquete de validación

- cinco experiencias realmente distintas, no cinco apariencias del mismo botón;
- Rally corto con curva de energía manual;
- transición, presentación y podio;
- instrumentación mínima de tiempos y errores;
- tres sesiones observadas.

### Prueba diferenciadora

- Mini Bomba con dos o tres módulos;
- proyección privada por jugador;
- temporizador y resolución pública;
- prueba específica de filtración de secretos;
- nueva ronda de observación centrada en conversación y atención.

El director automatizado y los motores parametrizables deben extraerse solo cuando
existan suficientes juegos reales para descubrir patrones. Diseñarlos antes puede
crear abstracciones alrededor de mecánicas todavía no validadas.

## 10. Veredicto final

CHISPA tiene una base conceptual más disciplinada que muchos party games porque
define tanto lo que es como lo que no es. Mini Bomba ofrece una diferenciación más
fuerte que la promesa genérica de “muchos microjuegos”, mientras que el Starter y
Party Pass ofrecen una hipótesis comercial plausible sin contaminar el primer
contacto.

La amenaza principal es la sobreconstrucción: protocolo universal, director,
catálogo parametrizado, laboratorio, cuentas, pagos y múltiples plataformas
pueden consumir meses antes de saber si una sala se ríe. El camino correcto es un
corte vertical pequeño, autoritativo y observable, seguido rápidamente por pruebas
presenciales.

La decisión operativa inmediata es sencilla:

> Construir una sala, un botón y un resultado público; después observar personas,
> no añadir infraestructura.
