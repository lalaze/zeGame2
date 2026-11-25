import { writeFileSync } from 'node:fs';
import { rulesData } from './rules';
writeFileSync(process.argv[2], `${JSON.stringify(rulesData(), null, 1)}\n`);
