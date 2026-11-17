---
name: Camisetas360
description: El álbum de la temporada — tienda de camisetas de fútbol impresa en papel de álbum a dos tintas.
colors:
  paper: "#f3efe6"
  paper-2: "#e9e3d6"
  ink: "#161512"
  pitch: "#1f5f3a"
  rule: "#c9c0ad"
  slot: "#9c9484"
  ink-soft: "#3c3a33"
  ink-muted: "#57534a"
  placeholder: "#7a7466"
  pitch-deep: "#184b2e"
  error: "oklch(50.5% 0.213 27.518)"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(34px, 8vw, 112px)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.6vw, 52px)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 125"
  figure:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1, 'lnum' 1"
    fontVariation: "'wdth' 110"
  title:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.2em"
    fontVariation: "'wdth' 112"
  body:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'lnum' 1"
  label:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.2em"
    fontVariation: "'wdth' 112"
  number:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.16em"
    fontFeature: "'tnum' 1, 'lnum' 1"
rounded:
  none: "0"
spacing:
  gutter-sm: "16px"
  gutter-md: "32px"
  gutter-lg: "56px"
  slot-inset: "24px"
  slot-gap: "32px"
  container: "1440px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "{colors.pitch}"
    textColor: "{colors.paper}"
  button-primary-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "14px 20px"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input-underline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 0"
  input-boxed:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "12px"
  status-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    height: "32px"
  nav-link:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
  nav-link-active:
    textColor: "{colors.ink}"
  index-tab:
    textColor: "{colors.ink}"
    padding: "10px 12px"
  index-tab-active:
    textColor: "{colors.pitch}"
  album-slot:
    backgroundColor: "transparent"
    textColor: "{colors.slot}"
    rounded: "{rounded.none}"
    padding: "{spacing.slot-inset}"
  kit-badge-local:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    padding: "4px 8px"
  kit-badge-visitante:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "4px 8px"
  kit-badge-alternativa:
    backgroundColor: "{colors.pitch}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    padding: "4px 8px"
  footer-band:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-soft}"
---

# Design System: Camisetas360

## Overview

**Creative North Star: "El álbum de la temporada"**

Camisetas360 se imprime como un álbum de láminas de la Premier League 2026/27: papel crema, dos tintas y casilleros numerados con borde punteado esperando su lámina. Cada equipo es una página; cada camiseta (local, visitante, alternativa) es un casillero con su número de tres cifras, su precio y su stock. El catálogo es la pieza que fija el mundo; el resto de la tienda lo hereda.

La estructura no sale de cajas sino de la imprenta: reglas finas de 1px en tinta o en gris de papel, casilleros punteados, líneas base bajo el precio y bandas de papel más oscuro. No hay tarjetas, ni esquinas redondeadas, ni sombras. La voz tipográfica es una grotesca pesada (Archivo, eje de ancho expandido) en mayúsculas muy espaciadas para nombres de equipo y rótulos, y cifras tabulares de ancho fijo para todo lo que cuenta: precio, stock, numeración. La densidad es editorial y sobria en el catálogo (Persuade) y más compacta en gestión (Operate), con el mismo papel y las mismas tintas.

La honestidad del producto es visual: si una camiseta no tiene foto, el casillero muestra la silueta impresa de una camiseta, nunca una imagen inventada. Las fotos las sube el administrador.

**Key Characteristics:**
- Papel crema con bandas más oscuras; dos tintas (negro tinta y verde cancha); rojo solo para errores.
- Cero radios y cero sombras, por token: la profundidad la dan reglas de 1px, casilleros punteados y bandas.
- Display en mayúsculas de ancho expandido (125%) con tracking amplio; rótulos en mayúsculas al 112% con 0.2em.
- Cifras tabulares para precio, stock y numeración de casilleros (001, 002…).
- Movimiento de imprenta: la página entra desde el lomo y las cifras ruedan en su lugar como un marcador.

## Colors

Papel cálido y dos tintas planas, como un impreso de dos pasadas; todo lo demás es una mezcla de esas tintas sobre el papel.

### Primary
- **Negro Tinta** (`ink`): la tinta principal. Texto, reglas estructurales (bajo el encabezado, sobre el pie, bajo el precio, sobre las fichas), botones primarios, franja de estado superior y logotipo. Remapeada como `slate-900`.

