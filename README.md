# Mi Oficina

Programa de gestión con IA para autónomos y pequeñas empresas de España y Latinoamérica. Incluye clientes, agenda, trabajos, presupuestos, facturas, gastos y un asistente que lo hace todo hablando.

- Sin configurar, abre en **modo demo**, con datos de ejemplo guardados en el navegador.
- Para tener cuentas de usuario y la IA activada, sigue [GUIA-INSTALACION.md](GUIA-INSTALACION.md).

Funciona como web estática: sirve GitHub Pages, Netlify o cualquier hosting. Las cuentas y la base de datos van en Supabase. La IA usa Claude a través de la función `supabase/functions/ai`, que guarda la clave en el servidor.
