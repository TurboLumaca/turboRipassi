const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/view/screens/RipassiScreen.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace('Tendina,\n  Testo,\n  Vuoto,', 'Tendina,\n  Testo,\n  Vuoto,\n  Scheda,\n  Titolo,');

fs.writeFileSync(file, content);
console.log('Imports fixed');
