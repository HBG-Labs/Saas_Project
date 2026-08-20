import { useEffect, useRef } from 'react';

/**
 * Interface pour les nœuds du réseau d'interventions REZO360.
 */
interface NetworkNode {
  id: string;
  x: number; // Ratio [0, 1] de la largeur du canvas
  y: number; // Ratio [0, 1] de la hauteur du canvas
  depth: number; // Niveau de profondeur pour le parallaxe [0.3 à 1.2]
  type: 'core' | 'fibre' | 'telecom' | 'elec' | 'maintenance' | 'hub';
  label: string;
  code: string;
  radius: number;
  basePulse: number;
  pulseSpeed: number;
  pulsePhase: number;
  activeRipple: number; // Rayon de l'onde de choc lorsqu'un paquet arrive (0 = inactif)
  color: string;
  glowColor: string;
}

/**
 * Interface pour les connexions entre nœuds.
 */
interface NetworkEdge {
  fromIndex: number;
  toIndex: number;
  strength: number; // Opacité de base [0.1 à 0.6]
  pulsePhase: number;
  curvature: number; // Légère courbure de la ligne [-0.15 à 0.15]
}

/**
 * Interface pour les flux de données circulant sur le réseau.
 */
interface DataPacket {
  edgeIndex: number;
  progress: number; // [0, 1] le long du segment
  speed: number;
  size: number;
  color: string;
  reverse: boolean;
}

