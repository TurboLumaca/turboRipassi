const fs = require('fs');
const path = require('path');

let appT = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
appT = appT.replace('icona="utente"', 'icona="profilo"');
fs.writeFileSync(path.join(__dirname, '../App.tsx'), appT);

let profilo = fs.readFileSync(path.join(__dirname, '../src/view/screens/ProfiloScreen.tsx'), 'utf8');
profilo = profilo.replace('<View style={{ marginBottom: theme.spacing.lg }} />', '');
profilo = profilo.replace('<View style={{ marginBottom: theme.spacing.lg }}>\n        \n      </View>', '');
fs.writeFileSync(path.join(__dirname, '../src/view/screens/ProfiloScreen.tsx'), profilo);

let ripassi = fs.readFileSync(path.join(__dirname, '../src/view/screens/RipassiScreen.tsx'), 'utf8');
ripassi = ripassi.replace('ALTEZZA_TAB_BAR', '0');
fs.writeFileSync(path.join(__dirname, '../src/view/screens/RipassiScreen.tsx'), ripassi);

