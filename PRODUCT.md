# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Hinchas que compran camisetas** (rol `CUSTOMER`): recorren el catálogo, abren el detalle de una camiseta, la agregan al carrito, hacen checkout, pagan (pasarela Webpay simulada) y siguen sus pedidos. Pueden ver el catálogo sin sesión; comprar exige iniciar sesión o crear cuenta.
- **Gestores del catálogo** (`CATALOG_MANAGER`) y **administradores** (`ADMIN`): crean, editan y eliminan camisetas (equipo, tipo local/visitante/alternativa, precio, stock, foto) y ven métricas en vivo. `ADMIN` además revisa alertas antifraude de pagos.

## Product Purpose

Camisetas360 es una tienda de camisetas de fútbol construida como **proyecto académico / demo** (AWS Academy Learner Lab) sobre microservicios: catálogo, carrito, pedidos asíncronos, pagos con antifraude, recomendaciones y métricas en tiempo real. El éxito es que el flujo completo (explorar → comprar → pagar → seguir el pedido, y gestionar el catálogo) funcione de punta a punta y se vea como una tienda real.

## Positioning

Una tienda de camisetas por equipo y por tipo: cada equipo tiene su camiseta local, visitante y alternativa de la temporada, cada una con su propio stock. Hoy el catálogo cubre los 20 equipos de la Premier League 2026/27 y algunas camisetas genéricas.

## Operating Context

- Catálogo público; carrito, pedidos y pago solo con rol `CUSTOMER`. El checkout es asíncrono (202 + seguimiento por polling) y el pago usa tarjetas de prueba de Transbank.
- Login con Microsoft Entra ID o con cuenta Camisetas360 (Amazon Cognito: iniciar sesión, crear cuenta o Hosted UI).
- La navegación oculta lo que el rol no puede usar; la autorización real es del backend.

## Capabilities and Constraints

- Angular 22 standalone + Signals, Tailwind 4, sin librería de UI, templates inline (ver CLAUDE.md).
- Rutas: `/catalog`, `/catalog/:sku`, `/carrito`, `/pedidos`, `/pago`, `/perfil`, `/auth/login`, `/admin/productos`, `/admin/metricas`, `/pago/alertas`, `/sin-permiso`.
- Moneda: **pesos chilenos (CLP)**, sin decimales. Los precios sembrados en la base (p. ej. 94.99) están en una escala equivocada y deben corregirse a pesos.
- Recomendaciones (Top 5 por usuario) y métricas en vivo (WebSocket o polling).

## Evidence on Hand

- 63 productos reales en el catálogo (Premier League 2026/27: local/visitante/alternativa de 20 equipos, más 3 genéricas), con equipo, tipo, liga, precio, stock y descripción.
- **Fotos de producto: ninguna todavía.** Las sube el admin desde `/admin/productos`; el diseño debe verse completo sin foto y no debe inventar imágenes de producto.
- No existen testimonios, reseñas, prensa, promociones, plazos de despacho, políticas de envío ni de devolución: **no inventarlos** (es un proyecto académico, no vende de verdad).
- Sin escudos ni marcas registradas de clubes como activos.

## Product Principles

1. La camiseta es la protagonista: equipo y tipo se entienden de un vistazo.
2. Honestidad: solo se muestra lo que el sistema hace de verdad; sin promesas comerciales ni datos inventados.
3. Explorar es libre; comprar pide sesión, y después de iniciarla el usuario vuelve a la camiseta que quería.
4. Cada rol ve solo lo que puede usar; las pantallas de gestión priorizan rapidez y claridad.

## Accessibility & Inclusion

Mantener lo ya construido: contraste suficiente, foco visible, roles y `aria-*` en diálogos, mensajes de estado con `role="status"`/`role="alert"`, y sin scroll horizontal a 400 px (e2e `responsive.spec.ts`).
