import { useEffect, useRef } from 'react';

const TOTAL_FRAMES = 240;

function getFrameUrl(index: number): string {
  const paddedIndex = String(index + 1).padStart(3, '0');
  return `/scroll-bg/ezgif-frame-${paddedIndex}.jpg`;
}

export function ScrollCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const targetFrameRef = useRef<number>(0);
  const currentFrameRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let isSubscribed = true;

    // 1. Initialiser le tableau d'images
    const images: HTMLImageElement[] = [];
    imagesRef.current = images;

    // Rendu d'une image sur le canvas avec taille réduite & dégradé doux sur le bord gauche
    const renderFrame = (img: HTMLImageElement) => {
      if (!ctx || !canvas) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;

      const targetWidth = Math.round(displayWidth * dpr);
      const targetHeight = Math.round(displayHeight * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fond sombre uniforme
      ctx.fillStyle = '#020808';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const iw = img.naturalWidth || 1920;
      const ih = img.naturalHeight || 1080;

      const isMobile = displayWidth < 768;
      const isTablet = displayWidth >= 768 && displayWidth < 1024;

      let scale: number;
      let horizontalFactor: number;
      let verticalFactor: number;

      const frameProgress = currentFrameRef.current / (TOTAL_FRAMES - 1 || 1);
      const shiftProgress = Math.max(0, Math.min(1, (frameProgress - 0.35) / 0.65));

      if (isMobile) {
        // En mode mobile (portrait), on dimensionne pour que le technicien soit visible et bien net
        const mobileScale = Math.min((targetHeight * 0.70) / ih, (targetWidth * 1.35) / iw);
        scale = Math.min(mobileScale, 0.80 * dpr);
        horizontalFactor = 0.5; // Centré horizontalement en arrière-plan
        verticalFactor = 0.30;  // Positionnement vertical optimal
      } else if (isTablet) {
        // Mode tablette
        const baseScale = Math.min(targetWidth / iw, targetHeight / ih);
        scale = Math.min(baseScale * 0.60, 0.70 * dpr);
        horizontalFactor = 0.62 - (shiftProgress * 0.40);
        verticalFactor = 0.34;
      } else {
        // Mode Desktop / Grands écrans
        const baseScale = Math.min(targetWidth / iw, targetHeight / ih);
        scale = Math.min(baseScale * 0.58, 0.68 * dpr);
        horizontalFactor = 0.68 - (shiftProgress * 0.56);
        verticalFactor = 0.36;
      }

      const nw = Math.round(iw * scale);
      const nh = Math.round(ih * scale);

      const nx = Math.round((targetWidth - nw) * horizontalFactor);
      const ny = Math.round((targetHeight - nh) * verticalFactor);

      // Dessiner l'image
      ctx.drawImage(img, nx, ny, nw, nh);

      // ----------------------------------------------------
      // DÉGRADÉS DE FONDU SOYEUX SUR TOUS LES BORDS
      // ----------------------------------------------------
      const fadeWidth = Math.round(nw * (isMobile ? 0.2 : 0.3));

      // Fondu bord gauche
      const leftGrad = ctx.createLinearGradient(nx, 0, nx + fadeWidth, 0);
      leftGrad.addColorStop(0, '#020808');
      leftGrad.addColorStop(1, 'rgba(2, 8, 8, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(nx, ny, fadeWidth, nh);

      // Fondu bord droit
      const rightGrad = ctx.createLinearGradient(nx + nw - fadeWidth, 0, nx + nw, 0);
      rightGrad.addColorStop(0, 'rgba(2, 8, 8, 0)');
      rightGrad.addColorStop(1, '#020808');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(nx + nw - fadeWidth, ny, fadeWidth, nh);

      // Fondu bord supérieur
      const fadeVHeight = Math.round(nh * 0.15);
      const topGrad = ctx.createLinearGradient(0, ny, 0, ny + fadeVHeight);
      topGrad.addColorStop(0, '#020808');
      topGrad.addColorStop(1, 'rgba(2, 8, 8, 0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(nx, ny, nw, fadeVHeight);

      // Fondu bord inférieur
      const bottomGrad = ctx.createLinearGradient(0, ny + nh - fadeVHeight, 0, ny + nh);
      bottomGrad.addColorStop(0, 'rgba(2, 8, 8, 0)');
      bottomGrad.addColorStop(1, '#020808');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(nx, ny + nh - fadeVHeight, nw, fadeVHeight);
    };

    // Charger immédiatement la 1ère frame
    const firstImg = new Image();
    firstImg.src = getFrameUrl(0);
    const onFirstLoad = () => {
      if (isSubscribed) {
        renderFrame(firstImg);
      }
    };
    firstImg.onload = onFirstLoad;
    if (firstImg.complete) {
      onFirstLoad();
    }
    images[0] = firstImg;

    // Précharger toutes les frames en arrière-plan
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      images[i] = img;
    }

    // 2. Calcul du défilement
    const updateScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const maxScroll = docHeight - winHeight;

      if (maxScroll <= 0) {
        targetFrameRef.current = 0;
        return;
      }

      const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      targetFrameRef.current = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.floor(progress * (TOTAL_FRAMES - 1)))
      );
    };

    // 3. Boucle d'animation fluide 60fps / 120fps avec lerp
    let lastDrawnFrame = -1;
    const animate = () => {
      const diff = targetFrameRef.current - currentFrameRef.current;
      currentFrameRef.current += diff * 0.15;

      const frameIndex = Math.round(currentFrameRef.current);
      const clampedIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, frameIndex));

      if (clampedIndex !== lastDrawnFrame) {
        const img = images[clampedIndex];
        if (img && img.complete && (img.naturalWidth || 0) > 0) {
          renderFrame(img);
          lastDrawnFrame = clampedIndex;
        } else {
          // Fallback sur la frame chargée la plus proche
          for (let offset = 1; offset < 20; offset++) {
            const prev = images[clampedIndex - offset];
            if (prev && prev.complete && (prev.naturalWidth || 0) > 0) {
              renderFrame(prev);
              break;
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      lastDrawnFrame = -1; // Forcer le rafraîchissement immédiat de la frame
      updateScroll();
    };

    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    updateScroll();
    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      isSubscribed = false;
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#020808]"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
