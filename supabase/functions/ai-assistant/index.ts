import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Edge Function : Assistant IA REZO360 (RAG Universel & Analyse Métier)
 *
 * Couvre l'intégralité du progiciel :
 *   1. Équipe & Techniciens (membres, rôles, statuts, disponibilités)
 *   2. Missions & Interventions (en cours, en retard, planifiées, terminées)
 *   3. Stock & Consommables (quantités, seuils d'alerte, catégories)
 *   4. Parc Matériel & Outillage (étalonnages, contrôles, affectations)
 *   5. Flotte Véhicules (contrôles techniques, révisions, kilométrages)
 *   6. Achats & Fournisseurs (commandes en cours, réceptions)
 *   7. Devis & Chiffrage (validité, clients, montants)
 *   8. Répertoire Clients (villes, coordonnées)
 *   9. Planning & Congés (absences validées)
 *  10. Trames & Comptes-rendus d'interventions (fibre optique, télécom, élec)
 *  11. Formules & Calculs techniques (Loi d'Ohm, optique, dBm, réseaux)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface RequestBody {
  organizationId: string;
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Authentification requise' }, 401);
    }

    const body: RequestBody = await req.json();
    const { organizationId, query, history = [] } = body;

    if (!organizationId || !query?.trim()) {
      return json({ error: 'organizationId et query sont requis' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey;

    // 1. Vérification de la session utilisateur
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(jwt);

    if (userError || !user) {
      return json({ error: 'Session utilisateur invalide ou expirée' }, 401);
    }

    // 2. Vérification d'appartenance à l'organisation
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerMembership, error: memberCheckError } = await adminClient
      .from('organization_members')
      .select('id, role, status')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .in('status', ['active', 'invited'])
      .maybeSingle();

    if (memberCheckError || !callerMembership) {
      return json({ error: 'Accès non autorisé à cette organisation' }, 403);
    }

    // 3. Extraction globale des données de l'organisation
    const [
      membersRes,
      teamsRes,
      missionsRes,
      stockRes,
      equipmentRes,
      vehiclesRes,
      suppliersRes,
      purchasesRes,
      quotesRes,
      customersRes,
      leavesRes,
      orgRes,
    ] = await Promise.all([
      adminClient
        .from('organization_members')
        .select('id, user_id, role, status, job_title, phone, profile:profiles(id, display_name, avatar_url)')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'invited']),
      adminClient
        .from('teams')
        .select('id, name, description')
        .eq('organization_id', organizationId),
      adminClient
        .from('missions')
        .select('id, reference, title, status, priority, scheduled_start, scheduled_end, customer_name, city')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50),
      adminClient
        .from('stock_consumables')
        .select('id, name, reference, category, quantity_in_stock, min_alert_threshold, unit')
        .eq('organization_id', organizationId)
        .limit(50),
      adminClient
        .from('equipment')
        .select('id, name, brand, serial_number, category, status, condition, next_calibration')
        .eq('organization_id', organizationId)
        .limit(40),
      adminClient
        .from('vehicles')
        .select('id, plate, brand, model, type, status, mileage, next_ct_date, next_revision_date')
        .eq('organization_id', organizationId)
        .limit(30),
      adminClient
        .from('suppliers')
        .select('id, name, code, contact_name, city, phone')
        .eq('organization_id', organizationId)
        .limit(30),
      adminClient
        .from('purchase_orders')
        .select('id, reference, supplier_name, status, order_date, expected_delivery_date')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(30),
      adminClient
        .from('quotes')
        .select('id, reference, title, customer_name, status, valid_until')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(30),
      adminClient
        .from('customers')
        .select('id, name, reference, city, status, phone')
        .eq('organization_id', organizationId)
        .limit(40),
      adminClient
        .from('leave_requests')
        .select('id, user_id, type, start_date, end_date, status')
        .eq('organization_id', organizationId)
        .eq('status', 'approved')
        .limit(30),
      adminClient
        .from('organizations')
        .select('id, name, slug, max_members, industry')
        .eq('id', organizationId)
        .single(),
    ]);

    const members = membersRes.data ?? [];
    const teams = teamsRes.data ?? [];
    const missions = missionsRes.data ?? [];
    const stockItems = stockRes.data ?? [];
    const equipment = equipmentRes.data ?? [];
    const vehicles = vehiclesRes.data ?? [];
    const suppliers = suppliersRes.data ?? [];
    const purchases = purchasesRes.data ?? [];
    const quotes = quotesRes.data ?? [];
    const customers = customersRes.data ?? [];
    const leaves = leavesRes.data ?? [];
    const organization = orgRes.data ?? null;

    // Analyse approfondie des entités
    const activeMembers = members.filter((m: any) => m.status === 'active' || m.status === 'invited');
    const roleTechnicians = activeMembers.filter((m: any) => m.role === 'technician');
    const jobTechnicians = activeMembers.filter(
      (m: any) => m.role !== 'technician' && m.job_title && m.job_title.toLowerCase().includes('technicien'),
    );
    const allTechnicians = activeMembers.filter(
      (m: any) =>
        m.role === 'technician' ||
        (m.job_title && m.job_title.toLowerCase().includes('technicien')) ||
        m.role === 'member',
    );
    const admins = activeMembers.filter((m: any) => m.role === 'admin' || m.role === 'owner');

    const now = new Date();
    const lateMissions = missions.filter((m: any) => {
      if (m.status === 'completed' || m.status === 'cancelled') return false;
      if (!m.scheduled_end && !m.scheduled_start) return false;
      const targetDate = new Date(m.scheduled_end || m.scheduled_start || '');
      return targetDate < now;
    });
    const inProgressMissions = missions.filter((m: any) => m.status === 'in_progress');
    const completedMissions = missions.filter((m: any) => m.status === 'completed');

    const lowStockItems = stockItems.filter(
      (item: any) => item.quantity_in_stock <= item.min_alert_threshold,
    );

    const equipmentAlerts = equipment.filter((eq: any) => {
      if (!eq.next_calibration) return false;
      return new Date(eq.next_calibration) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    });

    const vehicleAlerts = vehicles.filter((v: any) => {
      if (!v.next_ct_date && !v.next_revision_date) return false;
      const ctAlert = v.next_ct_date && new Date(v.next_ct_date) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const revAlert = v.next_revision_date && new Date(v.next_revision_date) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return ctAlert || revAlert;
    });

    const pendingPurchases = purchases.filter((p: any) => p.status === 'draft' || p.status === 'sent');

    const formatMemberName = (m: any) => {
      const name = m.profile?.display_name || 'Utilisateur';
      const roleLabel =
        m.role === 'owner'
          ? 'Propriétaire'
          : m.role === 'admin'
            ? 'Administrateur'
            : m.role === 'technician'
              ? 'Technicien'
              : m.role === 'manager'
                ? 'Responsable'
                : 'Membre';
      const job = m.job_title ? ` — ${m.job_title}` : '';
      return `${name} (${roleLabel}${job})`;
    };

    // Contexte textuel RAG structuré
    const orgContext = `
Données en direct de l'organisation "${organization?.name || 'REZO360'}" :
- Équipe (${activeMembers.length} utilisateurs actifs, max : ${organization?.max_members || 10}) :
  * Membres avec rôle "Technicien" (${roleTechnicians.length}) : ${roleTechnicians.map((t: any) => formatMemberName(t)).join(', ') || 'Aucun'}
  * Autres collaborateurs sur poste technique (${jobTechnicians.length}) : ${jobTechnicians.map((t: any) => formatMemberName(t)).join(', ') || 'Aucun'}
  * Dirigeants / Administrateurs (${admins.length}) : ${admins.map((a: any) => formatMemberName(a)).join(', ') || 'Aucun'}
  * Liste complète :
    ${activeMembers.map((m: any) => `• ${formatMemberName(m)}`).join('\n    ')}

- Équipes créées (${teams.length}) : ${teams.map((t: any) => t.name).join(', ') || 'Aucune équipe spécifique'}

- Missions & Interventions (${missions.length} récentes) :
  * En cours : ${inProgressMissions.length}
  * En retard : ${lateMissions.length} (${lateMissions.map((m: any) => `#${m.reference || m.id.slice(0, 6)} "${m.title}"`).join(', ') || 'Aucune'})
  * Terminées : ${completedMissions.length}
  * Liste d'interventions : ${missions.slice(0, 8).map((m: any) => `#${m.reference || m.id.slice(0, 5)}: ${m.title} [${m.status}] (${m.customer_name || 'Client'})`).join(' ; ') || 'Aucune'}

