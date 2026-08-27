import { describe, expect, it } from 'vitest';
import { reseauxTools } from '../trades/reseaux';

describe('Outils Métiers — Réseaux & Télécoms (Protocole de Fiabilité)', () => {
  const getTool = (slug: string) => reseauxTools.find((t) => t.slug === slug)!;

  // 1. Calculateur IPv4
  describe('1. Calculateur IPv4 (ipv4)', () => {
    const tool = getTool('ipv4');

    it('Cas nominal : 192.168.1.50 /24 -> Réseau 192.168.1.0, Broadcast 192.168.1.255, 254 hôtes', () => {
      const res = tool.compute({ ipAddress: '192.168.1.50', cidr: 24 });
      expect(res.primaryResult).toBe('192.168.1.0 /24');
      const bcast = res.details.find((d) => d.label.includes('Broadcast'));
      expect(bcast?.value).toBe('192.168.1.255');
      const range = res.details.find((d) => d.label.includes('Plage'));
      expect(range?.value).toBe('192.168.1.1 → 192.168.1.254');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : lien P2P /30 (10.0.0.1 /30)', () => {
      const res = tool.compute({ ipAddress: '10.0.0.1', cidr: 30 });
      expect(res.primaryResult).toBe('10.0.0.0 /30');
      const range = res.details.find((d) => d.label.includes('Plage'));
      expect(range?.value).toBe('10.0.0.1 → 10.0.0.2');
    });

    it('Cas zéro : IP 0.0.0.0 /0', () => {
      const res = tool.compute({ ipAddress: '0.0.0.0', cidr: 0 });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toBe('0.0.0.0 /0');
    });

    it('Cas invalide : format IP erroné (non-IPv4 ou octet > 255)', () => {
      const res = tool.compute({ ipAddress: '999.999.999.999', cidr: 24 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('IP Invalide');
    });
  });

  // 2. Table CIDR
  describe('2. Table CIDR (cidr)', () => {
    const tool = getTool('cidr');

    it('Cas nominal : /26 = 255.255.255.192 (62 hôtes)', () => {
      const res = tool.compute({ selectedCidr: '26' });
      expect(res.primaryResult).toBe('255.255.255.192');
      const hosts = res.details.find((d) => d.label.includes('hôtes utiles'));
      expect(hosts?.value).toContain('62');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : /32 (hôte unique 255.255.255.255)', () => {
      const res = tool.compute({ selectedCidr: '32' });
      expect(res.primaryResult).toBe('255.255.255.255');
    });

    it('Cas zéro : /0 (route par défaut 0.0.0.0)', () => {
      const res = tool.compute({ selectedCidr: '0' });
      expect(res.primaryResult).toBe('0.0.0.0');
      expect(res.status).toBe('ok');
    });

    it('Cas invalide : préfixe non numérique', () => {
      const res = tool.compute({ selectedCidr: 'abc' });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toBe('255.255.255.0');
    });
  });

  // 3. Subnetting
  describe('3. Subnetting FLSM (subnetting)', () => {
    const tool = getTool('subnetting');

    it('Cas nominal : Découpage 10.0.0.0 /24 en 4 sous-réseaux = 4 sous-réseaux /26 (62 hôtes/chacun)', () => {
      const res = tool.compute({ parentIp: '10.0.0.0', parentCidr: 24, newSubnetsCount: '4' });
      expect(res.primaryResult).toBe('4 sous-réseaux /26');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : Découpage /28 en 4 sous-réseaux = /30 (2 hôtes)', () => {
      const res = tool.compute({ parentIp: '192.168.1.0', parentCidr: 28, newSubnetsCount: '4' });
      expect(res.primaryResult).toBe('4 sous-réseaux /30');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro / dépassement : découpage impossible d’un /30 en 4', () => {
      const res = tool.compute({ parentIp: '192.168.1.0', parentCidr: 30, newSubnetsCount: '4' });
      expect(res.status).toBe('danger');
      expect(res.primaryResult).toBe('Découpage impossible');
    });

    it('Cas invalide : IP parente corrompue', () => {
      const res = tool.compute({ parentIp: '10.0.0.abc', parentCidr: 24 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('IP Invalide');
    });
  });

  // 4. Plan d'adressage VLAN
  describe('4. Plan d’adressage VLAN (vlan)', () => {
    const tool = getTool('vlan');

    it('Cas nominal : VLAN 20 (VLAN_VOIP), réseau 10.20.0.0 /24 -> Passerelle 10.20.0.1', () => {
      const res = tool.compute({ vlanId: 20, vlanName: 'VLAN_VOIP', subnetIp: '10.20.0.0', cidr: 24 });
      expect(res.primaryResult).toBe('VLAN 20 — VLAN_VOIP');
      const gw = res.details.find((d) => d.label.includes('Passerelle'));
      expect(gw?.value).toBe('10.20.0.1');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : VLAN ID maximal 4094', () => {
      const res = tool.compute({ vlanId: 4094, vlanName: 'VLAN_TEST', subnetIp: '172.16.100.0', cidr: 24 });
      expect(res.primaryResult).toBe('VLAN 4094 — VLAN_TEST');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : VLAN ID 0 (hors norme IEEE 802.1Q)', () => {
      const res = tool.compute({ vlanId: 0, vlanName: 'VLAN_ZERO', subnetIp: '10.0.0.0' });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('VLAN Invalide');
    });

    it('Cas invalide : VLAN ID > 4094 (ex: 5000)', () => {
      const res = tool.compute({ vlanId: 5000, subnetIp: '10.0.0.0' });
      expect(res.status).toBe('warning');
    });
  });
});
