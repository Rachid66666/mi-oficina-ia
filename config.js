// Configuración de tu instalación. Rellena estos tres datos con los de tu proyecto de Supabase
// (Supabase > Project Settings > API). Si los dejas vacíos, el programa arranca en MODO DEMO:
// sin cuentas, con datos de ejemplo guardados solo en el navegador.
window.APP_CONFIG = {
  appName: 'Mi Oficina IA',          // el nombre comercial de tu programa
  supabaseUrl: '',                    // ej.: https://abcdefghijkl.supabase.co
  supabaseAnonKey: '',                // la clave "anon public" (es pública, se puede poner aquí)
  aiFunction: 'ai',                   // nombre de la función de IA desplegada en Supabase
  priceLabel: '19 €/mes'              // el precio que ves en el aviso de la prueba gratis (el real está en Stripe)
};
