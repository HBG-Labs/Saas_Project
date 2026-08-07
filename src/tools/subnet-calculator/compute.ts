import type { SubnetCalculatorInputs } from './schema';

export interface SubnetResult {
  ipAddress: string;
  cidr: number;
  netmask: string;
  wildcardMask: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableIp: string;
  lastUsableIp: string;
  totalHosts: number;
  usableHosts: number;
  binaryNetmask: string;
  isValidIp: boolean;
}

function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

export function computeSubnet(inputs: SubnetCalculatorInputs): SubnetResult {
  const { ipAddress, cidr } = inputs;
  
  // Masque en binaire (ex: CIDR 24 => 0xFFFFFF00)
  const maskInt = (0xffffffff << (32 - cidr)) >>> 0;
  const wildcardInt = (~maskInt) >>> 0;
  
  const ipInt = ipToInt(ipAddress);
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const totalHosts = Math.pow(2, 32 - cidr);
  const usableHosts = totalHosts > 2 ? totalHosts - 2 : 0;

  const firstUsableInt = usableHosts > 0 ? networkInt + 1 : networkInt;
  const lastUsableInt = usableHosts > 0 ? broadcastInt - 1 : broadcastInt;

  const netmask = intToIp(maskInt);
  const wildcardMask = intToIp(wildcardInt);
  const networkAddress = intToIp(networkInt);
  const broadcastAddress = intToIp(broadcastInt);
  const firstUsableIp = intToIp(firstUsableInt);
  const lastUsableIp = intToIp(lastUsableInt);

  // Masque format binaire octet par octet (ex: 11111111.11111111.11111111.00000000)
  const binaryNetmask = netmask
    .split('.')
    .map((octet) => parseInt(octet, 10).toString(2).padStart(8, '0'))
    .join('.');

  return {
    ipAddress,
    cidr,
    netmask,
    wildcardMask,
    networkAddress,
    broadcastAddress,
    firstUsableIp,
    lastUsableIp,
    totalHosts,
    usableHosts,
    binaryNetmask,
    isValidIp: true,
  };
}
