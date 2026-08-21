const fs = require('fs');
const path = require('path');

let profilo = fs.readFileSync(path.join(__dirname, '../src/view/screens/ProfiloScreen.tsx'), 'utf8');
profilo = profilo.replace('import { PannelloCorso } from "@/view/components/PannelloCorso";\n', '');
profilo = profilo.replace(/<SectionTitle>Il tuo corso<\/SectionTitle>\s*<Card style=\{styles\.sezione\}>\s*<PannelloCorso \/>\s*<\/Card>/, '');
fs.writeFileSync(path.join(__dirname, '../src/view/screens/ProfiloScreen.tsx'), profilo);

