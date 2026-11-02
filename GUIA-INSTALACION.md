# Mi Oficina: cómo ponerla en internet con tu propio link

Programa de gestión con IA para autónomos y pequeñas empresas de España y Latinoamérica. Cada cliente que lo use tiene su cuenta y solo ve sus datos.

Lo que incluye:
- Alta con email y contraseña.
- Al entrar por primera vez, la IA prepara la oficina según el oficio y el país: catálogo de precios, moneda e impuestos.
- 14 días de prueba gratis y después una cuota mensual cobrada con Stripe.
- Asistente por texto o voz para dar de alta clientes, agendar, hacer presupuestos y facturas y apuntar gastos.
- Lectura de tickets con la cámara.
- PDF de presupuestos y facturas, que se envían por WhatsApp o por email.
- Visitas a Google Calendar con un toque.
- Excel trimestral.
- 20 países ya configurados con su moneda, sus impuestos (IVA, IGV, ITBIS…) y su identificación fiscal (NIF, RFC, CUIT, NIT, RUT, RUC…).

Tiempo para ponerlo en marcha: unos 30-45 minutos, sin programar.

---

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | El programa |
| `runtime.js` | Conecta el programa con las cuentas, la base de datos y la IA |
| `config.js` | **El único archivo que tienes que editar** (3 datos) |
| `manifest.webmanifest`, `icon.svg` | Para instalarlo en el móvil como una app |
| `supabase/schema.sql` | La base de datos (se pega una vez) |
| `supabase/functions/ai/index.ts` | La función de IA del servidor (guarda tu clave de IA en secreto) |
| `supabase/functions/billing/index.ts` | Prueba gratis, pago y gestión de la suscripción |
| `supabase/functions/stripe-webhook/index.ts` | Recibe de Stripe los pagos, las renovaciones y las bajas |

Sin rellenar `config.js`, el programa abre en **modo demo**: sin cuentas y con datos de ejemplo guardados en el navegador. Sirve para enseñarlo.

---

## Paso 1. Crear la base de datos (Supabase, gratis para empezar)

1. Entra en https://supabase.com y crea una cuenta.
2. Pulsa **New project**:
   - Ponle nombre, por ejemplo `mi-oficina-ia`.
   - Elige una contraseña para la base de datos y guárdala.
   - Región: **West EU** si tus clientes están en España, **South America (São Paulo)** si están en Latinoamérica.
3. Cuando esté creado, ve a **SQL Editor**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**. Tiene que decir "Success".
4. Ve a **Authentication > URL Configuration** y en **Site URL** pon la dirección donde vas a publicar el programa (paso 4). Puedes volver a cambiarla luego.

## Paso 2. La clave de la IA (Anthropic)

1. Entra en https://console.anthropic.com, crea una cuenta y añade saldo en **Billing**. Se paga por uso.
2. En **API Keys** crea una clave y cópiala. **No la pongas nunca en `config.js`**: va en el servidor (paso 3).

## Paso 3. Subir la función de IA

1. En Supabase ve a **Edge Functions > Deploy a new function > Via Editor**.
2. Nombre: `ai`. Borra el código de ejemplo, pega el contenido de `supabase/functions/ai/index.ts` y pulsa **Deploy**.
3. Ve a **Edge Functions > Secrets** y añade:
   - `ANTHROPIC_API_KEY` = la clave del paso 2.
   - Opcional: `AI_DAILY_LIMIT` = consultas de IA por usuario y día. Por defecto son 150; sirve para que nadie te dispare el gasto.
   - Opcional: `AI_MODEL` = el modelo de Claude. Por defecto `claude-sonnet-5-5`.

## Paso 4. Rellenar `config.js` y publicar

1. En Supabase ve a **Project Settings > API** y copia:
   - la **Project URL**;
   - la clave **anon / publishable**. Esta es pública y sí va en el archivo.
2. Abre `config.js` con el Bloc de notas y rellena `appName`, `supabaseUrl` y `supabaseAnonKey`.
3. Publica la carpeta. La forma más fácil es Netlify:
   - Entra en https://app.netlify.com/drop, crea una cuenta y **arrastra la carpeta entera**.
   - En unos segundos te da un link del estilo `https://algo.netlify.app`.
   - Luego, en **Domain settings**, puedes poner tu dominio, por ejemplo `tuoficina.es`.
   - Si lo tienes en **GitHub**, también es gratis con GitHub Pages: en el repositorio ve a **Settings > Pages**, en "Source" elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda. En un par de minutos queda en `https://TU-USUARIO.github.io/mi-oficina-ia/`.
4. Vuelve al paso 1.4 y pon ese link en **Site URL**.

Para probarlo, abre el link, pulsa **Crear cuenta**, confirma el email y entra. La IA te pedirá el nombre del negocio, el oficio y el país, y montará la oficina.

En el móvil se instala desde el navegador: menú **Añadir a pantalla de inicio**.

---

## Paso 5. Cobrar la suscripción (Stripe)

Cómo funciona para tus clientes:
- Cada cuenta nueva tiene **14 días de prueba gratis**. Durante la prueba ve un aviso abajo con los días que le quedan y el botón **Suscribirme**.
- Al pagar, Stripe le cobra la cuota cada mes de forma automática. En **Ajustes** puede cambiar la tarjeta o darse de baja.
- Si la prueba se acaba sin pagar, **sus datos siguen ahí**, pero la IA se pausa hasta que se suscriba.

Si todavía no quieres cobrar, añade el secreto `BILLING_OFF` = `1` en Supabase y la IA funcionará siempre.

