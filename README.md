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
- Genera build y sincroniza `docs/` en la rama `main`.

### Si ves el README en lugar de la app

Eso ocurre cuando GitHub Pages está apuntando a `main` + `/root` en vez de `main` + `/docs`.

Configura en GitHub:

- `Settings > Pages > Build and deployment`
- `Source`: `Deploy from a branch`
- `Branch`: `main` y carpeta `/docs`

URL correcta esperada:

- `https://dogins.github.io/tracking-indoor/`

### Manual

```bash
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