export function RezoNetworkHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Vérification de l'accessibilité : prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // État du pointeur avec amortissement (lerp) pour un parallaxe fluide
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    // État du scroll pour la transition vers le bas
    let scrollProgress = 0;

    // Palette REZO360 : Dark Mode & Light Mode
    const DARK_THEME = {
      core: '#38bdf8', // Cyan vif
      coreGlow: 'rgba(56, 189, 248, 0.45)',
      fibre: '#06b6d4', // Cyan fibre
      fibreGlow: 'rgba(6, 182, 212, 0.35)',
      telecom: '#3b82f6', // Bleu électrique
      telecomGlow: 'rgba(59, 130, 246, 0.35)',
      elec: '#f59e0b', // Ambre / énergie
      elecGlow: 'rgba(245, 158, 11, 0.35)',
      maintenance: '#10b981', // Émeraude / chantier actif
      maintenanceGlow: 'rgba(16, 185, 129, 0.35)',
      hub: '#6366f1', // Indigo / répartiteur
      hubGlow: 'rgba(99, 102, 241, 0.35)',
      grid: 'rgba(59, 130, 246, 0.04)',
      lineBase: '56, 189, 248',
      halo0: 'rgba(56, 189, 248, 0.14)',
      halo1: 'rgba(37, 99, 235, 0.06)',
      halo2: 'rgba(15, 23, 42, 0)',
      coreOuterRing: 'rgba(56, 189, 248, 0.4)',
      coreInnerRing: 'rgba(6, 182, 212, 0.35)',
      coreHaloStop: 'rgba(56, 189, 248, 0.2)',
      labelColor: 'rgba(148, 163, 184, 0.75)',
    };

    const LIGHT_THEME = {
      core: '#0284c7', // Sky 600
      coreGlow: 'rgba(2, 132, 199, 0.25)',
      fibre: '#0891b2', // Cyan 600
      fibreGlow: 'rgba(8, 145, 178, 0.20)',
      telecom: '#2563eb', // Bleu royal 600
      telecomGlow: 'rgba(37, 99, 235, 0.20)',
      elec: '#d97706', // Ambre 600
      elecGlow: 'rgba(217, 119, 6, 0.20)',
      maintenance: '#059669', // Émeraude 600
      maintenanceGlow: 'rgba(5, 150, 105, 0.20)',
      hub: '#4f46e5', // Indigo 600
      hubGlow: 'rgba(79, 70, 229, 0.20)',
      grid: 'rgba(148, 163, 184, 0.12)', // Grille cartographique fine
      lineBase: '37, 99, 235',
      halo0: 'rgba(37, 99, 235, 0.08)',
      halo1: 'rgba(14, 165, 233, 0.04)',
      halo2: 'rgba(248, 250, 252, 0)',
      coreOuterRing: 'rgba(2, 132, 199, 0.4)',
      coreInnerRing: 'rgba(8, 145, 178, 0.35)',
      coreHaloStop: 'rgba(2, 132, 199, 0.2)',
      labelColor: 'rgba(71, 85, 105, 0.85)',
    };

    const getTheme = () =>
      document.documentElement.classList.contains('dark') ? DARK_THEME : LIGHT_THEME;

    let nodes: NetworkNode[] = [];
    let edges: NetworkEdge[] = [];
    let packets: DataPacket[] = [];

    // Configuration adaptative selon la taille d'écran et l'orientation
    const initNetwork = () => {
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const currentTheme = getTheme();

      nodes = [];
      edges = [];
      packets = [];

      // 1. Nœud Central "REZO CORE" — Orchestrateur
      // Sur mobile : positionné plus haut, exactement au niveau de "Connectez tout votre réseau." à droite
      // Sur desktop : positionné en haut à droite pour équilibrer le titre à gauche
      const coreX = isMobile ? 0.78 : isTablet ? 0.72 : 0.68;
      const coreY = isMobile
        ? height > 0
          ? Math.max(0.06, Math.min(0.12, 165 / height))
          : 0.09
        : isTablet
          ? 0.22
          : 0.28;

      nodes.push({
        id: 'rezo-core',
        x: coreX,
        y: coreY,
        depth: 1.0,
        type: 'core',
        label: 'REZO CORE',
        code: 'HUB-ORCHESTRATION',
        radius: isMobile ? 6 : 9,
        basePulse: 1.0,
        pulseSpeed: 0.03,
        pulsePhase: 0,
        activeRipple: 0,
        color: currentTheme.core,
        glowColor: currentTheme.coreGlow,
      });

      // 2. Nœuds d'interventions et points terrain
      // Sur mobile : répartition périphérique (flancs latéraux + haut/bas) pour garder le centre lisible
      // Sur desktop : maillage cartographique riche sur toute la largeur
      type Preset = {
        x: number;
        y: number;
        depth: number;
        type: NetworkNode['type'];
        label: string;
        code: string;
      };

      const mobilePresets: Preset[] = [
        // Flanc gauche
        { x: 0.06, y: height > 0 ? Math.min(0.08, 110 / height) : 0.06, depth: 0.7, type: 'fibre', label: 'Point NRO', code: 'OPT-75A' },
        { x: 0.10, y: height > 0 ? Math.min(0.20, 320 / height) : 0.18, depth: 0.9, type: 'telecom', label: 'Site Relais 5G', code: 'TEL-892' },
        { x: 0.07, y: 0.52, depth: 0.5, type: 'elec', label: 'Poste HTA/BT', code: 'ELEC-14' },
        { x: 0.14, y: 0.82, depth: 0.8, type: 'maintenance', label: 'Chantier Raccordement', code: 'INT-3401' },

        // Flanc droit
        { x: 0.92, y: height > 0 ? Math.min(0.07, 100 / height) : 0.05, depth: 0.8, type: 'fibre', label: 'Backbone Fibre', code: 'BB-OPT-01' },
        { x: 0.94, y: height > 0 ? Math.min(0.25, 420 / height) : 0.22, depth: 0.6, type: 'telecom', label: 'Station Télécom', code: 'ST-54B' },
        { x: 0.88, y: 0.60, depth: 0.7, type: 'elec', label: 'Armoire Distribution', code: 'TGBT-09' },
        { x: 0.92, y: 0.88, depth: 0.9, type: 'fibre', label: 'Point de Mutualisation', code: 'PM-93' },

        // Arrière-plan haut / bas
        { x: 0.30, y: 0.03, depth: 0.4, type: 'hub', label: 'Centre Opérations', code: 'HUB-CENTRAL' },
        { x: 0.50, y: 0.94, depth: 0.45, type: 'maintenance', label: 'Contrôle Qualité', code: 'QC-44' },
      ];

      const desktopPresets: Preset[] = [
        // Flanc gauche
        { x: 0.12, y: 0.18, depth: 0.7, type: 'fibre', label: 'Point NRO', code: 'OPT-75A' },
        { x: 0.24, y: 0.32, depth: 0.9, type: 'telecom', label: 'Site Relais 5G', code: 'TEL-892' },
        { x: 0.08, y: 0.48, depth: 0.5, type: 'elec', label: 'Poste HTA/BT', code: 'ELEC-14' },
        { x: 0.18, y: 0.68, depth: 0.8, type: 'maintenance', label: 'Chantier Raccordement', code: 'INT-3401' },
        { x: 0.28, y: 0.84, depth: 0.6, type: 'fibre', label: 'Sous-répartiteur', code: 'PM-08' },

        // Centre et arrière-plan profond
        { x: 0.42, y: 0.12, depth: 0.4, type: 'hub', label: 'Centre Opérations', code: 'HUB-CENTRAL' },
        { x: 0.38, y: 0.45, depth: 0.6, type: 'telecom', label: 'Antenne Pylône', code: 'RAD-92' },
        { x: 0.48, y: 0.74, depth: 0.8, type: 'maintenance', label: 'Intervention CVC', code: 'INT-8902' },
        { x: 0.52, y: 0.92, depth: 0.5, type: 'elec', label: 'Conformité NF C 15-100', code: 'AUDIT-02' },

        // Flanc droit
        { x: 0.86, y: 0.15, depth: 0.8, type: 'fibre', label: 'Backbone Fibre', code: 'BB-OPT-01' },
        { x: 0.92, y: 0.38, depth: 0.6, type: 'telecom', label: 'Station Télécom', code: 'ST-54B' },
        { x: 0.78, y: 0.48, depth: 1.1, type: 'maintenance', label: 'Équipe Tech Terrain', code: 'EQ-NORD' },
        { x: 0.88, y: 0.65, depth: 0.7, type: 'elec', label: 'Armoire Distribution', code: 'TGBT-09' },
        { x: 0.72, y: 0.82, depth: 0.9, type: 'fibre', label: 'Point de Mutualisation', code: 'PM-93' },
        { x: 0.85, y: 0.90, depth: 0.6, type: 'hub', label: 'Dépôt Matériel & Flotte', code: 'DEPOT-01' },

        // Nœuds d'ambiance lointains
        { x: 0.04, y: 0.30, depth: 0.3, type: 'telecom', label: 'Liaison FH', code: 'FH-01' },
        { x: 0.62, y: 0.08, depth: 0.35, type: 'hub', label: 'Serveur Métier', code: 'SRV-SEC' },
        { x: 0.96, y: 0.78, depth: 0.4, type: 'elec', label: 'Transformateur', code: 'TR-11' },
        { x: 0.35, y: 0.95, depth: 0.45, type: 'maintenance', label: 'Contrôle Qualité', code: 'QC-44' },
      ];

      const activePresets = isMobile ? mobilePresets : desktopPresets;

      activePresets.forEach((p, idx) => {
        const themeColor = currentTheme[p.type];
        const themeGlow = currentTheme[`${p.type}Glow` as keyof typeof currentTheme];

        nodes.push({
          id: `node-${idx + 1}`,
          x: p.x,
          y: p.y,
          depth: p.depth,
          type: p.type,
          label: p.label,
          code: p.code,
          radius: (isMobile ? 3 : 4.5) * Math.max(0.6, p.depth),
          basePulse: 0.8,
          pulseSpeed: 0.02 + Math.random() * 0.02,
          pulsePhase: Math.random() * Math.PI * 2,
          activeRipple: 0,
          color: themeColor,
          glowColor: themeGlow,
        });
      });

      // 3. Construction des connexions logiques (Topologie adaptée en pixels réels)
      const connect = (from: number, to: number, strength = 0.25, curvature = 0) => {
        if (from >= nodes.length || to >= nodes.length) return;
        edges.push({
          fromIndex: from,
          toIndex: to,
          strength,
          pulsePhase: Math.random() * Math.PI * 2,
          curvature,
        });
      };

      // Calcul des distances en pixels réels pour éviter les distorsions sur écrans verticaux
      const maxConnectPx = isMobile ? Math.min(width, height) * 0.65 : Math.min(width, height) * 0.48;

      // Connexions depuis le Core (index 0)
      const core = nodes[0];
      if (core) {
        for (let i = 1; i < nodes.length; i++) {
          const target = nodes[i];
          if (!target) continue;
          const distPx = Math.hypot((core.x - target.x) * width, (core.y - target.y) * height);
          if (distPx < maxConnectPx * 1.2) {
            connect(0, i, 0.32, (Math.random() - 0.5) * 0.08);
          }
        }
      }

      // Connexions secondaires entre nœuds voisins
      for (let i = 1; i < nodes.length; i++) {
        const nodeA = nodes[i];
        if (!nodeA) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          if (!nodeB) continue;
          const distPx = Math.hypot((nodeA.x - nodeB.x) * width, (nodeA.y - nodeB.y) * height);
          if (distPx < maxConnectPx) {
            connect(i, j, 0.18, (Math.random() - 0.5) * 0.10);
          }
        }
      }

      // 4. Initialisation des paquets de données en circulation
      const packetCount = isMobile ? 6 : 14;
      for (let k = 0; k < packetCount; k++) {
        if (edges.length === 0) break;
        const edgeIdx = Math.floor(Math.random() * edges.length);
        const selectedEdge = edges[edgeIdx];
        if (!selectedEdge) continue;
        const sourceNode = nodes[selectedEdge.fromIndex];
        packets.push({
          edgeIndex: edgeIdx,
          progress: Math.random(),
          speed: 0.003 + Math.random() * 0.004,
          size: isMobile ? 2.0 : 2.5,
          color: sourceNode ? sourceNode.color : currentTheme.core,
          reverse: Math.random() > 0.5,
        });
      }
    };

    // Gestion du redimensionnement net avec Retina/DPR
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      initNetwork();
    };

    // Interaction souris (Parallaxe subtil)
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Normalisé entre -1 et 1
      targetMouseX = (x - 0.5) * 2;
      targetMouseY = (y - 0.5) * 2;
    };

    const handleMouseLeave = () => {
      targetMouseX = 0;
      targetMouseY = 0;
    };

    // Interaction scroll (effacement progressif)
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const heroHeight = height || 600;
      scrollProgress = Math.min(1, Math.max(0, scrollY / (heroHeight * 0.8)));
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    handleResize();

    // -------------------------------------------------------------------------
    // BOUCLE DE RENDU 60 FPS HAUTE PRÉCISION
    // -------------------------------------------------------------------------
    let lastTime = performance.now();

    const render = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const currentTheme = getTheme();

      // Amortissement lerp pour la souris
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      // Effacement du canvas
      ctx.clearRect(0, 0, width, height);

      // Si l'utilisateur scroll au-delà de la hero, on limite les calculs
      if (scrollProgress >= 0.98) {
        if (!prefersReducedMotion) {
          animationFrameId = requestAnimationFrame(render);
        }
        return;
      }

      // Opacité globale liée au scroll
      ctx.globalAlpha = 1 - scrollProgress * 0.85;

      // Calcul des coordonnées réelles avec parallaxe de profondeur
      const computedNodes = nodes.map((node) => {
        const parallaxFactor = node.depth * 20;
        const px = node.x * width + currentMouseX * parallaxFactor;
        const py = node.y * height + currentMouseY * parallaxFactor + scrollProgress * 40;
        return { ...node, px, py };
      });

      // 1. Grille cartographique technique discrète
      const gridSize = width < 768 ? 50 : 70;
      ctx.strokeStyle = currentTheme.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Halo atmosphérique sous le REZO CORE
      const coreNode = computedNodes[0];
      if (coreNode) {
        const haloRadius = width < 768 ? width * 0.45 : width * 0.35;
        const haloGrad = ctx.createRadialGradient(
          coreNode.px,
          coreNode.py,
          10,
          coreNode.px,
          coreNode.py,
          haloRadius
        );
        haloGrad.addColorStop(0, currentTheme.halo0);
        haloGrad.addColorStop(0.5, currentTheme.halo1);
        haloGrad.addColorStop(1, currentTheme.halo2);

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(coreNode.px, coreNode.py, haloRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Dessin des lignes de réseau (Edges)
      edges.forEach((edge) => {
        const from = computedNodes[edge.fromIndex];
        const to = computedNodes[edge.toIndex];
        if (!from || !to) return;

        edge.pulsePhase += delta * 1.5;
        const dynamicAlpha = edge.strength * (0.7 + 0.3 * Math.sin(edge.pulsePhase));

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${currentTheme.lineBase}, ${dynamicAlpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(0.7, ((from.depth + to.depth) / 2) * 1.1);

        // Ligne avec courbure quadratique élégante
        if (Math.abs(edge.curvature) > 0.01) {
          const midX = (from.px + to.px) / 2;
          const midY = (from.py + to.py) / 2;
          const dx = to.px - from.px;
          const dy = to.py - from.py;
          const normalX = -dy * edge.curvature;
          const normalY = dx * edge.curvature;

          ctx.moveTo(from.px, from.py);
          ctx.quadraticCurveTo(midX + normalX, midY + normalY, to.px, to.py);
        } else {
          ctx.moveTo(from.px, from.py);
          ctx.lineTo(to.px, to.py);
        }
        ctx.stroke();
      });

      // 4. Dessin et mise à jour des paquets de flux de données
      if (!prefersReducedMotion) {
        packets.forEach((packet) => {
          const edge = edges[packet.edgeIndex];
          if (!edge) return;

          const from = computedNodes[edge.fromIndex];
          const to = computedNodes[edge.toIndex];
          if (!from || !to) return;

          packet.progress += packet.speed * (packet.reverse ? -1 : 1);

          // Gestion de l'arrivée au bout du segment
          if (packet.progress >= 1 || packet.progress <= 0) {
            const targetNode = packet.progress >= 1 ? nodes[edge.toIndex] : nodes[edge.fromIndex];
            if (targetNode) {
              targetNode.activeRipple = 1.0;
            }

            const nextNodeIdx = packet.progress >= 1 ? edge.toIndex : edge.fromIndex;
            const connectedEdgeIndices: number[] = [];
            edges.forEach((e, idx) => {
              if (e.fromIndex === nextNodeIdx || e.toIndex === nextNodeIdx) {
                connectedEdgeIndices.push(idx);
              }
            });

            if (connectedEdgeIndices.length > 0) {
              const randomIndex = Math.floor(Math.random() * connectedEdgeIndices.length);
              const nextEdgeIdx = connectedEdgeIndices[randomIndex];
              if (nextEdgeIdx !== undefined) {
                packet.edgeIndex = nextEdgeIdx;
                const nextEdge = edges[nextEdgeIdx];
                if (nextEdge) {
                  packet.reverse = nextEdge.toIndex === nextNodeIdx;
                  packet.progress = packet.reverse ? 1 : 0;
                }
              }
            } else {
              packet.progress = packet.reverse ? 1 : 0;
            }
          }

          // Position interpolée le long de la courbe ou ligne
          const t = Math.max(0, Math.min(1, packet.progress));
          let posX: number;
          let posY: number;

          if (Math.abs(edge.curvature) > 0.01) {
            const midX = (from.px + to.px) / 2;
            const midY = (from.py + to.py) / 2;
            const dx = to.px - from.px;
            const dy = to.py - from.py;
            const ctrlX = midX - dy * edge.curvature;
            const ctrlY = midY + dx * edge.curvature;

            posX = (1 - t) * (1 - t) * from.px + 2 * (1 - t) * t * ctrlX + t * t * to.px;
            posY = (1 - t) * (1 - t) * from.py + 2 * (1 - t) * t * ctrlY + t * t * to.py;
          } else {
            posX = from.px + (to.px - from.px) * t;
            posY = from.py + (to.py - from.py) * t;
          }

          const packetColor = currentTheme[from.type];

          // Dessin du paquet lumineux
          ctx.beginPath();
          const pGlow = ctx.createRadialGradient(posX, posY, 0, posX, posY, packet.size * 3.5);
          pGlow.addColorStop(0, packetColor);
          pGlow.addColorStop(0.4, packetColor);
          pGlow.addColorStop(1, `rgba(${currentTheme.lineBase}, 0)`);

          ctx.fillStyle = pGlow;
          ctx.arc(posX, posY, packet.size * 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Cœur étincelant blanc
          ctx.beginPath();
          ctx.fillStyle = '#ffffff';
          ctx.arc(posX, posY, packet.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 5. Dessin des Nœuds du réseau
      computedNodes.forEach((node, idx) => {
        if (!prefersReducedMotion) {
          node.pulsePhase += node.pulseSpeed;
        }

        const pulseScale = 1 + Math.sin(node.pulsePhase) * 0.15;
        const currentRadius = node.radius * pulseScale;

        const nodeColor = currentTheme[node.type];
        const nodeGlowColor = currentTheme[`${node.type}Glow` as keyof typeof currentTheme];

        // Ondes de choc actives (Ripples)
        if (node.activeRipple > 0) {
          const maxRippleRadius = node.radius * (idx === 0 ? 5.5 : 4.0);
          const rippleRadius = node.radius + (1 - node.activeRipple) * (maxRippleRadius - node.radius);

          ctx.beginPath();
          ctx.strokeStyle = nodeColor;
          ctx.globalAlpha = node.activeRipple * 0.5 * (1 - scrollProgress);
          ctx.lineWidth = 1.2;
          ctx.arc(node.px, node.py, rippleRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1 - scrollProgress * 0.85;

          node.activeRipple -= delta * 1.8;
          if (node.activeRipple < 0) node.activeRipple = 0;
        }

        // Cas Particulier : Le REZO CORE
        if (node.type === 'core') {
          // Anneau orbital externe en pointillés
          ctx.save();
          ctx.translate(node.px, node.py);
          ctx.rotate(time * 0.0003);
          ctx.beginPath();
          ctx.setLineDash([4, 6]);
          ctx.strokeStyle = currentTheme.coreOuterRing;
          ctx.lineWidth = 1.2;
          ctx.arc(0, 0, node.radius * 3.0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Anneau orbital intermédiaire inversé
          ctx.save();
          ctx.translate(node.px, node.py);
          ctx.rotate(-time * 0.0004);
          ctx.beginPath();
          ctx.setLineDash([6, 10]);
          ctx.strokeStyle = currentTheme.coreInnerRing;
          ctx.lineWidth = 1.0;
          ctx.arc(0, 0, node.radius * 2.0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Halo d'intensité central
          const coreGrad = ctx.createRadialGradient(
            node.px,
            node.py,
            0,
            node.px,
            node.py,
            node.radius * 2.5
          );
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.3, nodeColor);
          coreGrad.addColorStop(0.8, currentTheme.coreHaloStop);
          coreGrad.addColorStop(1, `rgba(${currentTheme.lineBase}, 0)`);

          ctx.beginPath();
          ctx.fillStyle = coreGrad;
          ctx.arc(node.px, node.py, node.radius * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Halo régulier du nœud
        const glowRadius = currentRadius * (idx === 0 ? 3 : 2.5);
        const nodeGlow = ctx.createRadialGradient(
          node.px,
          node.py,
          0,
          node.px,
          node.py,
          glowRadius
        );
        nodeGlow.addColorStop(0, nodeColor);
        nodeGlow.addColorStop(0.6, nodeGlowColor);
        nodeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.fillStyle = nodeGlow;
        ctx.arc(node.px, node.py, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Corps solide du nœud
        ctx.beginPath();
        ctx.fillStyle = idx === 0 ? '#ffffff' : nodeColor;
        ctx.arc(node.px, node.py, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Point focal intérieur
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(node.px, node.py, currentRadius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Micro-étiquettes techniques (sur grand écran uniquement)
        if (width >= 1024 && node.depth >= 0.7) {
          ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          ctx.fillStyle = currentTheme.labelColor;
          ctx.fillText(node.code, node.px + currentRadius + 8, node.py + 3);
        }
      });

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (prefersReducedMotion) {
      render(0);
    } else {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      {/* Canvas d'orchestration réseau */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full transition-opacity duration-700"
      />

      {/* Masque dégradé radial pour garantir une lisibilité absolue des textes en mode clair et sombre (Capture 1) */}
      <div className="pointer-events-none absolute inset-0 bg-radial-[ellipse_80%_60%_at_50%_35%] from-white/20 via-white/70 to-white/95 dark:from-slate-950/20 dark:via-slate-950/70 dark:to-slate-950" />

      {/* Dégradé doux en pied de section pour fondre le réseau dans la section suivante */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-slate-950 dark:via-slate-950/60 dark:to-transparent" />
    </div>
  );
}