### Secondary
- **Verde Cancha** (`pitch`): la segunda tinta. Números de casillero, pestaña activa del índice, hover de botones primarios, "360" del logotipo, foco, selección de texto, cursor de escritura, mensajes de éxito y stock disponible. Remapeada como `blue-600`; toda la escala `blue-*` es verde cancha (`pitch-deep` = `blue-700`, usado en enlaces de texto de login).

### Neutral
- **Papel de Álbum** (`paper`): fondo de página (`body`) y texto sobre tinta. Remapeado como `slate-50`.
- **Banda de Papel** (`paper-2`): segunda capa de papel. Índice del álbum, pie de página, esqueletos de carga, pista del scrollbar.
- **Regla de Papel** (`rule`): reglas secundarias (filas de la ficha técnica, separadores del índice y del menú móvil, base de pestañas, contorno de botón deshabilitado). Igual a `slate-300`.
- **Punteado de Casillero** (`slot`): borde punteado de los casilleros, silueta impresa de la camiseta vacía, pulgar del scrollbar.
- **Tinta Suave** (`ink-soft`, `slate-700`) y **Tinta Apagada** (`ink-muted`, `slate-600`): texto secundario, enlaces de navegación en reposo, rótulos de campos y metadatos.
- **Placeholder** (`placeholder`): texto de ejemplo en campos.

### Error
- **Rojo de Error** (`error`, `red-700`; `red-800` para texto sobre aviso): exclusivamente errores, "Sin stock"/agotado en la ficha, y el hover de "Cerrar sesión". Los avisos de error son un rectángulo de borde rojo de 1px, sin relleno.

La escala `slate-*` completa está remapeada en `src/styles.css` del papel (`50`) a la tinta (`900`, `950`), y `blue-*` al verde cancha; ver tonalidades en `.impeccable/design.json`.

### Named Rules
**The Two Inks Rule.** Solo dos tintas: negro tinta y verde cancha. El rojo existe únicamente para errores. Ningún otro tono (ámbar, esmeralda, azul real) entra a una pantalla nueva.

**The Palette Remap Rule.** El mundo se aplica remapeando la paleta de Tailwind (`slate` = papel→tinta, `blue` = verde cancha) en `@theme`. Una pantalla nueva usa los tokens `paper`/`ink`/`pitch`/`rule`/`slot`; nunca reintroduce `white` o grises fríos.

## Typography

**Display Font:** Archivo Variable (autoalojada vía `@fontsource-variable/archivo/wdth.css`, eje `wdth` 62–125%), con `Archivo`, `ui-sans-serif`, `system-ui`
**Body Font:** la misma Archivo Variable en ancho normal
**Label/Mono Font:** la misma familia; las cifras usan `tabular-nums lining-nums`, no una monoespaciada

**Character:** una sola grotesca que cambia de voz con el eje de ancho: expandida y pesada para gritar el nombre del equipo, ancho intermedio y espaciada para los rótulos impresos, normal para leer.

### Hierarchy
- **Display** (800, `clamp(34px, 8vw, 112px)`, 0.92, ancho 125%, mayúsculas, 0.06em, `text-wrap: balance`): nombre del equipo en la página del álbum. Variantes de tamaño: título del índice (20→36→30→32px), login `clamp(34px,6vw,48px)`, admin `clamp(40px,6vw,76px)`, estados vacíos 40px. Utilidad `album-display`.
- **Headline** (800, `clamp(32px, 3.6vw, 52px)`, misma voz display): nombre de la camiseta en el detalle; secciones de equipo en admin (`clamp(32px,4vw,52px)`).
- **Figure** (800, 40px, 1, ancho 110%, tabular): precio en el detalle y KPIs de admin (`text-4xl`).
- **Title** (600, 13px, ancho 112%, 0.2em, mayúsculas): tipo de camiseta sobre la línea base del casillero. Precio junto a él: 18px bold tabular.
- **Body** (400, 16px; 15px nombre de producto; 17px/relajado y `max-width: 60ch` en descripciones): texto corrido.
- **Label** (600, 10–12px, ancho 112%, 0.2em, mayúsculas): navegación, rótulos de campo, botones, encabezados del pie, franja de estado. Utilidad `album-caps`.
- **Number** (700, 13–14px, 0.16em, tabular, verde cancha): número de casillero `001` y SKU en el detalle. Utilidad `tnum`.

