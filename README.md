# Spin View Stamp

Herramienta web estática y gratuita para preparar una fotografía JPEG con un perfil EXIF compatible con **Ray-Ban Meta Smart Glasses 2**, con el objetivo de probar el efecto **Spin View** de Instagram.

## Qué hace

- Procesa la imagen **100 % en el navegador**.
- No sube fotografías a ningún servidor.
- Adapta la imagen a **3024 × 4032 px** (3:4).
- Exporta un JPEG nuevo.
- Escribe un EXIF limpio con:
  - `Make = Meta AI`
  - `Model = Ray-Ban Meta Smart Glasses 2`
  - orientación normal
  - resolución 72 dpi
  - dimensiones EXIF 3024 × 4032
- Elimina GPS y no copia MakerNotes u otros metadatos sensibles del original.

## Formatos de entrada

- JPEG / JPG
- PNG
- WebP

La salida siempre es JPEG.

> HEIC/HEIF no se incluye en esta primera versión para mantener el proyecto simple y sin procesamiento adicional.

## Ejecutar localmente

No requiere build.

Puedes abrir `index.html` directamente, aunque para evitar restricciones del navegador es preferible servir la carpeta con un servidor local:

```bash
python -m http.server 8080
```

Después abre:

```text
http://localhost:8080
```

## Publicar gratis con GitHub Pages

1. Asegúrate de que el repositorio sea público si tu plan de GitHub no permite Pages en repositorios privados.
2. Ve a **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda.

La URL será similar a:

```text
https://goyoaga.github.io/spin-view-stamp/
```

## Privacidad

La foto se carga en memoria dentro del navegador del usuario. No existe backend, API ni almacenamiento remoto.

## Aviso

Este proyecto no está afiliado a Meta, Instagram ni Ray-Ban.

Instagram puede cambiar sus criterios para activar Spin View. El proyecto solo genera un JPEG con un perfil EXIF concreto y no garantiza que el efecto aparezca en todas las cuentas, regiones o versiones de Instagram.

## Licencia

MIT
