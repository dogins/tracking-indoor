# Proyecto: Sistema de Navegación Indoor para Ferretería

## Idea central

Web app móvil que ayuda a los clientes de una ferretería a encontrar productos dentro de la tienda, mostrando un mapa interactivo con su posición en tiempo real — sin GPS, sin instalar ninguna app.

---

## Problema que resuelve

En tiendas físicas grandes (ferreterías, supermercados, etc.) el GPS no funciona bajo techo. El cliente no sabe dónde están los productos ni cómo llegar a ellos. Los vendedores están ocupados. La solución tiene que funcionar con el celular del cliente sin fricciones.

---

## Solución técnica

### Flujo principal

1. El cliente entra a la tienda y escanea un **QR físico** pegado en el letrero del pasillo más cercano
2. El QR abre una URL como `tienda.cl/?q=pasillo-3` → la app fija la posición del cliente en ese punto del mapa
3. El cliente busca un producto → el mapa muestra una ruta punteada desde su posición hasta el estante
4. Mientras camina, el **podómetro del celular** (acelerómetro) cuenta sus pasos y actualiza el punto en el mapa en tiempo real
5. Al pasar cerca de otro QR, la posición se **recalibra automáticamente** y el error acumulado se resetea a cero

### Tecnología de posicionamiento: Dead Reckoning + QR Anchors

- **Dead Reckoning**: técnica de navegación por estima. Posición nueva = posición anterior + (pasos × longitud de zancada ~0.75m) × dirección
- **Sensores usados**:
  - `DeviceMotionEvent` → acelerómetro para contar pasos (detecta el impacto del pie)
  - `DeviceOrientationEvent` → giroscopio para la dirección de movimiento
- **Problema inherente**: el error se acumula (~0.08m por paso). Solución: QR codes en cada pasillo actúan como anclas de recalibración
- **Precisión práctica**: ±0.5m recién calibrado, ±1.5–2m después de 15–20 pasos sin recalibrar. Suficiente para saber en qué estante está el producto

### Por qué QR y no BLE Beacons o GPS

| Tecnología                 | Precisión          | Costo hardware     | Requiere app       |
| -------------------------- | ------------------ | ------------------ | ------------------ |
| QR por zona (implementado) | Por zona           | $0 (solo imprimir) | No                 |
| BLE Beacons                | 1–3m               | $150–300 USD       | No (Web Bluetooth) |
| UWB                        | 10–30cm            | Alto               | Sí (nativa)        |
| GPS                        | No funciona indoor | —                  | —                  |

Se eligió QR porque: cero hardware, funciona en cualquier celular, sin instalación, y los QR adicionales en cada pasillo resuelven el problema de acumulación de error.

---

## Arquitectura del sistema

### Frontend (lo que existe hoy)

Archivo único `ferreteria-nav.html` — HTML/CSS/JS vanilla, sin dependencias externas.

**3 pantallas:**

- `#s-scan` — Selección de zona / simulación de escaneo QR
- `#s-map` — Mapa canvas + sensores + instrucciones de navegación
- `#s-search` — Buscador de productos con lista filtrable

**Componentes clave:**

- `<canvas id="mapCanvas">` — mapa dibujado con Canvas 2D API. Coordenadas lógicas 600×560, escaladas al tamaño real del canvas
- `DeviceMotionEvent` → función `handleMotion()` → `registerStep()` → actualiza `pos.x/y` y llama `drawMap()`
- `DeviceOrientationEvent` → función `handleOrientation()` → actualiza `heading` en grados
- `buildRoute(from, to)` → genera waypoints de ruta (por ahora: from → corredor horizontal → destino)
- QR_POINTS → array de puntos de recalibración. Cuando `pos` se acerca a menos de 30px lógicos de un QR, se resetea el error

**Estado global:**

```javascript
pos; // { x, y } en coordenadas lógicas del mapa
heading; // grados 0-360, 0=Norte
steps; // contador de pasos
totalDist; // metros recorridos
driftError; // error acumulado en metros
stepsSinceCalib; // pasos desde la última recalibración
trail; // array de posiciones para dibujar el rastro
target; // producto destino seleccionado { destX, destY, loc, ... }
routeWaypoints; // array de { x, y } que forman la ruta
currentZone; // zona actual del usuario
```

**Mapa del store (hardcodeado hoy):**