- Stock & Consommables (${stockItems.length} articles) :
  * Alertes stock bas / rupture (${lowStockItems.length}) : ${
      lowStockItems.length > 0
        ? lowStockItems.map((s: any) => `${s.name} (Stock: ${s.quantity_in_stock} ${s.unit || 'unités'}, Min: ${s.min_alert_threshold})`).join(', ')
        : 'Aucune alerte de rupture'
    }

- Parc Matériel & Outillage (${equipment.length} équipements) :
  * Alertes contrôle/étalonnage (< 30j ou dépassé) : ${equipmentAlerts.length} (${equipmentAlerts.map((e: any) => `${e.name} (${e.brand || ''})`).join(', ') || 'Aucune'})
  * Liste d'équipements : ${equipment.slice(0, 6).map((e: any) => `${e.name} [${e.status || 'actif'}]`).join(', ') || 'Aucun équipement'}

- Flotte Véhicules (${vehicles.length} véhicules) :
  * Alertes CT/Révision (< 30j) : ${vehicleAlerts.length} (${vehicleAlerts.map((v: any) => `${v.plate} ${v.brand} ${v.model}`).join(', ') || 'Aucune'})
  * Liste des véhicules : ${vehicles.map((v: any) => `${v.plate} - ${v.brand} ${v.model} (${v.mileage || 0} km)`).join(' ; ') || 'Aucun véhicule enregistré'}

