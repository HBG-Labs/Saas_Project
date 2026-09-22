/*
  Le direct : le texte pendant la parole (STT phase 14).

  Le téléphone ouvre une connexion WebRTC vers OpenAI Realtime avec un jeton
  éphémère délivré par le serveur (la clé OpenAI ne vient jamais ici), y
  branche la piste micro — la même que `MediaRecorder` — et reçoit sur le
  canal `oai-events` les morceaux de texte au fil des mots. C'est un
  BROUILLON : il s'affiche, il est gardé sur l'appareil avec l'audio, il
  n'entre jamais dans la page. La finale, après l'arrêt, fait la qualité.

  Tout ce qui touche au navigateur (RTCPeerConnection, fetch de l'échange
  SDP) est injecté : ce fichier se teste sans réseau. Une coupure se répare
  seule avec un nouveau jeton, un nombre borné de fois ; passé ça, le direct
  se déclare interrompu et la capture continue comme si de rien n'était.
*/

export interface LiveToken {
  token: string;
  /** Secondes depuis l'époque. */
  expiresAt: number;
  model: string;
}

export type LiveStatus = 'connecting' | 'on' | 'interrupted' | 'closed';

/** Ce qu'une session reçoit d'OpenAI et qu'elle doit rendre. */
export interface LiveEvents {
  onStatus: (status: LiveStatus) => void;
  /** Le texte courant, reconstitué : tours terminés puis tour en cours. `settled` : un tour vient de se terminer. */
  onText: (text: string, turns: string[], settled: boolean) => void;
}

/** Ce que le navigateur fournit — injecté. */
export interface LiveTransport {
  createPeerConnection: () => RTCPeerConnection;
  /** L'échange SDP : rend le SDP de réponse d'OpenAI. */
  exchangeSdp: (offerSdp: string, token: string) => Promise<string>;
}

export interface LiveSession {
  close(): void;
}

export const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
export const MAX_RECONNECTS = 3;
export const LIVE_TEXT_MAX_CHARS = 200_000;

export const defaultLiveTransport: LiveTransport = {
  createPeerConnection: () => new RTCPeerConnection(),
  exchangeSdp: async (offerSdp, token) => {
    const response = await fetch(OPENAI_CALLS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/sdp' },
      body: offerSdp,
    });
    if (!response.ok) throw new Error(`Échange SDP refusé (${String(response.status)}).`);
    return response.text();
  },
};

interface EvenementOpenAi {
  type?: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
}

/**
 * Le texte se reconstitue par tour de parole (`item_id`) : les deltas
 * s'accumulent, le `completed` remplace l'accumulation par la version
 * finale du tour. L'ordre des tours est celui de leur première apparition.
 */
export class LiveText {
  private readonly ordre: string[] = [];
  private readonly tours = new Map<string, string>();

  /** `delta` : un mot de plus ; `completed` : un tour terminé ; `false` : rien pour nous. */
  applique(evenement: EvenementOpenAi): 'delta' | 'completed' | false {
    const id = evenement.item_id;
    if (!id) return false;
    if (evenement.type === 'conversation.item.input_audio_transcription.delta') {
      if (!this.tours.has(id)) this.ordre.push(id);
      this.tours.set(id, (this.tours.get(id) ?? '') + (evenement.delta ?? ''));
      return 'delta';
    }
    if (evenement.type === 'conversation.item.input_audio_transcription.completed') {
      if (!this.tours.has(id)) this.ordre.push(id);
      this.tours.set(id, (evenement.transcript ?? '').trim());
      return 'completed';
    }
    return false;
  }

  get turns(): string[] {
    return this.ordre.map((id) => this.tours.get(id) ?? '').filter((t) => t.length > 0);
  }

  get text(): string {
    return this.turns.join('\n').slice(0, LIVE_TEXT_MAX_CHARS);
  }
}

/**
 * Ouvre le direct sur une piste micro. `getToken` est rappelé à chaque
 * (re)connexion : un jeton ne sert qu'à ouvrir.
 */
export async function startLiveTranscript(params: {
  track: MediaStreamTrack;
  getToken: () => Promise<LiveToken>;
  events: LiveEvents;
  transport?: LiveTransport;
  texte?: LiveText;
}): Promise<LiveSession> {
  const transport = params.transport ?? defaultLiveTransport;
  const texte = params.texte ?? new LiveText();
  let pc: RTCPeerConnection | null = null;
  let ferme = false;
  let reconnexions = 0;

  const publier = (settled: boolean) => params.events.onText(texte.text, texte.turns, settled);

  const ouvrir = async (): Promise<void> => {
    if (ferme) return;
    params.events.onStatus('connecting');
    const jeton = await params.getToken();
    const connexion = transport.createPeerConnection();
    pc = connexion;
    connexion.addTrack(params.track);
    const canal = connexion.createDataChannel('oai-events');
    canal.onmessage = (message: MessageEvent<string>) => {
      let evenement: EvenementOpenAi;
      try {
        evenement = JSON.parse(message.data) as EvenementOpenAi;
      } catch {
        return;
      }
      const resultat = texte.applique(evenement);
      if (resultat) publier(resultat === 'completed');
    };
    canal.onopen = () => {
      if (!ferme) params.events.onStatus('on');
    };
    const surCoupure = () => {
      if (ferme || pc !== connexion) return;
      if (reconnexions < MAX_RECONNECTS) {
        reconnexions += 1;
        void ouvrir().catch(() => params.events.onStatus('interrupted'));
      } else {
        params.events.onStatus('interrupted');
      }
    };
    canal.onclose = surCoupure;
    connexion.onconnectionstatechange = () => {
      if (connexion.connectionState === 'failed' || connexion.connectionState === 'disconnected')
        surCoupure();
    };
    const offre = await connexion.createOffer();
    await connexion.setLocalDescription(offre);
    const reponse = await transport.exchangeSdp(offre.sdp ?? '', jeton.token);
    if (ferme) return;
    await connexion.setRemoteDescription({ type: 'answer', sdp: reponse });
  };

  await ouvrir();

  return {
    close: () => {
      ferme = true;
      pc?.close();
      pc = null;
      params.events.onStatus('closed');
    },
  };
}