Configuración:
1. Crea una cuenta en https://stripe.com. Empieza en **modo de prueba**, con el interruptor "Test mode" activado.
2. **Product catalog > Add product**:
   - Nombre: el de tu programa.
   - Precio: **recurrente mensual**, por ejemplo 19 EUR.
   - Para cobrar en Latinoamérica puedes añadir el mismo precio en USD en el mismo producto.
   - Copia el **ID del precio**, que empieza por `price_`.
3. **Developers > API keys**: copia la **Secret key**. Empieza por `sk_test_` en pruebas y por `sk_live_` en real.
4. En Supabase, **Edge Functions > Deploy a new function > Via Editor**, sube estas dos funciones:
   - `billing`, con el código de `supabase/functions/billing/index.ts`.
   - `stripe-webhook`, con el código de `supabase/functions/stripe-webhook/index.ts`. En esta, **desactiva "Verify JWT"** (también puede aparecer como "Enforce JWT verification"), porque quien la llama es Stripe y no un usuario.
5. En Stripe, **Developers > Webhooks > Add endpoint**:
   - URL: `https://TU-PROYECTO.supabase.co/functions/v1/stripe-webhook`.
   - Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`.
   - Copia el **Signing secret**, que empieza por `whsec_`.
6. **Settings > Billing > Customer portal**: actívalo y permite cancelar la suscripción y cambiar la tarjeta.
7. En Supabase, **Edge Functions > Secrets**, añade:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET`
   - opcional: `TRIAL_DAYS`, por defecto 14.
8. En `config.js` pon el precio que se mostrará en `priceLabel`, por ejemplo `'19 €/mes'`.

Para probarlo, crea una cuenta, pulsa **Suscribirme** y paga con la tarjeta de prueba `4242 4242 4242 4242`, con cualquier fecha futura y cualquier CVC. Al volver, el aviso desaparece y en Ajustes sale "Suscripción activa". Cuando todo funcione, repite los pasos 2, 3, 5 y 7 con Stripe en modo real.

---

---

## Paso 6. Códigos de acceso: controlar a quién vendes el programa

Con esto nadie puede crearse una cuenta sin un código que le des tú. Cada código sirve para **una sola cuenta**, así que sabes exactamente cuántas veces lo has vendido.

1. Si todavía no tienes tu propia cuenta en el programa, créala primero (antes de este paso aún no hace falta código).
2. En Supabase, abre **SQL Editor**, pega todo el contenido de `supabase/codigos.sql` y pulsa **Run**.
3. En el mismo SQL Editor, hazte dueño con esta línea, cambiando el email por el de tu cuenta, y pulsa **Run**:
   `insert into public.app_admins(user_id) select id from auth.users where email = 'TU_EMAIL' on conflict do nothing;`
4. Entra en el programa y recarga. En **Más** te aparece **Control de ventas**. Ahí puedes:
   - **Crear un código** por cada venta y enviarlo por WhatsApp o por email. El mensaje lleva un enlace con el código ya puesto.
   - Ver qué códigos están libres, cuáles se han usado y por quién.
   - Ver todas las cuentas: empresa, email, alta y último acceso.
   - **Bloquear** una cuenta, por ejemplo si deja de pagar. No podrá entrar ni usar la IA, pero sus datos no se borran. Puedes desbloquearla cuando quieras.

Las cuentas que ya existían antes de este paso siguen funcionando sin código.

## Lo que cuesta al mes (aproximado)

| Servicio | Para empezar | Con clientes de pago |
|---|---|---|
| Supabase (cuentas y datos) | 0 € | unos 25 $/mes (plan Pro) |
| Netlify (la web) | 0 € | 0-19 $/mes |
| Dominio propio | unos 10-15 €/año | igual |
| IA (Anthropic) | céntimos por consulta | depende del uso; con el límite diario lo controlas |
| Stripe | 0 € fijo | comisión por cobro, alrededor del 1,5-3 % + 0,25 € según el país y la tarjeta |

---

## Antes de cobrar a nadie: lo que falta

1. **Textos legales**: aviso legal, política de privacidad y términos de uso. Como guardas datos de los clientes de tus clientes, también hace falta el contrato de encargado del tratamiento (RGPD en España; la ley de datos de cada país en Latinoamérica).
2. **Facturación oficial**. Esto es muy importante:
   - **España**: los programas de facturación tienen que cumplir **Veri\*factu**. El calendario de entrada en vigor se ha retrasado varias veces, así que **confirma las fechas actuales con tu gestoría**. Quien vende el programa firma una declaración de que lo cumple.
   - **Latinoamérica**: en casi todos los países la factura legal es **electrónica** y pasa por Hacienda o un proveedor autorizado:
     - México: CFDI con un PAC.
     - Colombia: DIAN.
     - Chile: SII.
     - Perú: SUNAT.
     - Argentina: ARCA (antes AFIP).
   - **Mientras no se conecte con esos sistemas, las facturas del programa sirven como comprobante y control interno, no como factura fiscal.** Dilo claro al vender.
3. **Google Calendar y Gmail** funcionan por enlace: la visita se abre ya rellenada en Google Calendar y el email en Gmail con el PDF descargado para adjuntar. No hace falta pasar la revisión de Google. Una conexión automática completa necesita registrar la app en Google y pasar su verificación, que puede tardar semanas.

## Para cambiar el nombre o el aspecto

- Nombre del programa: `appName` en `config.js`.
- Cada cliente sube su propio logo en **Ajustes** y le sale en las facturas.
- Los colores están al principio de `index.html` (variables `--yellow`, `--accent`…).
