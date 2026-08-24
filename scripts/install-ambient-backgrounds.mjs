import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';
const targetDir = 'c:\\Users\\HBZ\\Documents\\ApplicationTech\\public\\images\\backgrounds';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 1. Hero Field ambient
fs.copyFileSync(
  path.join(brainDir, 'hero_field_bg_1787608598590.jpg'),
  path.join(targetDir, 'hero-field-ambient.jpg')
);

// 2. Cockpit Supervision ambient
fs.copyFileSync(
  path.join(brainDir, 'cockpit_supervision_bg_1787608616966.jpg'),
  path.join(targetDir, 'cockpit-supervision-ambient.jpg')
);

// 3. Industrial Inspection ambient
fs.copyFileSync(
  path.join(brainDir, 'field_inspection_bg_1787608636805.jpg'),
  path.join(targetDir, 'industrial-inspection-ambient.jpg')
);

// Remove the old foreground showcase images from public/images
const oldFiles = [
  'c:\\Users\\HBZ\\Documents\\ApplicationTech\\public\\images\\hero-telecom-field.jpg',
  'c:\\Users\\HBZ\\Documents\\ApplicationTech\\public\\images\\cockpit-supervisors.png',
  'c:\\Users\\HBZ\\Documents\\ApplicationTech\\public\\images\\field-inspection-team.jpg',
];

for (const f of oldFiles) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
  }
}

console.log('Successfully installed ambient design backgrounds and cleaned old card images!');