- Achats & Commandes (${purchases.length} commandes, ${suppliers.length} fournisseurs) :
  * Commandes en cours (${pendingPurchases.length}) : ${pendingPurchases.map((p: any) => `#${p.reference} [${p.status}] chez ${p.supplier_name || 'Fournisseur'}`).join(', ') || 'Aucune commande en cours'}
  * Fournisseurs : ${suppliers.map((s: any) => s.name).join(', ') || 'Aucun fournisseur'}

- Devis & Chiffrage (${quotes.length} devis) :
  * Devis récents : ${quotes.slice(0, 5).map((q: any) => `#${q.reference} "${q.title}" [${q.status}] (${q.customer_name || 'Client'})`).join(' ; ') || 'Aucun devis'}

- Clients (${customers.length} clients répertoriés) :
  * Liste : ${customers.slice(0, 8).map((c: any) => `${c.name} (${c.city || 'N/C'})`).join(', ') || 'Aucun client'}

- Planning & Congés (${leaves.length} congés approuvés).
`;

    // 4. Détection intelligente des intentions et actions associées
    const qLower = query.toLowerCase();
    const proposedActions: any[] = [];
    const sources: string[] = [];

    // Intention : Équipe & Techniciens
    if (
      qLower.includes('technicien') ||
      qLower.includes('équipe') ||
      qLower.includes('equipe') ||
      qLower.includes('membre') ||
      qLower.includes('collaborateur') ||
      qLower.includes('utilisateur') ||
      qLower.includes('employé') ||
      qLower.includes('salarié')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-tech`,
        title: 'Voir l’annuaire de l’équipe',
        description: 'Consulter la liste complète des membres et techniciens.',
        actionType: 'view_technicians',
        requiresConfirmation: false,
        status: 'idle',
      });
      sources.push('Table PostgreSQL : organization_members');
    }

    // Intention : Missions & Interventions
    if (
      qLower.includes('mission') ||
      qLower.includes('intervention') ||
      qLower.includes('retard') ||
      qLower.includes('chantier') ||
      qLower.includes('dépannage') ||
      qLower.includes('raccordement')
    ) {
      if (qLower.includes('retard') || qLower.includes('urgent') || qLower.includes('contrôle') || qLower.includes('controle')) {
        proposedActions.push({
          id: `act-${Date.now()}-review`,
          title: 'File de contrôle des interventions',
          description: 'Vérifier les interventions en retard et en attente.',
          actionType: 'view_late_interventions',
          requiresConfirmation: false,
          status: 'idle',
        });
      } else {
        proposedActions.push({
          id: `act-${Date.now()}-missions`,
          title: 'Ouvrir les missions',
          description: 'Accéder à la liste des interventions.',
          actionType: 'view_missions',
          requiresConfirmation: false,
          status: 'idle',
        });
      }
      sources.push('Table PostgreSQL : missions');
    }

    // Intention : Stock & Consommables
    if (
      qLower.includes('stock') ||
      qLower.includes('consommable') ||
      qLower.includes('câble') ||
      qLower.includes('cable') ||
      qLower.includes('connecteur') ||
      qLower.includes('jarretière') ||
      qLower.includes('pto') ||
      qLower.includes('pbo') ||
      qLower.includes('rupture')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-stock`,
        title: 'Gérer le stock',
        description: 'Consulter les quantités et seuils d’alerte.',
        actionType: 'view_stock',
        requiresConfirmation: false,
        status: 'idle',
      });
      sources.push('Table PostgreSQL : stock_consumables');
    }

    // Intention : Matériel, Outillage & Équipements
    if (
      qLower.includes('matériel') ||
      qLower.includes('materiel') ||
      qLower.includes('outillage') ||
      qLower.includes('équipement') ||
      qLower.includes('equipement') ||
      qLower.includes('étalonnage') ||
      qLower.includes('etalonnage') ||
      qLower.includes('soudeuse') ||
      qLower.includes('reflectometre') ||
      qLower.includes('réflectomètre') ||
      qLower.includes('otdr')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-equipment`,
        title: 'Parc matériel & outillage',
        description: 'Vérifier les équipements, statuts et dates d’étalonnage.',
        actionType: 'view_equipment',
        requiresConfirmation: false,
        status: 'idle',
      });
      sources.push('Table PostgreSQL : equipment');
    }

    // Intention : Flotte & Véhicules
    if (
      qLower.includes('véhicule') ||
      qLower.includes('vehicule') ||
      qLower.includes('voiture') ||
      qLower.includes('camionnette') ||
      qLower.includes('fourgon') ||
      qLower.includes('flotte') ||
      qLower.includes('contrôle technique') ||
      qLower.includes('revision') ||
      qLower.includes('révision') ||
      qLower.includes('kilométrage') ||
      qLower.includes('kilometrage')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-vehicles`,
        title: 'Gestion de la flotte véhicules',
        description: 'Consulter les véhicules, contrôles techniques et entretiens.',
        actionType: 'view_vehicles',
        requiresConfirmation: false,
        status: 'idle',
      });
      sources.push('Table PostgreSQL : vehicles');
    }

    // Intention : Achats & Fournisseurs
    if (
      qLower.includes('achat') ||
      qLower.includes('fournisseur') ||
      qLower.includes('bon de commande') ||
      qLower.includes('commande')
    ) {
      if (qLower.includes('fournisseur')) {
        proposedActions.push({
          id: `act-${Date.now()}-suppliers`,
          title: 'Répertoire des fournisseurs',
          description: 'Accéder à la liste des fournisseurs partenaires.',
          actionType: 'view_suppliers',
          requiresConfirmation: false,
          status: 'idle',
        });
      } else {
        proposedActions.push({
          id: `act-${Date.now()}-purchases`,
          title: 'Commandes d’achat',
          description: 'Consulter les bons de commande et réceptions.',
          actionType: 'view_purchases',
          requiresConfirmation: false,
          status: 'idle',
        });
      }
      sources.push('Table PostgreSQL : purchase_orders / suppliers');
    }

    // Intention : Devis & Chiffrage
    if (
      qLower.includes('devis') ||
      qLower.includes('chiffrage') ||
      qLower.includes('facture') ||
      qLower.includes('proposition')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-quotes`,
        title: 'Module Devis & Chiffrage',
        description: 'Gérer vos devis et propositions commerciales.',
        actionType: 'view_quotes',
        requiresConfirmation: false,
        status: 'idle',
      });
      sources.push('Table PostgreSQL : quotes');
    }

    // Intention : Clients & Répertoire
    if (
      qLower.includes('client') ||
      qLower.includes('donneur d’ordre') ||
      qLower.includes('abonnés') ||
      qLower.includes('abonnes')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-customers`,
        title: 'Répertoire clients',
        description: 'Consulter vos clients et sites d’intervention.',
        actionType: 'view_customers',
        requiresConfirmation: false,
        status: 'idle',
      });
      sources.push('Table PostgreSQL : customers');
    }

    // Intention : Planning & Congés
    if (
      qLower.includes('planning') ||
      qLower.includes('congé') ||
      qLower.includes('conge') ||
      qLower.includes('absence') ||
      qLower.includes('disponible') ||
      qLower.includes('calendrier')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-planning`,
        title: 'Planning & Disponibilités',
        description: 'Consulter le planning d’équipe et les congés.',
        actionType: 'view_planning',
        requiresConfirmation: false,
        status: 'idle',
      });
      sources.push('Table PostgreSQL : leave_requests');
    }

    // Intention : Compte-rendu & Trame
    if (
      qLower.includes('compte-rendu') ||
      qLower.includes('compte rendu') ||
      qLower.includes('rapport') ||
      qLower.includes('trame') ||
      qLower.includes('cr')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-reports`,
        title: 'Comptes-rendus d’intervention',
        description: 'Accéder au module de rédaction et validation.',
        actionType: 'draft_intervention_report',
        requiresConfirmation: false,
        status: 'idle',
      });
    }

    // Intention : Calculatrices & Outils techniques
    if (
      qLower.includes('calcul') ||
      qLower.includes('loi d\'ohm') ||
      qLower.includes('ohm') ||
      qLower.includes('dbm') ||
      qLower.includes('attenuation') ||
      qLower.includes('atténuation') ||
      qLower.includes('puissance') ||
      qLower.includes('section') ||
      qLower.includes('pente') ||
      qLower.includes('formule')
    ) {
      proposedActions.push({
        id: `act-${Date.now()}-tools`,
        title: 'Outils & Calculatrices Métier',
        description: 'Ouvrir le catalogue des outils techniques REZO360.',
        actionType: 'view_tools',
        requiresConfirmation: false,
        status: 'idle',
      });
    }

    // 5. Moteur d'IA & Réponses Déterministes Enrichies
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    let aiContent = '';

    // A. Appel LLM Google Gemini
    if (geminiApiKey) {
      try {
        const systemPrompt = `Tu es l'Assistant IA expert de REZO360, progiciel de gestion d'interventions techniques, télécom, fibre optique (FTTH/FTTE), courants faibles et réseaux.
Tu as un accès direct aux données en temps réel de l'entreprise :
${orgContext}

Règles de réponse :
1. Réponds toujours en français professionnel, précis et chaleureux.
2. Si la question porte sur un chiffre (ex: combien de techniciens, de missions, de véhicules, d'articles en alerte), donne les chiffres exacts puis liste les éléments clés pertinents.
3. Si la question est technique (ex: calcul d'atténuation fibre, formule électrique, trame de compte-rendu), donne la méthode technique rigoureuse adaptée aux métiers télécom / élec.
4. Ne dis JAMAIS que tu n'as pas accès aux données de l'organisation.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\nHistorique :\n${JSON.stringify(history)}\n\nQuestion utilisateur : ${query}` }] },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1200,
              },
            }),
          },
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (err) {
        console.error('Erreur appel Gemini:', err);
      }
    }

    // B. Appel LLM OpenAI (si Gemini absent ou en erreur)
    if (!aiContent && openaiApiKey) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Tu es l'Assistant IA de REZO360. Voici les données réelles de l'organisation :\n${orgContext}\nRéponds de manière concise, précise et professionnelle.`,
              },
              ...history.map((h) => ({ role: h.role, content: h.content })),
              { role: 'user', content: query },
            ],
            temperature: 0.2,
          }),
        });

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          aiContent = data.choices?.[0]?.message?.content || '';
        }
      } catch (err) {
        console.error('Erreur appel OpenAI:', err);
      }
    }

    // C. Moteur d'Analyse Contextuelle Déterministe Exhaustif (sans clé externe requise)
    if (!aiContent) {
      // 1. Équipe & Techniciens
      if (
        qLower.includes('technicien') ||
        (qLower.includes('combien') && (qLower.includes('membre') || qLower.includes('personne') || qLower.includes('utilisateur') || qLower.includes('equipe') || qLower.includes('équipe')))
      ) {
        aiContent = `Vous avez actuellement **${activeMembers.length} utilisateur${activeMembers.length > 1 ? 's' : ''} actif${activeMembers.length > 1 ? 's' : ''}** dans votre organisation (sur les ${organization?.max_members || 10} autorisés par votre plan) :\n\n` +
          `* **${roleTechnicians.length} Technicien(s) attitré(s)** : ${
            roleTechnicians.length > 0
              ? roleTechnicians.map((t: any) => `**${t.profile?.display_name || 'Utilisateur'}**`).join(', ')
              : 'Aucun membre avec le rôle exclusif de technicien'
          }\n` +
          (jobTechnicians.length > 0
            ? `* **${jobTechnicians.length} Collaborateur(s) sur poste technique** : ${jobTechnicians
                .map((t: any) => `**${t.profile?.display_name || 'Utilisateur'}** (${t.job_title})`)
                .join(', ')}\n`
            : '') +
          `\n**Détail complet de l'équipe :**\n` +
          activeMembers.map((m: any) => `* **${m.profile?.display_name || 'Utilisateur'}** — ${m.role === 'owner' ? 'Propriétaire' : m.role === 'admin' ? 'Administrateur' : 'Technicien'}${m.job_title ? ` (${m.job_title})` : ''}`).join('\n');
      }

      // 2. Missions & Retards
      else if (qLower.includes('retard') || (qLower.includes('mission') && (qLower.includes('urgent') || qLower.includes('alerte') || qLower.includes('bloqu')))) {
        aiContent = `### Interventions & Alertes de retard\n\n` +
          (lateMissions.length > 0
            ? `Il y a **${lateMissions.length} intervention${lateMissions.length > 1 ? 's' : ''} en retard** ou dont l'échéance est dépassée :\n\n` +
              lateMissions.map((m: any) => `* **#${m.reference || m.id.slice(0, 6)}** — *${m.title}* (${m.customer_name || 'Client'}) à ${m.city || 'N/C'}`).join('\n')
            : `Excellente nouvelle : **aucune intervention n'est actuellement en retard** parmi vos missions planifiées.`);
      }

      // 3. Missions générales
      else if (qLower.includes('mission') || qLower.includes('intervention')) {
        aiContent = `### État des interventions (${missions.length} récentes)\n\n` +
          `* ⚡ **En cours** : ${inProgressMissions.length} mission(s)\n` +
          `* ⚠️ **En retard** : ${lateMissions.length} mission(s)\n` +
          `* ✅ **Terminées** : ${completedMissions.length} mission(s)\n\n` +
          (missions.length > 0
            ? `**Dernières interventions planifiées :**\n` +
              missions.slice(0, 5).map((m: any) => `* **#${m.reference || m.id.slice(0, 6)}** — ${m.title} [Statut : *${m.status}*] (${m.customer_name || 'Client'})`).join('\n')
            : `Aucune mission enregistrée pour le moment.`);
      }

      // 4. Stock & Consommables
      else if (qLower.includes('stock') || qLower.includes('consommable') || qLower.includes('câble') || qLower.includes('cable') || qLower.includes('rupture')) {
        aiContent = `### État des stocks et consommables (${stockItems.length} références)\n\n` +
          (lowStockItems.length > 0
            ? `⚠️ **${lowStockItems.length} article${lowStockItems.length > 1 ? 's' : ''} sous le seuil minimal de réapprovisionnement** :\n\n` +
              lowStockItems.map((s: any) => `* **${s.name}** : **${s.quantity_in_stock} ${s.unit || 'unités'}** restantes (Seuil d'alerte : ${s.min_alert_threshold})`).join('\n')
            : `Tous vos consommables et équipements sont au-dessus de leur seuil minimal de sécurité (${stockItems.length} références actives).`);
      }

      // 5. Parc Matériel & Outillage
      else if (qLower.includes('matériel') || qLower.includes('materiel') || qLower.includes('outillage') || qLower.includes('équipement') || qLower.includes('equipement') || qLower.includes('étalonnage')) {
        aiContent = `### Parc Matériel & Outillage (${equipment.length} équipements)\n\n` +
          (equipmentAlerts.length > 0
            ? `⚠️ **${equipmentAlerts.length} appareil(s) nécessitant un contrôle ou étalonnage imminent** :\n\n` +
              equipmentAlerts.map((e: any) => `* **${e.name}** (${e.brand || 'Marque N/C'}) — N° Série : \`${e.serial_number || 'N/C'}\` — Prochain contrôle : **${e.next_calibration || 'Dépassé'}**`).join('\n')
            : `Tous vos équipements de mesure et outillages sont à jour de contrôle (${equipment.length} appareils enregistrés).`);
      }

      // 6. Véhicules & Flotte
      else if (qLower.includes('véhicule') || qLower.includes('vehicule') || qLower.includes('flotte') || qLower.includes('voiture') || qLower.includes('camion')) {
        aiContent = `### Flotte de Véhicules (${vehicles.length} véhicules)\n\n` +
          (vehicles.length > 0
            ? `**Liste des véhicules :**\n` +
              vehicles.map((v: any) => `* **${v.plate}** — ${v.brand} ${v.model} (${v.type || 'Utilitaire'}) — **${v.mileage || 0} km** ${v.next_ct_date ? `| CT : ${v.next_ct_date}` : ''}`).join('\n') +
              (vehicleAlerts.length > 0
                ? `\n\n⚠️ **${vehicleAlerts.length} véhicule(s) avec échéance de contrôle technique ou révision proche.**`
                : '')
            : `Aucun véhicule n'est encore enregistré dans votre flotte.`);
      }

      // 7. Achats & Fournisseurs
      else if (qLower.includes('achat') || qLower.includes('fournisseur') || qLower.includes('commande')) {
        aiContent = `### Achats & Fournisseurs\n\n` +
          `* 🏢 **Fournisseurs enregistrés** : **${suppliers.length}** (${suppliers.map((s: any) => s.name).join(', ') || 'Aucun'})\n` +
          `* 📦 **Commandes d'achats récentes** : **${purchases.length}** dont **${pendingPurchases.length} en cours**\n\n` +
          (purchases.length > 0
            ? purchases.slice(0, 4).map((p: any) => `* **#${p.reference}** — ${p.supplier_name || 'Fournisseur'} [Statut : *${p.status}*]`).join('\n')
            : `Aucune commande d'achat enregistrée.`);
      }

      // 8. Clients
      else if (qLower.includes('client')) {
        aiContent = `### Répertoire Clients (${customers.length} clients)\n\n` +
          (customers.length > 0
            ? `**Clients récents :**\n` +
              customers.slice(0, 8).map((c: any) => `* **${c.name}** (Réf: \`${c.reference || 'N/C'}\`) — ${c.city || 'Ville non renseignée'}`).join('\n')
            : `Aucun client n'est encore répertorié dans votre base.`);
      }

      // 9. Planning & Congés
      else if (qLower.includes('planning') || qLower.includes('congé') || qLower.includes('conge') || qLower.includes('absence') || qLower.includes('disponible')) {
        aiContent = `### Planning & Disponibilités de l'équipe\n\n` +
          `* 👥 **Membres de l'organisation** : **${activeMembers.length} collaborateurs**\n` +
          `* 🏖️ **Congés approuvés** : **${leaves.length}**\n\n` +
          `Tous les autres techniciens sont considérés disponibles pour l'affectation sur vos missions du planning.`;
      }

      // 10. Trame de compte-rendu technique
      else if (qLower.includes('compte-rendu') || qLower.includes('rapport') || qLower.includes('trame') || qLower.includes('rédig') || qLower.includes('redig')) {
        aiContent = `### Trame de Compte-Rendu d'Intervention Technique\n\n` +
          `Voici la structure standardisée pour vos interventions terrain :\n\n` +
          `1. 📍 **Contexte & Constat initial** :\n` +
          `   * Heure d'arrivée sur site, interlocuteur client présent.\n` +
          `   * État initial des équipements et contrôle visuel.\n\n` +
          `2. 🛠️ **Opérations techniques réalisées** :\n` +
          `   * Tirage / aiguillage / passage de câble (longueur en mètres).\n` +
          `   * Soudures optiques / raccordement bornier / jarretiérage.\n` +
          `   * Remplacement de composants ou matériel.\n\n` +
          `3. 📊 **Mesures et Contrôles de conformité** :\n` +
          `   * Réflectométrie / Photométrie (Atténuation mesurée en dB / dBm).\n` +
          `   * Test de continuité, test de débit / synchronisation.\n\n` +
          `4. ✍️ **Conclusion & Clôture** :\n` +
          `   * Validation du fonctionnement avec le client.\n` +
          `   * Photos justificatives (avant/après horodatées).\n` +
          `   * Signature électronique du donneur d'ordre.`;
      }

      // 11. Calculs techniques (Loi d'Ohm, Fibre, dBm)
      else if (qLower.includes('ohm') || qLower.includes('dbm') || qLower.includes('attenuation') || qLower.includes('atténuation') || qLower.includes('calcul')) {
        aiContent = `### Aide & Calculs Techniques REZO360\n\n` +
          `* ⚡ **Loi d'Ohm & Puissance** :\n` +
          `  * Tension : $U = R \\times I$\n` +
          `  * Puissance : $P = U \\times I = R \\times I^2 = \\frac{U^2}{R}$\n\n` +
          `* 🌐 **Optique & dBm / mW** :\n` +
          `  * Puissance en dBm : $P_{\\text{dBm}} = 10 \\times \\log_{10}(P_{\\text{mW}})$\n` +
          `  * $0\\text{ dBm} = 1\\text{ mW}$ ; $10\\text{ dBm} = 10\\text{ mW}$ ; $20\\text{ dBm} = 100\\text{ mW}$\n\n` +
          `* 📏 **Budget Optique & Atténuation** :\n` +
          `  * Atténuation fibre mono-mode : ~0,35 dB/km à 1310 nm | ~0,22 dB/km à 1550 nm.\n` +
          `  * Épissure / Soudure fusion : ~0,05 dB à 0,1 dB max.\n` +
          `  * Connecteur SC-APC : ~0,3 dB à 0,5 dB.\n\n` +
          `Vous pouvez utiliser directement nos **calculatrices spécialisées** depuis l'onglet Outils.`;
      }

      // 12. Synthèse globale / Bilan de l'organisation
      else {
        aiContent = `### Bilan d'activité — ${organization?.name ? `"${organization.name}"` : 'REZO360'}\n\n` +
          `* 👥 **Équipe** : **${activeMembers.length} collaborateur(s)** (${roleTechnicians.length} rôle technicien, ${jobTechnicians.length} poste technique, ${admins.length} gérance).\n` +
          `* 📋 **Missions** : **${missions.length}** répertoriées (${inProgressMissions.length} en cours, ${lateMissions.length} en retard, ${completedMissions.length} terminées).\n` +
          `* 📦 **Stock** : **${stockItems.length} articles** (${lowStockItems.length} alerte(s) de réapprovisionnement).\n` +
          `* 🛠️ **Parc Matériel** : **${equipment.length} équipements** (${equipmentAlerts.length} alerte(s) étalonnage).\n` +
          `* 🚗 **Flotte** : **${vehicles.length} véhicules** enregistrés.\n` +
          `* 🏢 **Clients** : **${customers.length} clients** et **${suppliers.length} fournisseurs**.\n\n` +
          `Que souhaitez-vous analyser ou consulter en détail ?`;
      }
    }

    return json({
      content: aiContent,
      actions: proposedActions,
      sources: sources.length > 0 ? sources : ['Base de données PostgreSQL REZO360'],
      degraded: false,
    });
  } catch (err) {
    console.error('Erreur générale ai-assistant:', err);
    return json({ error: err instanceof Error ? err.message : 'Erreur interne de traitement' }, 500);
  }
});
