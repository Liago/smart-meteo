/**
 * Variabili d'ambiente minime per far caricare i moduli sotto test.
 *
 * `middleware/auth.ts` chiama `createClient(process.env.SUPABASE_URL!, ...)` a
 * livello di modulo: con env assenti `createClient` lancia "supabaseUrl is
 * required" e l'intera suite non parte, perché l'engine importa `routes/sources`
 * che importa il middleware. Valori fittizi ma sintatticamente validi bastano:
 * nei test il client Supabase è comunque sostituito da un mock.
 */
process.env.SUPABASE_URL ||= 'https://test.supabase.co';
process.env.SUPABASE_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key';