### Named Rules
**The Tabular Figures Rule.** Todo lo que se cuenta (precio, stock, numeración, contador del carrito, KPIs) usa `tnum` (`tabular-nums lining-nums`). Las cifras no bailan al cambiar.

**The CLP Rule.** Los precios se muestran con el pipe `clp`: pesos chilenos, `es-CL`, sin decimales (`$94.990`).

**The No Eyebrow Rule.** Los encabezados no llevan rótulos en mayúsculas encima. El contexto (liga, cantidad de camisetas) va al lado o debajo, en la misma línea base.

## Layout

- **Contenedor:** `max-width: 1440px` centrado, con márgenes laterales de 16px (móvil), 32px (`sm`, 640px) y 56px (`lg`, 1024px). El `main` añade 16px/40px vertical.
- **El pliego del catálogo:** en `lg` una grilla de dos columnas: índice a la izquierda (`minmax(260px, 320px)`, banda `paper-2`, regla de tinta a la derecha) y página del equipo a la derecha. Todo el pliego queda entre una regla de tinta arriba y abajo.
- **Casilleros:** grilla de 1 → 2 (`sm`) → 3 (`xl`) columnas, separación horizontal 32px y vertical 48px. La proporción del casillero cambia con el ancho para no comerse la pantalla: `2/1` en móvil, `4/3` en `sm`, cuadrado en `xl`. El detalle usa `4/5` y queda fijo (`sticky`, top 112px) junto a la ficha en `md`.
- **Índice en móvil:** bajo `lg` el índice se vuelve una tira horizontal desplazable de pestañas, sangrada a todo el ancho; al pasar la página la pestaña activa se centra desplazando la tira (no la página).
- **Detalle:** dos columnas `1.1fr / 1fr` desde `md`, separación 40→64px.
- **Pie:** tres columnas desde `sm`, y el logotipo a todo el ancho (`8.2vw`, máx. 116px) antes de la regla final.
- **Gestión (Operate):** KPIs en 2 → 4 columnas; filtros en 4 columnas; secciones de equipo separadas por regla de tinta con casilleros en 1 → 2 → 3 columnas.
- Sin scroll horizontal a 400px de ancho.

## Elevation & Depth

El sistema es completamente plano. Los tokens `--shadow-*` de Tailwind están puestos en `none` y no existe vocabulario de sombras. La profundidad se construye por capas de papel (`paper` sobre `paper-2`), por reglas (tinta para estructura, `rule` para subdivisión) y por el casillero punteado. La única superficie translúcida es el encabezado fijo (`paper` al 95% con `backdrop-blur-sm`) para que el contenido pase por debajo al hacer scroll.

### Named Rules
**The Printed Flat Rule.** Nada flota. Si algo necesita separarse, se le pone una regla de 1px, una banda de papel o un casillero punteado; nunca una sombra.

**The No Cards Rule.** No se encierra contenido en tarjetas. Un producto es un casillero (la imagen) más una línea base (tipo y precio) y texto suelto debajo.

## Shapes

Todas las esquinas son rectas: `--radius-xs` a `--radius-4xl` valen `0`, así que cualquier `rounded-*` heredado se dibuja cuadrado. Las formas recurrentes son tres: la **regla** (borde de 1px, sólido en tinta o `rule`), el **casillero** (`album-slot`: borde punteado de 1.5px en `slot`, sin relleno) y la **línea base** (regla de tinta bajo el tipo y el precio). Los indicadores son cuadrados: el punto de notificaciones es un cuadrado de 6px verde, el contador del carrito y las iniciales del usuario son cajas de borde de tinta. Los iconos son trazos de 1.6px con terminaciones `square`.

## Components

