# CHISPA Games

Repositorio de diseño y futura implementación de **CHISPA**, un party pack web en
el que una pantalla compartida concentra el espectáculo y los celulares funcionan
como controles e interfaces privadas.

## Documentación

- [Análisis crítico y plan ejecutable de la V3](docs/analisis-v3.md)

## Estado

El proyecto ya cuenta con el primer corte vertical de **Fase 0**:

- pantalla anfitriona con sala de cuatro letras y QR;
- controlador móvil con identidad por color y forma;
- servidor WebSocket autoritativo;
- reconexión de asiento mediante token local;
- un Rally automático de cinco microjuegos táctiles: **¡APLASTA!**, **¡ATACA!**,
  **¡CLAVA!**, **¡NI LO TOQUES!** y **¡ELIGE!**;
- resultados ricos por ronda, marcador acumulado, podio y repetición;
- una **Mini Bomba** cooperativa final con pistas privadas repartidas entre los
  celulares, cables públicos, dos oportunidades y resolución en la pantalla.

## Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` como pantalla grande. El servidor escucha en el
puerto `8787` y Vite redirige `/socket` durante desarrollo. Para probar con
teléfonos reales se debe exponer la aplicación mediante una URL HTTPS y configurar
`VITE_WS_URL` si el WebSocket se publica en una URL diferente.

## Comandos

```bash
npm test        # lógica determinista del microjuego
npm run typecheck
npm run build
```

La siguiente decisión de producto continúa siendo validar el juego con grupos
reales antes de ampliar catálogo o implementar monetización.
