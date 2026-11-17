# Catálogo / storefront (y todo el front que hereda su mundo)

Scope: tienda completa de Camisetas360 (catálogo, detalle, carrito, pedidos, pago, login, perfil, admin). Modo: Persuade en catálogo/detalle; Operate en carrito, pedidos, pago y admin (mismo mundo, más sobrio).
Audiencia y tarea: hinchas que eligen una camiseta por equipo y tipo y la compran; gestores que completan el álbum (camisetas y fotos).
Restricciones: sin fotos de producto aún (las sube el admin), sin promesas comerciales inventadas (proyecto académico), precios en CLP sin decimales, sin escudos ni marcas de clubes. Estética inspirada en onyxcoffeelab.com pedida por el usuario: bandas crema/blanco, mayúsculas muy espaciadas, editorial y sobrio.

## Direction contract

THESIS: El catálogo es el álbum de la temporada: cada equipo es una página con tres casilleros numerados (local, visitante, alternativa). Rechaza la grilla de tarjetas iguales con banner encima.

OWN-WORLD: Papel de álbum crema #f3efe6 con bandas #e9e3d6; dos tintas para todo: negro tinta #161512 y verde cancha #1f5f3a (números, estado activo, acción). Grotesca pesada en mayúsculas con tracking amplio para nombres de equipo; cifras tabulares de ancho fijo para precio, stock y numeración. Sin tarjetas ni sombras ni radios: reglas finas de 1px, casilleros con borde punteado, líneas base. Raises: dos tintas (Mondo), nada encerrado en cajas (cracktro), contadores tabulares (nixie), centro del casillero limpio (accretion).

STORY: El visitante entiende que está ante un álbum completo de la Premier 2026/27, encuentra su equipo en el índice, ve sus tres camisetas numeradas con precio y stock, y compra (o inicia sesión para comprar) sin salir de la página del equipo.

FIRST VIEWPORT: Barra negra superior con el estado del álbum (equipos y casilleros). Encabezado: logotipo CAMISETAS360 espaciado a la izquierda, navegación en mayúsculas a la derecha. Debajo, un pliego: columna izquierda (~30%) con el índice del álbum (equipos con sus números 001–003…) y búsqueda; columna derecha con la página del equipo activo: nombre en letra enorme, tres casilleros numerados con la camiseta o su silueta, precio, stock y «Comprar →» bajo cada uno.

FORM: Álbum de láminas, candidato 5 de 7 de la lista propia. seed:c9615315b72711b4

SIGNATURE INTERACTION: elegir un equipo en el índice pasa la página (transición corta de pliego) y actualiza la URL; el número del casillero y el stock cambian en su lugar como un contador.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
