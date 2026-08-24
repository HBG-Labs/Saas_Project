import fs from 'fs';
import path from 'path';

const userUploadedDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f\\.user_uploaded';
const targetDir = 'c:\\Users\\HBZ\\Documents\\ApplicationTech\\public\\images';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 1. Telecom technician on field
fs.copyFileSync(
  path.join(userUploadedDir, 'media_1787608209935.jpg'),
  path.join(targetDir, 'hero-telecom-field.jpg')
);

// 2. Industrial / Technical supervisors with cockpit screen
fs.copyFileSync(
  path.join(userUploadedDir, 'media_1787608191987.png'),
  path.join(targetDir, 'cockpit-supervisors.png')
);

// 3. Technical inspection duo
fs.copyFileSync(
  path.join(userUploadedDir, 'media_1787608169749.jpg'),
  path.join(targetDir, 'field-inspection-team.jpg')
);

console.log('Successfully copied all 3 landing page showcase photos to public/images!');