### Buttons
Tinta sólida, rectos, rotulados en mayúsculas.
- **Shape:** esquinas rectas (0).
- **Primary:** fondo tinta, texto papel, `album-caps` 11–12px, 14–16px vertical; de ancho completo bajo el casillero, `sm:auto` con 56px laterales en el detalle.
- **Hover / Focus:** el fondo pasa de tinta a verde cancha (`transition-colors`). Foco global: contorno verde cancha de 2px con 3px de separación.
- **Disabled:** en el catálogo se vacía (fondo transparente, texto `slate-500`, contorno de 1px `rule`); en formularios, `opacity: 0.5` o `slate-300`.
- **Outline:** borde de tinta de 1px, texto tinta; en hover se rellena de tinta (Microsoft Entra ID) o el borde y el texto pasan a rojo (Cerrar sesión).
- **Secundario tenue:** borde `rule` o borde punteado `slot` (acceso demo), texto `slate-700`, hover a tinta.

### Chips
- **Kit badges (admin):** rótulo `album-caps` 10px sobre el casillero. Local = tinta sobre papel invertido (fondo tinta), Visitante = papel con contorno de tinta de 1px, Alternativa = fondo verde cancha. Las dos tintas bastan para distinguir los tres tipos.
- **Proveedor y roles (login):** proveedor en caja de borde de tinta; roles como texto verde cancha en mayúsculas, sin caja.

### Cards / Containers
- No hay tarjetas. El contenedor es el **casillero** (`album-slot`): esquinas rectas, sin fondo, borde punteado 1.5px `slot`, imagen con 24px de margen interior (40px en el detalle), `object-contain`.
- Sin sombra (ver Elevation & Depth).

### Inputs / Fields
- **Subrayado (búsqueda y filtros):** sin caja, solo una regla inferior de tinta, fondo transparente, 8–10px vertical, sin padding lateral. Foco: la regla pasa a verde cancha.
- **Con caja (login, cantidad):** borde de tinta 1px, fondo transparente, 12px de padding. Foco: borde verde cancha, sin anillo.
- **Rótulo:** `album-caps` 10px en `slate-700`, encima del campo.
- **Error:** aviso con borde rojo de 1px y texto `red-800`, `role="alert"`; mensajes por campo en `red-700`.
- **Cursor y selección:** cursor verde cancha; selección con fondo verde cancha y texto papel.

### Navigation
- **Franja de estado:** 32px de alto, fondo tinta, texto papel en `album-caps` 10–11px centrado ("Premier League 2026/27 · Local, visitante y alternativa"; la segunda parte se oculta en móvil).
- **Encabezado:** fijo, 72px, papel al 95% con desenfoque, cerrado por una regla de tinta. Logotipo `CAMISETAS360` a la izquierda (800, ancho 125%, tracking 0.26em → 0.42em, "360" en verde cancha).
- **Enlaces:** `album-caps` 11px en `slate-700`; hover y activo: tinta con subrayado de 1px desplazado 7px. Solo se muestran los enlaces que el rol puede usar.
- **Carrito:** rótulo con contador tabular en caja de borde de tinta. Sin sesión, "Iniciar sesión" es un botón primario de tinta.
- **Móvil:** bajo `lg`, un menú que baja (`slide-down`) con filas `album-caps` 12px separadas por reglas `rule`.
- **Pie:** banda `paper-2` con regla de tinta arriba, tres columnas con encabezado `album-caps`, logotipo a todo el ancho y regla de tinta final con copyright y temporada.

### Album Slot with Empty Plate (signature)
El casillero numerado del álbum. Número de tres cifras (`001`) arriba a la izquierda en verde cancha tabular; "Últimas N" arriba a la derecha cuando el stock es ≤ 5. Si no hay foto, el centro muestra la **silueta impresa de una camiseta**: un dibujo de línea de 1.5px en color `slot`, a la mitad de la altura (máx. 160px), con `role="img"` y texto `sr-only` ("Imagen no disponible" / "Cargando…"); pulsa mientras carga. Debajo del casillero: línea base de tinta con el tipo (Title) a la izquierda y el precio (18px bold tabular) a la derecha; luego el nombre como enlace, el stock y el SKU tabulares, y el botón primario anclado abajo.

### Album Index (signature)
Lista ordenada de equipos en la banda `paper-2`. Cada fila: nombre del equipo en mayúsculas 13px semibold (0.12em) y el rango de números tabulares (`001–003`) a la derecha, filas separadas por reglas `rule`. Activo: texto verde cancha (`aria-current="page"`); en la tira móvil, además, una regla inferior verde cancha de 2px. Elegir un equipo pasa la página y escribe `?equipo=` en la URL.

