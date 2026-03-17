# tracking-indoor

App de navegación indoor para ferretería, migrada a Angular standalone.

## Requisitos

- Node.js 20+
- npm 10+

## Desarrollo local

```bash
npm install
npm start
```

Abrir: `http://localhost:4200/`

## Build de producción

```bash
npm run build
```

Salida: `dist/tracking-indoor/browser`

## Deploy GitHub Pages

Este repo está configurado para Pages con hash routing (`/#/scan`) y base href `/tracking-indoor/`.

### Automático (recomendado)

- Cada push a `main` dispara `.github/workflows/deploy.yml`.
- Publica `dist/tracking-indoor/browser`.

### Manual

```bash
npm run build
npm run deploy
```

## Versión desplegada en el front

- La versión se muestra como badge fijo en la esquina inferior derecha.
- Se lee en runtime desde el `package.json` desplegado.
- Si cambias `version` en `package.json`, al hacer build/deploy se verá reflejado automáticamente.

## Estructura principal

```text
src/
	app/
		core/
		features/
		shared/
public/
	assets/store-map.json
angular.json
package.json
```
