const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/view/screens/RipassiScreen.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace('const gruppi = useMemo(() => raggruppaPerScadenza(listaDaMostrare), [listaDaMostrare]);', 
`const gruppi = useMemo(() => raggruppaPerScadenza(listaDaMostrare), [listaDaMostrare]);
  const inScadenza = useMemo(() => {
    return gruppi
      .filter((g) => g.gruppo === "ritardo" || g.gruppo === "oggi")
      .reduce((n, g) => n + g.voci.length, 0);
  }, [gruppi]);`);

content = content.replace(/gruppi\.inRitardo\.length \+ gruppi\.oggi\.length/g, 'inScadenza');
content = content.replace('import { ALTEZZA_TAB_BAR } from "@/view/components/TabBar";\n', '');
content = content.replace('RootStackParamList, "Principale"', 'RootStackParamList, "Ripassi"');
content = content.replace('marginBottom: theme.spacing.s', 'marginBottom: 10');
content = content.replace('marginTop: theme.spacing.m', 'marginTop: 20');

fs.writeFileSync(file, content);
console.log('RipassiScreen logic fixed');