### Spec List
Ficha técnica del detalle: `dl` con regla de tinta arriba y filas separadas por reglas `rule` (12px vertical); término en `album-caps` 10px `slate-600`, valor tabular semibold alineado a la derecha. El stock va en verde cancha si hay unidades y en rojo si no.

### Tabs (login)
Dos pestañas en grilla sobre una regla `rule`; la activa lleva una regla inferior de tinta de 2px y texto tinta, la inactiva `slate-600`. Aviso de contexto ("Para comprar necesitas una cuenta"): texto verde cancha entre reglas verdes arriba y abajo, sin fondo. El formulario abre con una sola regla de tinta superior sobre el título display.

### KPI Row (admin)
Cifras grandes tabulares (`text-4xl`, 800, ancho 110%) bajo una regla de tinta, con rótulo `album-caps` 10px encima de la cifra. Tinta por defecto; rojo solo si hay camisetas sin stock; verde cancha para "Sin foto".

### Missing Kit Slot (admin)
Por cada tipo que le falta a un equipo, un casillero punteado vacío que es un botón: "+" y "Agregar camiseta visitante". Hover: borde y texto pasan a verde cancha. Abre el formulario con equipo y tipo precargados.

### Motion
- `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) para todo.
- **Page turn** (0.55s): la página del equipo entra desde el lomo con `clip-path` de derecha a izquierda.
- **Tick** (0.5s, 0.18s de retraso): número de casillero, precio y stock suben 0.55em desde un leve desenfoque, como un marcador.
- `fade-in` 0.35s, `slide-up` 0.45s (12px), `slide-down` 0.3s (6px, menú móvil).
- Con `prefers-reduced-motion: reduce`, toda animación y transición dura 0.01ms y el scroll deja de ser suave.

## Do's and Don'ts

### Do:
- **Do** construir con dos tintas sobre papel: `ink` para estructura y texto, `pitch` para número, estado activo, foco y acción en hover; `red-700` solo para errores.
- **Do** separar con reglas de 1px (tinta para estructura, `rule` para subdivisión), bandas `paper-2` y casilleros `album-slot`.
- **Do** escribir nombres de equipo y títulos con `album-display`, y rótulos, botones y navegación con `album-caps`.
- **Do** usar `tnum` en todo precio, stock, número de casillero, contador y KPI, y formatear precios con el pipe `clp` (CLP sin decimales).
- **Do** mostrar la silueta impresa de `app-product-image` cuando no hay foto, con su texto `sr-only`.
- **Do** cambiar la proporción del casillero con el ancho (`2/1` → `4/3` → cuadrado) para que la página del equipo quepa en móvil.
- **Do** usar `ease-out-expo` y respetar la regla de movimiento reducido.

### Don't:
- **Don't** usar tarjetas, esquinas redondeadas ni sombras; los tokens están en `0` y `none` a propósito.
- **Don't** añadir un tercer color de acento (ámbar, esmeralda, azul) ni fondos `white`; el rojo se reserva para errores.
- **Don't** poner rótulos tipo "eyebrow" en mayúsculas encima de los encabezados.
- **Don't** inventar imágenes de producto, escudos o marcas de clubes; las fotos las sube el administrador.
- **Don't** usar cifras proporcionales en precios o stock, ni mostrar decimales en CLP.
- **Don't** usar una fuente del sistema o una monoespaciada para la voz display o las cifras; todo es Archivo Variable.

## Herencia conocida

Carrito, pedidos, pago, perfil, métricas, alertas antifraude y el formulario/diálogos de gestión **no fueron rediseñados a mano**. Heredan el mundo solo por el remapeo de la paleta (`slate` → papel/tinta, `blue` → verde cancha, radios en 0, sombras en `none`), así que se ven cuadrados, planos y a dos tintas, pero conservan su maquetación anterior y todavía usan `bg-white`, `emerald-*`, `amber-*` y `font-mono`. Es herencia, no un tratamiento terminado: al tocar esas pantallas, llévenlas a las reglas de arriba.