```javascript
const AISLES = [
  { x: 20, y: 30, w: 80, h: 400, name: "Pintura", code: "P1" },
  { x: 110, y: 30, w: 80, h: 400, name: "Eléctrico", code: "P2" },
  { x: 200, y: 30, w: 80, h: 400, name: "Herramientas", code: "P3" },
  { x: 290, y: 30, w: 80, h: 400, name: "Plomería", code: "P4" },
  { x: 380, y: 30, w: 80, h: 400, name: "Fijaciones", code: "P5" },
  { x: 470, y: 30, w: 110, h: 400, name: "Ofertas", code: "OF" },
];
// Coordenadas lógicas 600×560. logToCanvas() escala al canvas real.
```

**Productos (hardcodeados hoy):**

```javascript
{
  (id, name, meta, price, emoji, zone, loc, destX, destY);
}
// destX/destY = coordenadas lógicas del estante en el mapa
```

### Lo que falta construir (backlog sugerido)

#### Prioridad alta

- [ ] **Algoritmo de pathfinding real** (A\* o Dijkstra) para evitar que la ruta pase por dentro de los estantes. Hoy la ruta es solo 4 waypoints en L
- [ ] **Panel de administración** para que el dueño cargue el mapa de su tienda y los productos (conectar con el editor de mapas SVG que se prototipó)
- [ ] **Base de datos de productos** (puede ser JSON local, Supabase, o Google Sheets como backend simple)
- [ ] **Detección de pasos mejorada**: filtrar picos del acelerómetro con un filtro de paso bajo para reducir falsos pasos

#### Prioridad media

- [ ] **Modo QR por zona sin podómetro**: si el usuario no da permiso al sensor, que la app funcione igual pero solo actualizando posición al escanear cada QR (modo degradado)
- [ ] **Múltiples productos en ruta**: el cliente agrega varios productos a una lista y la app calcula el recorrido óptimo (TSP simple)
- [ ] **Stock en tiempo real**: integrar con el sistema de inventario de la tienda vía API
- [ ] **Búsqueda por lenguaje natural con IA**: "necesito instalar un grifo" → la app sugiere los 3 productos necesarios

#### Prioridad baja

- [ ] **PWA**: agregar manifest.json y service worker para que se pueda instalar como app
- [ ] **Soporte multi-piso**: coordenada Z + transiciones por escalera/ascensor
- [ ] **Analytics**: saber qué productos buscan más los clientes, zonas más transitadas

---

## Stack tecnológico actual y recomendado

| Capa          | Hoy                            | Recomendado para escalar                       |
| ------------- | ------------------------------ | ---------------------------------------------- |
| Frontend      | HTML/CSS/JS vanilla            | Vue 3 o React + Vite                           |
| Mapa          | Canvas 2D API                  | Mantener Canvas (no usar Leaflet, es para GPS) |
| Productos     | Array hardcodeado en JS        | Supabase (PostgreSQL + API REST gratis)        |
| Hosting       | Archivo local                  | Vercel o Netlify (gratis)                      |
| QR generation | Manual (qr-code-generator.com) | Librería `qrcode.js` integrada                 |
| Sensores      | DeviceMotion/Orientation API   | Mantener (nativo del browser, sin deps)        |

---

## Notas importantes para el desarrollo

**iOS Safari**: `DeviceMotionEvent.requestPermission()` es obligatorio — debe llamarse desde un gesto del usuario (tap), no automáticamente al cargar la página. Ya está implementado en `requestMotionPermission()`.

**Android Chrome**: los eventos de movimiento funcionan sin pedir permiso explícito.

**Longitud de zancada**: actualmente hardcodeada en 0.75m. Mejorar con calibración: el usuario camina de un QR a otro (distancia conocida) y la app calcula su zancada real.

**Coordenadas del mapa**: el sistema usa coordenadas lógicas (600×560) independientes del tamaño real del canvas. La función `logToCanvas(x, y)` hace la conversión. Siempre trabajar en coordenadas lógicas internamente.

**Generación de QRs**: cada QR apunta a `[URL-de-la-app]/?q=[zona-id]`. Al cargar, el JS lee `new URLSearchParams(window.location.search).get('q')` y llama `scanZone(zoneId)` automáticamente.

---

## Archivo entregado

`ferreteria-nav.html` — app completa funcional en un solo archivo, ~500 líneas, sin dependencias externas. Abrir en cualquier browser o subir a Netlify/Vercel para probar en iPhone.
