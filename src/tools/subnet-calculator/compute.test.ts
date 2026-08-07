import { describe, expect, it } from 'vitest';
import { computeSubnet } from './compute';

describe('computeSubnet', () => {
  it('calcule correctement un sous-réseau /24', () => {
    const result = computeSubnet({ ipAddress: '192.168.1.50', cidr: 24 });

    expect(result.netmask).toBe('255.255.255.0');
    expect(result.networkAddress).toBe('192.168.1.0');
    expect(result.broadcastAddress).toBe('192.168.1.255');
    expect(result.firstUsableIp).toBe('192.168.1.1');
    expect(result.lastUsableIp).toBe('192.168.1.254');
    expect(result.usableHosts).toBe(254);
    expect(result.wildcardMask).toBe('0.0.0.255');
  });

  it('calcule correctement un sous-réseau /26', () => {
    const result = computeSubnet({ ipAddress: '10.0.0.100', cidr: 26 });

    expect(result.netmask).toBe('255.255.255.192');
    expect(result.networkAddress).toBe('10.0.0.64');
    expect(result.broadcastAddress).toBe('10.0.0.127');
    expect(result.usableHosts).toBe(62);
  });
});
