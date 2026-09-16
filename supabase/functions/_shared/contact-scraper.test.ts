import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  extractContacts,
  isAllowedByRobotsTxt,
  isFetchableWebsiteUrl,
  isPrivateIpv4,
  isPrivateIpv6,
} from './contact-scraper.ts';

Deno.test('isFetchableWebsiteUrl — accepte http(s) public, rejette le reste', () => {
  assertEquals(isFetchableWebsiteUrl('https://plomberie-antilles.fr'), true);
  assertEquals(isFetchableWebsiteUrl('http://plomberie-antilles.fr/contact'), true);
  assertEquals(isFetchableWebsiteUrl('ftp://plomberie-antilles.fr'), false);
  assertEquals(isFetchableWebsiteUrl('pas une url'), false);
  assertEquals(isFetchableWebsiteUrl('https://localhost:5173'), false);
  assertEquals(isFetchableWebsiteUrl('https://machine.local'), false);
});

Deno.test('isFetchableWebsiteUrl — refuse les IP privées écrites directement (protection SSRF)', () => {
  assertEquals(isFetchableWebsiteUrl('http://127.0.0.1'), false);
  assertEquals(isFetchableWebsiteUrl('http://10.0.5.2'), false);
  assertEquals(isFetchableWebsiteUrl('http://192.168.1.1'), false);
  assertEquals(isFetchableWebsiteUrl('http://169.254.169.254'), false); // métadonnées cloud
  assertEquals(isFetchableWebsiteUrl('http://8.8.8.8'), true);
});

Deno.test('isPrivateIpv4 / isPrivateIpv6', () => {
  assertEquals(isPrivateIpv4('172.16.0.1'), true);
  assertEquals(isPrivateIpv4('172.32.0.1'), false);
  assertEquals(isPrivateIpv6('::1'), true);
  assertEquals(isPrivateIpv6('fe80::1'), true);
  assertEquals(isPrivateIpv6('2001:4860:4860::8888'), false);
});

Deno.test('isAllowedByRobotsTxt — autorise par défaut sans règle applicable', () => {
  assertEquals(isAllowedByRobotsTxt('', '/contact'), true);
  assertEquals(isAllowedByRobotsTxt('User-agent: Googlebot\nDisallow: /contact', '/contact'), true);
});

Deno.test('isAllowedByRobotsTxt — respecte Disallow du groupe *', () => {
  const robots = 'User-agent: *\nDisallow: /admin\nDisallow: /contact';
  assertEquals(isAllowedByRobotsTxt(robots, '/contact'), false);
  assertEquals(isAllowedByRobotsTxt(robots, '/'), true);
});

Deno.test('isAllowedByRobotsTxt — Allow plus spécifique l’emporte sur un Disallow plus court', () => {
  const robots = 'User-agent: *\nDisallow: /\nAllow: /contact';
  assertEquals(isAllowedByRobotsTxt(robots, '/contact'), true);
  assertEquals(isAllowedByRobotsTxt(robots, '/autre-page'), false);
});

Deno.test('extractContacts — privilégie les mailto:, filtre les domaines de tracking', () => {
  const html = `
    <a href="mailto:contact@plomberie-antilles.fr">Nous écrire</a>
    <img src="tracker@sentry.io/pixel.png" />
    <script>var x = "noreply@example.com";</script>
  `;
  const { emails } = extractContacts(html);
  assertEquals(emails, ['contact@plomberie-antilles.fr']);
});

Deno.test('extractContacts — trouve un numéro français au format courant', () => {
  const html = '<p>Nous joindre au 05 96 12 34 56 ou au +33 6 96 00 00 00</p>';
  const { phones } = extractContacts(html);
  assertEquals(phones.length, 2);
});

Deno.test('extractContacts — plafonne à 2 par type (minimisation)', () => {
  const html = `
    <a href="mailto:a@entreprise.fr">a</a>
    <a href="mailto:b@entreprise.fr">b</a>
    <a href="mailto:c@entreprise.fr">c</a>
  `;
  const { emails } = extractContacts(html);
  assertEquals(emails.length, 2);
});

Deno.test('extractContacts — aucune coordonnée trouvée renvoie des tableaux vides, jamais une erreur', () => {
  const result = extractContacts('<p>Bienvenue sur notre site.</p>');
  assertEquals(result, { emails: [], phones: [] });
});
