# Finanzas Personales

> **Una herramienta para tomar control de tu dinero, un registro a la vez.**

Finanzas Personales es una aplicación web progresiva (PWA) pensada para ayudarte a ser consciente de cada peso que entra y sale de tu bolsillo. En el día a día es fácil perder la noción de cuánto se gasta en pequeñas cosas — un café, una recarga, una suscripción olvidada — y al final del mes preguntarse a dónde fue el dinero. Esta app existe para que eso deje de pasar.

No necesita internet después de instalada, no sube tus datos a ningún servidor, y funciona desde el celular como si fuera una app nativa.

---

## Propósito

El objetivo principal no es solo llevar números: es **crear el hábito de registrar**. Cuando ves tus gastos representados en una gráfica, cuando ves cuánto llevas gastado en la quincena, cuando la app te muestra que en 8 meses puedes llegar a tu meta de ahorro — eso cambia la relación que tienes con el dinero.

La app está diseñada para Colombia: usa el formato de números colombiano (puntos para miles, coma para decimales), incluye conceptos como quincenas, tasas de usura, GMF (4×1000), y referencias a leyes como la Ley 546 de 1999 o el Estatuto Tributario.

---

## Estructura del proyecto

```
├── index.html       — Estructura HTML de todas las vistas y modales
├── app.js           — Toda la lógica de la aplicación (sin dependencias externas)
├── styles.css       — Estilos visuales (tema oscuro, responsive)
└── manifest.json    — Configuración PWA para instalación en celular
```

La aplicación no tiene backend. Todo se guarda en el `localStorage` del navegador. Los datos se pueden exportar e importar en formato JSON para respaldo o migración entre dispositivos.

---

## Módulos y funcionalidades

### 1. Resumen
La pantalla principal de un vistazo.

- **Balance total**: suma de todos los ingresos menos todos los egresos registrados.
- **Tarjetas de resumen**: muestra por separado el total de ingresos, total de egresos, cuánto te deben o prestaste, y cuánto debes o te prestaron.
- **Gráfica de gastos**: visualización interactiva de egresos. Se puede filtrar por mes y agrupar de dos formas:
  - **Por título**: cada movimiento se agrupa por su nombre.
  - **Por categoría**: los egresos se agrupan según la categoría que les hayas asignado, dando una visión más clara de en qué rubros gastas más.
- **Cambiar tipo de gráfica**: alterna entre gráfica de torta (pie) y barras.
- **Exportar / Importar**: guarda todos tus datos en un archivo `.json` o carga uno previamente guardado. Soporta modo "añadir" (combina datos) o "reemplazar" (sustituye todo).

---

### 2. Calendario
El corazón del registro diario.

#### Tres modos de vista
- **Diario**: calendario mensual clásico. Los días con movimientos se resaltan. Al tocar un día se muestran sus movimientos y puedes registrar nuevos.
- **Quincenal**: vista de quincena (del 1 al 15 y del 16 al último día del mes). Muestra el ingreso del período, cuánto se ha gastado y cuánto queda disponible.
- **Mensual**: igual que quincenal pero con el mes completo como unidad.

#### Registro de movimientos
Cada movimiento tiene:
- Fecha
- Tipo: **Ingreso** o **Egreso**
- Categoría y subcategoría (opcional, asignadas por el usuario)
- Título y descripción
- Monto
- Fuente de ingreso (para egresos: a qué fondo de ingreso se carga)

#### Fondos de ingreso
Cuando registras un ingreso, se crea automáticamente un "fondo". Los egresos se descuentan de ese fondo. Si hay varios fondos, el sistema descuenta del más grande primero, o del que elijas manualmente. Esto permite saber exactamente de qué ingreso salió cada gasto.

#### Gastos Fijos
Gastos recurrentes que se repiten cada quincena o cada mes (arriendo, Netflix, servicios públicos, etc.). Se registran una sola vez y el sistema recuerda cuáles ya pagaste en el período actual. Permiten marcar "pagado" uno por uno o pagar todos a la vez.

---

### 3. Deudas
Gestión completa de deudas y préstamos en cuatro categorías:

| Categoría | Descripción |
|-----------|-------------|
| Presté | Yo le presté dinero a alguien. Sale de mi bolsillo, me deben devolver. |
| Me prestaron | Me dieron un préstamo. Entró dinero, tengo que devolver. |
| Me deben | Alguien me debe, pero no hubo salida de dinero de mi parte. |
| Debo | Tengo una deuda, pero no entró dinero a mi bolsillo. |

Cada deuda tiene persona, título, descripción, monto, fecha, y opcionalmente **intereses** con:
- Tasa (con vista previa del total a pagar)
- Período: mensual, quincenal o anual
- Tipo: simple o compuesto
- Plazo en meses

Los abonos se registran y generan automáticamente el movimiento correspondiente (ingreso o egreso según el tipo de deuda).

---

### 4. Filtros
Búsqueda y exploración de todos los movimientos registrados con filtros combinables:

- **Por título**: búsqueda de texto en tiempo real.
- **Por monto mínimo**: muestra solo movimientos iguales o mayores al monto ingresado.
- **Por categoría**: filtra los movimientos de una categoría específica.
- **Por subcategoría**: refinamiento dentro de la categoría seleccionada.
- **Por tipo**: solo ingresos, solo egresos, o ambos.

