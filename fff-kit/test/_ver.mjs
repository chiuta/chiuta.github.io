// Versiunea curentă a kitului, citită din sursă (src/core.js) — testele nu mai păstrează o valoare scrisă de mână.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KIT_VERSION = /KIT_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(HERE, '..', 'src', 'core.js'), 'utf8'))[1];
export const KIT_VERSION_RX = KIT_VERSION.replace(/\./g, '\\.');
