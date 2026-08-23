import { supabase } from '@/services/supabase';

export interface HealthCheckItem {
  id: string;
  name: string;
  category: 'database' | 'auth' | 'storage' | 'realtime';
  status: 'healthy' | 'warning' | 'error';
  latencyMs?: number;
  message: string;
}

export interface ProductionHealthReport {
  timestamp: string;
  allHealthy: boolean;
  checks: HealthCheckItem[];
}

export async function runProductionHealthCheck(): Promise<ProductionHealthReport> {
  const checks: HealthCheckItem[] = [];

  // 1. Test Base de données PostgreSQL & API PostgREST
  const startDb = performance.now();
  try {
    const { data, error } = await supabase.from('plans').select('code, name').limit(1);
    const latencyDb = Math.round(performance.now() - startDb);

    if (error) {
      checks.push({
        id: 'database_postgrest',
        name: 'Base de données PostgreSQL & RLS',
        category: 'database',
        status: 'error',
        latencyMs: latencyDb,
        message: `Erreur PostgREST : ${error.message}`,
      });
    } else {
      checks.push({
        id: 'database_postgrest',
        name: 'Base de données PostgreSQL & RLS',
        category: 'database',
        status: 'healthy',
        latencyMs: latencyDb,
        message: `Opérationnel (${latencyDb} ms) — ${data?.length ?? 0} plan(s) vérifié(s)`,
      });
    }
  } catch (err: any) {
    checks.push({
      id: 'database_postgrest',
      name: 'Base de données PostgreSQL & RLS',
      category: 'database',
      status: 'error',
      message: `Connexion impossible : ${err.message}`,
    });
  }

  // 2. Test Supabase Auth
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      checks.push({
        id: 'supabase_auth',
        name: 'Authentification Supabase Auth',
        category: 'auth',
        status: 'warning',
        message: `Session auth non disponible : ${error.message}`,
      });
    } else {
      checks.push({
        id: 'supabase_auth',
        name: 'Authentification Supabase Auth',
        category: 'auth',
        status: 'healthy',
        message: data.session ? `Connecté (${data.session.user.email})` : 'Service Auth actif (visiteur anonyme)',
      });
    }
  } catch (err: any) {
    checks.push({
      id: 'supabase_auth',
      name: 'Authentification Supabase Auth',
      category: 'auth',
      status: 'error',
      message: `Erreur service auth : ${err.message}`,
    });
  }

  // 3. Test Storage Bucket (intervention-attachments)
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      checks.push({
        id: 'supabase_storage',
        name: 'Stockage Fichiers & Pièces Jointes',
        category: 'storage',
        status: 'warning',
        message: `Contrôle buckets : ${error.message}`,
      });
    } else {
      const bucketNames = buckets?.map((b) => b.name) ?? [];
      const hasAttachments = bucketNames.includes('intervention-attachments');
      checks.push({
        id: 'supabase_storage',
        name: 'Stockage Fichiers & Pièces Jointes',
        category: 'storage',
        status: hasAttachments ? 'healthy' : 'warning',
        message: hasAttachments
          ? `Buckets disponibles (${bucketNames.join(', ')})`
          : `Bucket intervention-attachments à initialiser (${bucketNames.length} bucket(s) trouvés)`,
      });
    }
  } catch (err: any) {
    checks.push({
      id: 'supabase_storage',
      name: 'Stockage Fichiers & Pièces Jointes',
      category: 'storage',
      status: 'warning',
      message: `Vérification stockage : ${err.message}`,
    });
  }

  // 4. Test Navigateur & Mode PWA / Offline
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  checks.push({
    id: 'pwa_offline_capabilities',
    name: 'Capacités PWA & Mode Hors-Ligne',
    category: 'realtime',
    status: isOnline ? 'healthy' : 'warning',
    message: `${isOnline ? 'En ligne' : 'Mode hors-ligne'} — ${isStandalone ? 'PWA installée' : 'Mode navigateur web'}`,
  });

  const allHealthy = checks.every((c) => c.status === 'healthy');

  return {
    timestamp: new Date().toISOString(),
    allHealthy,
    checks,
  };
}
