import { describe, expect, it, vi } from 'vitest';

import {
  LiveText,
  MAX_RECONNECTS,
  startLiveTranscript,
  type LiveStatus,
  type LiveTransport,
} from './live-transcript';

/*
  Ce qui est vérifié : le texte se reconstitue par tour de parole ; la piste
  micro et le canal d'événements sont branchés ; le jeton ne sert qu'à
  ouvrir ; une coupure se répare avec un nouveau jeton, un nombre borné de
  fois ; fermer ferme, sans reconnexion.
*/

class FauxCanal {
  onmessage: ((m: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  recoit(evenement: unknown) {
    this.onmessage?.({ data: JSON.stringify(evenement) } as MessageEvent<string>);
  }
}

class FauxPeer {
  pistes: MediaStreamTrack[] = [];
  canaux: FauxCanal[] = [];
  connectionState = 'new';
  onconnectionstatechange: (() => void) | null = null;
  ferme = false;
  local: unknown;
  distant: unknown;
  addTrack(t: MediaStreamTrack) {
    this.pistes.push(t);
  }
  createDataChannel(nom: string) {
    expect(nom).toBe('oai-events');
    const c = new FauxCanal();
    this.canaux.push(c);
    return c as unknown as RTCDataChannel;
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'v=0 offre' });
  }
  setLocalDescription(d: unknown) {
    this.local = d;
    return Promise.resolve();
  }
  setRemoteDescription(d: unknown) {
    this.distant = d;
    return Promise.resolve();
  }
  close() {
    this.ferme = true;
  }
}

function fabriquer(exchange?: LiveTransport['exchangeSdp']) {
  const peers: FauxPeer[] = [];
  const jetons: string[] = [];
  const echanges: Array<[string, string]> = [];
  const transport: LiveTransport = {
    createPeerConnection: () => {
      const p = new FauxPeer();
      peers.push(p);
      return p as unknown as RTCPeerConnection;
    },
    exchangeSdp:
      exchange ??
      ((sdp, token) => {
        echanges.push([sdp, token]);
        return Promise.resolve('v=0 reponse');
      }),
  };
  let n = 0;
  const getToken = vi.fn(() => {
    n += 1;
    const token = `ek_${String(n)}`;
    jetons.push(token);
    return Promise.resolve({ token, expiresAt: 0, model: 'gpt-live-transcribe' });
  });
  const statuts: LiveStatus[] = [];
  const textes: string[] = [];
  const track = { kind: 'audio' } as MediaStreamTrack;
  return {
    peers,
    jetons,
    echanges,
    transport,
    getToken,
    statuts,
    textes,
    track,
    events: {
      onStatus: (s: LiveStatus) => statuts.push(s),
      onText: (t: string) => textes.push(t),
    },
  };
}

describe('LiveText', () => {
  it('reconstitue le texte par tour : deltas accumulés, completed qui remplace', () => {
    const t = new LiveText();
    t.applique({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'a',
      delta: 'La ',
    });
    t.applique({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'a',
      delta: 'pto',
    });
    expect(t.text).toBe('La pto');
    t.applique({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'b',
      delta: 'Karim',
    });
    expect(t.text).toBe('La pto\nKarim');
    t.applique({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'a',
      transcript: 'La PTO est posée.',
    });
    expect(t.turns).toEqual(['La PTO est posée.', 'Karim']);
    expect(
      t.applique({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'b',
        transcript: 'Karim repasse.',
      }),
    ).toBe('completed');
    expect(t.applique({ type: 'session.created' })).toBe(false);
    expect(t.applique({ type: 'conversation.item.input_audio_transcription.delta' })).toBe(false);
  });
});

describe('startLiveTranscript', () => {
  it('branche la piste, ouvre le canal, échange le SDP avec le jeton, publie le texte', async () => {
    const f = fabriquer();
    const session = await startLiveTranscript({
      track: f.track,
      getToken: f.getToken,
      events: f.events,
      transport: f.transport,
    });
    const peer = f.peers[0]!;
    expect(peer.pistes).toEqual([f.track]);
    expect(f.echanges).toEqual([['v=0 offre', 'ek_1']]);
    expect(peer.distant).toEqual({ type: 'answer', sdp: 'v=0 reponse' });
    expect(f.statuts).toEqual(['connecting']);
    peer.canaux[0]!.onopen?.();
    expect(f.statuts).toEqual(['connecting', 'on']);
    peer.canaux[0]!.recoit({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'x',
      delta: 'Bonjour',
    });
    peer.canaux[0]!.recoit({ type: 'input_audio_buffer.speech_started' });
    expect(f.textes).toEqual(['Bonjour']);
    session.close();
    expect(peer.ferme).toBe(true);
    expect(f.statuts.at(-1)).toBe('closed');
  });

  it('une coupure se répare avec un nouveau jeton, un nombre borné de fois, puis « interrompu »', async () => {
    const f = fabriquer();
    await startLiveTranscript({
      track: f.track,
      getToken: f.getToken,
      events: f.events,
      transport: f.transport,
    });
    for (let i = 0; i < MAX_RECONNECTS; i += 1) {
      f.peers.at(-1)!.canaux[0]!.onclose?.();
      await vi.waitFor(() => expect(f.peers).toHaveLength(i + 2));
    }
    expect(f.jetons).toHaveLength(MAX_RECONNECTS + 1);
    expect(new Set(f.jetons).size).toBe(MAX_RECONNECTS + 1);
    f.peers.at(-1)!.canaux[0]!.onclose?.();
    expect(f.statuts.at(-1)).toBe('interrupted');
    expect(f.peers).toHaveLength(MAX_RECONNECTS + 1);
  });

  it('fermer ne déclenche aucune reconnexion ; un échange refusé au départ remonte l’erreur', async () => {
    const f = fabriquer();
    const session = await startLiveTranscript({
      track: f.track,
      getToken: f.getToken,
      events: f.events,
      transport: f.transport,
    });
    session.close();
    f.peers[0]!.canaux[0]!.onclose?.();
    f.peers[0]!.connectionState = 'failed';
    f.peers[0]!.onconnectionstatechange?.();
    expect(f.peers).toHaveLength(1);
    expect(f.getToken).toHaveBeenCalledTimes(1);

    const g = fabriquer(() => Promise.reject(new Error('Échange SDP refusé (401).')));
    await expect(
      startLiveTranscript({
        track: g.track,
        getToken: g.getToken,
        events: g.events,
        transport: g.transport,
      }),
    ).rejects.toThrow(/SDP/);
  });
});
