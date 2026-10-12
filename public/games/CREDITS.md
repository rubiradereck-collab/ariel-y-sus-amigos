# 📜 Créditos y Licencias de Juegos Libres (/arcade/libres)

Todos los juegos incluidos en esta sección son de código abierto, con licencias verificadas y sin derechos comerciales restringidos. No incluyen publicidad, rastreadores ni compras integradas.

---

| Slug | Título | Categoría | Licencia | Autor / Origen | Tipo de Fuente | Fecha de Integración |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2048` | 2048 Neón | Puzzles | MIT | Gabriele Cirulli / Ariel y sus amigos | Open Source revisado | 2026-10-12 |
| `buscaminas` | Buscaminas Neón | Puzzles | MIT | Ariel y sus amigos | Propio (Vanilla HTML5) | 2026-10-12 |
| `pong-neon` | Pong Neón | Arcade | MIT | Ariel y sus amigos | Propio (HTML5 Canvas + Web Audio) | 2026-10-12 |
| `memorama` | Memorama Cuántico | Casual | MIT | Ariel y sus amigos | Propio (CSS 3D Flip) | 2026-10-12 |
| `breakout` | Rompeladrillos Neón | Arcade | MIT | Ariel y sus amigos | Propio (HTML5 Canvas) | 2026-10-12 |
| `conecta4` | Conecta 4 Neón | Mesa | MIT | Ariel y sus amigos | Propio (HTML5 Grid + AI) | 2026-10-12 |
| `sudoku` | Sudoku Neón | Puzzles | MIT | Ariel y sus amigos | Propio (Algorítmico) | 2026-10-12 |
| `laberinto-neon` | Laberinto Neón | Puzzles | MIT | Ariel y sus amigos | Propio (DFS Procedural Backtracker) | 2026-10-12 |

---

## 🛡️ Seguridad de Ejecución
- Los juegos se ejecutan dentro de contenedores `<iframe>` aislados con atributos `sandbox="allow-scripts allow-pointer-lock allow-fullscreen allow-popups"`.
- Los juegos locales propios tienen `trusted_storage = false` por defecto a menos que requieran explícitamente almacenamiento de puntaje offline.
- No se transmiten credenciales ni cookies de sesión dentro de los iframes.