Desde los resultados se puede editar o eliminar cualquier movimiento.

---

### 5. Categorías
Sistema de etiquetado jerárquico creado completamente por el usuario.

- Crea tantas **categorías** como necesites (Vivienda, Alimentación, Transporte, Salud, Ocio, etc.)
- Cada categoría puede tener múltiples **subcategorías** (Vivienda → Arriendo, Servicios, Internet)
- Las categorías se asignan al crear movimientos, gastos fijos y deudas
- Se muestran como badges de color en los registros para identificación rápida
- Persistentes en exportación/importación

---

### 6. Proyecciones
Simulaciones financieras para planear el futuro. Cada proyección se guarda, se puede abrir y cerrar individualmente, y crear tantas como se necesiten.

#### Simulador de Ahorro
Proyecta cuánto dinero habrás acumulado en X meses dado tu ingreso, gastos fijos, otros gastos y el porcentaje del sobrante que decides ahorrar. Opcionalmente incluye una tasa de rendimiento mensual (interés compuesto). Muestra la evolución mes a mes.

#### Calculadora de Deuda
Genera la **tabla de amortización completa** de un crédito. Soporta dos sistemas:
- **Sistema Francés** (cuota fija): estándar en Colombia para créditos de consumo e hipotecarios (Ley 546 de 1999).
- **Sistema Alemán** (capital fijo): cuota decreciente, menos común pero válido.

Muestra cuota inicial, total de intereses pagados, total pagado y el impacto de hacer pagos extras (cuántas cuotas se eliminan).

#### Meta Financiera
Defines una meta de ahorro (vacaciones, carro, fondo de emergencia) y la app calcula en qué mes y año la alcanzas según tu capacidad de ahorro actual. Muestra barra de progreso con el avance real.

#### Proyección Mensual
Simula tu balance mes a mes durante N meses si tus ingresos y gastos se mantienen constantes. Detecta y alerta si algún mes tu balance entraría en negativo.

#### Comparador de Escenarios
Compara dos situaciones financieras en paralelo durante el mismo período. Por ejemplo: "¿Qué pasa si aumento mis gastos fijos $300.000 vs si no los aumento?" Muestra qué escenario genera más ahorro y por cuánto.

---

### 7.  Consejos Financieros
Sección educativa con 10 consejos prácticos anclados al contexto colombiano:

- Fondo de emergencia (3–6 meses de gastos)
- Regla 50/30/20
- Peligros de las tarjetas de crédito y la tasa de usura
- CDT vs cuenta de ahorros y FOGAFIN
- Cómo usar Nequi/Daviplata para evitar el 4×1000
- Pensiones voluntarias y cuentas AFC (beneficio tributario)
- Riesgos del gota a gota
- Subsidios de vivienda VIS y el programa Mi Casa Ya
- Portabilidad financiera de crédito hipotecario
- Inflación y erosión del ahorro

---

## 📱 Instalación como PWA

La app puede instalarse en Android como si fuera una aplicación nativa:

**Android (Chrome):**
1. Abre la app en el navegador
2. Toca el menú ⋮ → "Añadir a pantalla de inicio"

Una vez instalada funciona sin conexión a internet.

---

## Datos y privacidad

- Todos los datos se guardan **exclusivamente en tu dispositivo** usando `localStorage`.
- Ningún dato se envía a servidores externos.
- Para hacer respaldo, usa el botón **Exportar** (genera un `.json`).
- Para restaurar o mover a otro dispositivo, usa **Importar**.
- El archivo exportado incluye: movimientos, fondos de ingreso, deudas, gastos fijos, quincenas/meses, categorías y proyecciones.

---

## Tecnologías usadas

| Tecnología | Uso |
|------------|-----|
| HTML5 | Estructura de la interfaz |
| CSS3 | Diseño visual, animaciones, tema oscuro |
| JavaScript (Vanilla) | Toda la lógica, sin frameworks |
| Chart.js (CDN) | Gráficas de gastos |
| localStorage | Persistencia de datos |
| Service Worker | Soporte offline (PWA) |
| Web App Manifest | Instalación como app nativa |

---

##  Cómo usar

1. Empieza registrando tus ingresos del período actual.
2. Registra cada gasto a medida que ocurre.
4. Crea categorías que reflejen tu estilo de vida.
5. Usa las proyecciones para planear metas concretas.
6. Exporta tus datos regularmente como respaldo.

---

##  Filosofía

> *"No se trata de ganar más, se trata de entender a dónde va lo que ya ganas."*

El mayor obstáculo para mejorar las finanzas personales no es la falta de ingresos — es la falta de conciencia. Esta app no juzga cuánto gastas ni en qué: solo te muestra la realidad de tus números para que seas tú quien tome decisiones informadas.

Registrar un gasto toma 10 segundos. Ese hábito, sostenido en el tiempo, puede cambiar completamente la relación que tienes con tu dinero.

---

*Desarrollado para uso personal. Sin publicidad, sin suscripciones, sin servidores.*

# MI GRAN LOGRO
se puede instalar haciendolo offline :D
