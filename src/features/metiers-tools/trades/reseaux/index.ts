import type { MetierToolDefinition } from '../../types';

// Helpers IPv4
function parseNum(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

function ipToNumber(ip: string): number {
  const parts = ip.trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return 0;
  const p0 = parts[0] ?? 0;
  const p1 = parts[1] ?? 0;
  const p2 = parts[2] ?? 0;
  const p3 = parts[3] ?? 0;
  return ((p0 << 24) >>> 0) + (p1 << 16) + (p2 << 8) + p3;
}

function numberToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

function getMaskFromCidr(cidr: number): number {
  return cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
}

export const reseauxTools: MetierToolDefinition[] = [
  // 1. Calculateur IPv4
  {
    slug: 'ipv4',
    tradeSlug: 'reseaux',
    title: 'Calculateur d’Adresse IPv4 & Plages',
    shortDescription: 'Calcul de l’adresse réseau, broadcast, premier/dernier hôte et classe',
    description: 'Analysez une adresse IP avec son masque de sous-réseau (CIDR) : découvrez l’adresse de réseau, l’adresse de diffusion (broadcast) et la plage d’adresses assignables.',
    icon: 'network',
    tags: ['ipv4', 'réseau', 'broadcast', 'hôte', 'CIDR', 'masque', 'subnet', 'télécom'],
    reliabilityLevel: 'simple',
    standardReference: 'RFC 791 (Internet Protocol) & RFC 4632 (Classless Inter-domain Routing)',
    assumptions: [
      'Adressage IPv4 32 bits standard',
      'Plages privées selon RFC 1918 : 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16',
      'Plages Loopback : 127.0.0.0/8, APIPA : 169.254.0.0/16',
    ],
    limits: [
      'Pour préfixes /31 (point-à-point RFC 3021) ou /32 (hôte unique), le réseau et broadcast n’ont pas de sens conventionnel.',
    ],
    fields: [
      { id: 'ipAddress', label: 'Adresse IP (ex: 192.168.1.50)', type: 'text', defaultValue: '192.168.1.50', placeholder: '192.168.1.50' },
      {
        id: 'cidr',
        label: 'Masque CIDR',
        type: 'select',
        defaultValue: '24',
        options: [
          { value: '8', label: '/8 (255.0.0.0 — 16 777 214 hôtes)' },
          { value: '16', label: '/16 (255.255.0.0 — 65 534 hôtes)' },
          { value: '20', label: '/20 (255.255.240.0 — 4 094 hôtes)' },
          { value: '22', label: '/22 (255.255.252.0 — 1 022 hôtes)' },
          { value: '23', label: '/23 (255.255.254.0 — 510 hôtes)' },
          { value: '24', label: '/24 (255.255.255.0 — 254 hôtes)' },
          { value: '25', label: '/25 (255.255.255.128 — 126 hôtes)' },
          { value: '26', label: '/26 (255.255.255.192 — 62 hôtes)' },
          { value: '27', label: '/27 (255.255.255.224 — 30 hôtes)' },
          { value: '28', label: '/28 (255.255.255.240 — 14 hôtes)' },
          { value: '29', label: '/29 (255.255.255.248 — 6 hôtes)' },
          { value: '30', label: '/30 (255.255.255.252 — 2 hôtes P2P)' },
        ],
      },
    ],
    compute: (inputs) => {
      const ipStr = String(inputs.ipAddress || '192.168.1.50').trim();
      const cidr = parseNum(inputs.cidr, 24);

      const ipNum = ipToNumber(ipStr);
      if (ipNum === 0 && ipStr !== '0.0.0.0') {
        return {
          primaryResult: 'IP Invalide',
          primaryLabel: 'Adresse IPv4',
          status: 'warning',
          statusMessage: 'Veuillez saisir une adresse IPv4 valide (format X.X.X.X avec 0 <= X <= 255).',
          details: [{ label: 'Statut', value: 'Format IP non conforme' }],
        };
      }

      const maskNum = getMaskFromCidr(cidr);
      const netNum = (ipNum & maskNum) >>> 0;
      const bcastNum = (netNum | (~maskNum >>> 0)) >>> 0;

      const firstHostNum = cidr >= 31 ? netNum : netNum + 1;
      const lastHostNum = cidr >= 31 ? bcastNum : bcastNum - 1;
      const totalHosts = cidr >= 31 ? (cidr === 31 ? 2 : 1) : Math.max(0, Math.pow(2, 32 - cidr) - 2);

      // Classe
      const firstOctet = (ipNum >>> 24) & 255;
      let ipClass = 'Classe A';
      if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'Classe B';
      else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'Classe C';
      else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'Classe D (Multicast)';
      else if (firstOctet >= 240) ipClass = 'Classe E (Expérimental)';

      // Type privé / public (RFC 1918)
      let ipType = 'IP Publique (Routable Internet)';
      if (firstOctet === 10) ipType = 'IP Privée (RFC 1918 - Classe A)';
      else if (firstOctet === 172 && ((ipNum >>> 16) & 255) >= 16 && ((ipNum >>> 16) & 255) <= 31) ipType = 'IP Privée (RFC 1918 - Classe B)';
      else if (firstOctet === 192 && ((ipNum >>> 16) & 255) === 168) ipType = 'IP Privée (RFC 1918 - Classe C)';
      else if (firstOctet === 127) ipType = 'IP Boucle locale (Loopback)';
      else if (firstOctet === 169 && ((ipNum >>> 16) & 255) === 254) ipType = 'IP Lien local (APIPA / Zeroconf)';

      return {
        primaryResult: `${numberToIp(netNum)} /${cidr}`,
        primaryUnit: `Plage : ${numberToIp(firstHostNum)} → ${numberToIp(lastHostNum)} (${totalHosts} hôtes)`,
        primaryLabel: 'Adresse Réseau & Préfixe',
        status: 'ok',
        details: [
          { label: 'Adresse Réseau (Network)', value: numberToIp(netNum), highlight: true },
          { label: 'Masque décimal (Netmask)', value: numberToIp(maskNum) },
          { label: 'Adresse de Broadcast', value: numberToIp(bcastNum), highlight: true },
          { label: 'Plage d’hôtes utilisables', value: `${numberToIp(firstHostNum)} → ${numberToIp(lastHostNum)}`, highlight: true, badge: `${totalHosts} hôtes`, badgeVariant: 'success' },
          { label: 'Nombre total d’hôtes assignables', value: `${totalHosts.toLocaleString('fr-FR')} adresses` },
          { label: 'Classification', value: `${ipClass} • ${ipType}` },
        ],
        formulaExplanation: 'Réseau = IP & Masque. Broadcast = Réseau | (~Masque). Nb_Hôtes = 2^(32 - CIDR) - 2.',
      };
    },
  },

  // 2. Table & Masque CIDR
  {
    slug: 'cidr',
    tradeSlug: 'reseaux',
    title: 'Table & Masque CIDR (Préfixes /0 à /32)',
    shortDescription: 'Conversion préfixe CIDR, masque décimal, wildcard et capacité d’hôtes',
    description: 'Convertisseur instantané de préfixes CIDR en masques décimaux pointés, masques inversés (Wildcard ACL Cisco) et nombre de machines.',
    icon: 'table',
    tags: ['CIDR', 'masque', 'wildcard', 'ACL', 'sous-réseau', 'préfixe', 'hosts'],
    reliabilityLevel: 'simple',
    standardReference: 'RFC 4632 (Classless Inter-domain Routing Architecture)',
    assumptions: [
      'Représentation binaire standard sur 32 bits',
      'Wildcard mask = $255.255.255.255 - \\text{Netmask}$',
    ],
    limits: [
      'Pour IPv6, utiliser la notation hexadécimale standard avec préfixe /64 ou /48.',
    ],
    fields: [
      {
        id: 'selectedCidr',
        label: 'Préfixe CIDR',
        type: 'select',
        defaultValue: '24',
        options: Array.from({ length: 33 }, (_, i) => ({
          value: String(i),
          label: `/${i} (${getMaskFromCidr(i) === 0 ? '0.0.0.0' : numberToIp(getMaskFromCidr(i))})`,
        })),
      },
    ],
    compute: (inputs) => {
      const cidr = parseNum(inputs.selectedCidr, 24);
      const maskNum = getMaskFromCidr(cidr);
      const maskStr = numberToIp(maskNum);
      const wildcardNum = (~maskNum) >>> 0;
      const wildcardStr = numberToIp(wildcardNum);

      const totalIps = Math.pow(2, 32 - cidr);
      const usableHosts = cidr >= 31 ? (cidr === 31 ? 2 : 1) : Math.max(0, totalIps - 2);

      return {
        primaryResult: maskStr,
        primaryUnit: `Préfixe /${cidr} • ${usableHosts.toLocaleString('fr-FR')} hôtes utilisables`,
        primaryLabel: 'Masque de sous-réseau décimal',
        status: 'ok',
        details: [
          { label: 'Notation CIDR', value: `/${cidr}`, highlight: true },
          { label: 'Masque de sous-réseau (Netmask)', value: maskStr, highlight: true },
          { label: 'Masque générique inversé (Wildcard ACL)', value: wildcardStr },
          { label: 'Nombre d’adresses IP totales', value: totalIps.toLocaleString('fr-FR') },
          { label: 'Nombre d’hôtes utiles', value: `${usableHosts.toLocaleString('fr-FR')} machines`, highlight: true, badgeVariant: 'success' },
        ],
        formulaExplanation: 'Masque = (~0 << (32 - CIDR)). Wildcard = ~Masque. Hôtes_Utiles = 2^(32 - CIDR) - 2.',
      };
    },
  },

  // 3. Découpage en sous-réseaux (Subnetting)
  {
    slug: 'subnetting',
    tradeSlug: 'reseaux',
    title: 'Découpage en Sous-Réseaux (Subnetting FLSM)',
    shortDescription: 'Division d’un bloc IP parent en N sous-réseaux de taille fixe avec plages',
    description: 'Segmentez un réseau IP parent en 2, 4, 8, 16 ou 32 sous-réseaux égaux (Fixed Length Subnet Masking) et générez les plans d’adressage.',
    icon: 'split',
    tags: ['subnetting', 'découpage', 'FLSM', 'sous-réseau', 'plan d’adressage', 'CIDR'],
    reliabilityLevel: 'simple',
    standardReference: 'RFC 950 (Internet Standard Subnetting Procedure) & RFC 4632',
    assumptions: [
      'Découpage FLSM (Fixed Length Subnet Mask) en sous-réseaux de tailles rigoureusement identiques',
    ],
    limits: [
      'Pour des sous-réseaux de tailles hétérogènes, utiliser la méthode VLSM (Variable Length Subnet Masking).',
    ],
    fields: [
      { id: 'parentIp', label: 'Adresse IP du réseau parent', type: 'text', defaultValue: '192.168.10.0', placeholder: '192.168.10.0' },
      { id: 'parentCidr', label: 'Masque CIDR du réseau parent', type: 'number', defaultValue: 24, min: 8, max: 30, step: 1, unit: '/CIDR' },
      {
        id: 'newSubnetsCount',
        label: 'Nombre de sous-réseaux souhaités',
        type: 'select',
        defaultValue: '4',
        options: [
          { value: '2', label: '2 sous-réseaux (+1 bit de masque)' },
          { value: '4', label: '4 sous-réseaux (+2 bits de masque)' },
          { value: '8', label: '8 sous-réseaux (+3 bits de masque)' },
          { value: '16', label: '16 sous-réseaux (+4 bits de masque)' },
        ],
      },
    ],
    compute: (inputs) => {
      const parentIpStr = String(inputs.parentIp || '192.168.10.0').trim();
      const parentCidr = parseNum(inputs.parentCidr, 24);
      const subnetsCount = parseNum(inputs.newSubnetsCount, 4);

      const parentNum = ipToNumber(parentIpStr);
      if (parentNum === 0 && parentIpStr !== '0.0.0.0') {
        return {
          primaryResult: 'IP Invalide',
          primaryLabel: 'Subnetting',
          status: 'warning',
          statusMessage: 'Veuillez saisir une adresse IP parente valide.',
          details: [{ label: 'Statut', value: 'Format IP non conforme' }],
        };
      }

      // Bits supplémentaires nécessaires : log2(subnetsCount)
      const addedBits = Math.ceil(Math.log2(subnetsCount));
      const newCidr = parentCidr + addedBits;

      if (newCidr > 30) {
        return {
          primaryResult: 'Découpage impossible',
          primaryLabel: 'Subnetting',
          status: 'danger',
          statusMessage: `Impossible de découper un /${parentCidr} en ${subnetsCount} sous-réseaux (dépasserait le préfixe /30).`,
          details: [{ label: 'Erreur', value: 'Préfixe résultant > /30' }],
        };
      }

      const blockSize = Math.pow(2, 32 - newCidr);
      const hostsPerSubnet = blockSize - 2;

      // Générer les 4 premiers sous-réseaux d'exemple
      const baseNet = (parentNum & getMaskFromCidr(parentCidr)) >>> 0;
      const subnetsList: { net: string; first: string; last: string; bcast: string }[] = [];

      for (let i = 0; i < subnetsCount; i++) {
        const net = (baseNet + i * blockSize) >>> 0;
        const bcast = (net + blockSize - 1) >>> 0;
        subnetsList.push({
          net: numberToIp(net),
          first: numberToIp((net + 1) >>> 0),
          last: numberToIp((bcast - 1) >>> 0),
          bcast: numberToIp(bcast),
        });
      }

      return {
        primaryResult: `${subnetsCount} sous-réseaux /${newCidr}`,
        primaryUnit: `Chaque sous-réseau dispose de ${hostsPerSubnet} adresses hôtes (masque ${numberToIp(getMaskFromCidr(newCidr))})`,
        primaryLabel: 'Découpage FLSM généré',
        status: 'ok',
        details: [
          { label: 'Réseau parent d’origine', value: `${numberToIp(baseNet)} /${parentCidr}` },
          { label: 'Nouveau masque de sous-réseau', value: `${numberToIp(getMaskFromCidr(newCidr))} (/${newCidr})`, highlight: true },
          { label: 'Capacité par sous-réseau', value: `${hostsPerSubnet} hôtes utiles (${blockSize} adresses totales)` },
          ...subnetsList.map((s, idx) => ({
            label: `Sous-réseau #${idx + 1}`,
            value: `Réseau : ${s.net} | Hôtes : ${s.first} → ${s.last} | Broadcast : ${s.bcast}`,
            highlight: idx === 0,
          })),
        ],
        formulaExplanation: 'Nouveau_CIDR = Parent_CIDR + ceil(log2(Nb_Sous_Réseaux)). Taille_Bloc = 2^(32 - Nouveau_CIDR).',
      };
    },
  },

  // 4. Plan d'adressage VLAN
  {
    slug: 'vlan',
    tradeSlug: 'reseaux',
    title: 'Plan d’Adressage VLAN & Passerelle',
    shortDescription: 'Attribution VLAN ID (1-4094), nommage, IP de sous-réseau, passerelle et DHCP',
    description: 'Concevez et documentez rapidement un VLAN selon les standards d’entreprise : ID normalisé (IEEE 802.1Q), passerelle par défaut, bail DHCP et masque.',
    icon: 'layers',
    tags: ['VLAN', '802.1Q', 'switch', 'routeur', 'gateway', 'DHCP', 'adressage', 'subnet'],
    reliabilityLevel: 'simple',
    standardReference: 'IEEE 802.1Q (Virtual Bridged Local Area Networks)',
    assumptions: [
      'VLAN ID valide : 1 à 4094 (VLAN 1 = natif par défaut, 2-1001 = standard, 1006-4094 = étendu)',
      'Passerelle par défaut (Default Gateway) fixée sur la première adresse utile (.1) du sous-réseau',
    ],
    limits: [
      'Les VLAN ID 1002 à 1005 sont réservés pour les anciens protocoles Token Ring/FDDI.',
    ],
    fields: [
      { id: 'vlanId', label: 'Numéro de VLAN ID (1 à 4094)', type: 'number', defaultValue: 10, min: 1, max: 4094, step: 1 },
      { id: 'vlanName', label: 'Nom / Rôle du VLAN (ex: DATA, VOIP)', type: 'text', defaultValue: 'VLAN_DATA_USERS', placeholder: 'VLAN_DATA' },
      { id: 'subnetIp', label: 'Sous-réseau associé (ex: 10.10.0.0)', type: 'text', defaultValue: '10.10.0.0', placeholder: '10.10.0.0' },
      {
        id: 'cidr',
        label: 'Taille du sous-réseau',
        type: 'select',
        defaultValue: '24',
        options: [
          { value: '24', label: '/24 (254 hôtes — 255.255.255.0)' },
          { value: '23', label: '/23 (510 hôtes — 255.255.254.0)' },
          { value: '22', label: '/22 (1022 hôtes — 255.255.252.0)' },
          { value: '25', label: '/25 (126 hôtes — 255.255.255.128)' },
          { value: '28', label: '/28 (14 hôtes — 255.255.255.240)' },
        ],
      },
    ],
    compute: (inputs) => {
      const vlanId = parseNum(inputs.vlanId, 10);
      const vlanName = String(inputs.vlanName || 'VLAN_DATA').trim().toUpperCase().replace(/\s+/g, '_');
      const subnetIpStr = String(inputs.subnetIp || '10.10.0.0').trim();
      const cidr = parseNum(inputs.cidr, 24);

      if (vlanId < 1 || vlanId > 4094) {
        return {
          primaryResult: 'VLAN Invalide',
          primaryLabel: 'VLAN ID',
          status: 'warning',
          statusMessage: 'Le numéro de VLAN ID doit être compris entre 1 et 4094.',
          details: [{ label: 'Statut', value: 'VLAN ID hors plage valide' }],
        };
      }

      const ipNum = ipToNumber(subnetIpStr);
      const maskNum = getMaskFromCidr(cidr);
      const netNum = (ipNum & maskNum) >>> 0;
      const bcastNum = (netNum | (~maskNum >>> 0)) >>> 0;
      const gatewayNum = (netNum + 1) >>> 0;
      const dhcpStartNum = (netNum + 10) >>> 0;
      const dhcpEndNum = (bcastNum - 1) >>> 0;

      return {
        primaryResult: `VLAN ${vlanId} — ${vlanName}`,
        primaryUnit: `Réseau : ${numberToIp(netNum)}/${cidr} (Passerelle : ${numberToIp(gatewayNum)})`,
        primaryLabel: 'Configuration VLAN & Routage',
        status: 'ok',
        details: [
          { label: 'VLAN ID (IEEE 802.1Q)', value: `VLAN ${vlanId}`, highlight: true },
          { label: 'Nom du réseau virtuel', value: vlanName },
          { label: 'Adresse Réseau & Masque', value: `${numberToIp(netNum)} /${cidr} (${numberToIp(maskNum)})` },
          { label: 'Passerelle par défaut (Gateway)', value: numberToIp(gatewayNum), highlight: true, badge: 'Gateway', badgeVariant: 'primary' },
          { label: 'Plage d’attribution DHCP conseillée', value: `${numberToIp(dhcpStartNum)} → ${numberToIp(dhcpEndNum)}`, highlight: true, badgeVariant: 'success' },
          { label: 'Adresse de Broadcast', value: numberToIp(bcastNum) },
        ],
        formulaExplanation: 'Gateway = Réseau + 1. Plage_DHCP = (Réseau + 10) à (Broadcast - 1).',
      };
    },
  },
];
