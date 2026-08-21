const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/view/screens/RipassiScreen.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { useMicroSessione }')) {
  content = content.replace('import {', 'import { useMicroSessione } from "@/controller/ripassi/useMicroSessione";\nimport { MicroSessioneModal } from "@/view/components/MicroSessioneModal";\nimport {');
}

if (!content.includes('const microSessione = useMicroSessione();')) {
  content = content.replace('const [aggiornando, setAggiornando] = useState(false);', 'const [aggiornando, setAggiornando] = useState(false);\n  const microSessione = useMicroSessione();');
}

const microSessioneJSX = `
        <Scheda style={styles.cardMicroSessione}>
          <View style={styles.testataCard}>
            <Kicker colore={theme.colors.accent}>Pausa rapida · 60s</Kicker>
          </View>
          <Titolo size={20}>
            {gruppi.inRitardo.length + gruppi.oggi.length > 0
              ? \`\${Math.min(gruppi.inRitardo.length + gruppi.oggi.length, 2)} concetti pronti per te\`
              : "Tutto in ordine per oggi"}
          </Titolo>
          <Testo muto>
            {gruppi.inRitardo.length + gruppi.oggi.length > 0
              ? "Bastano 60 secondi per consolidare i punti critici di oggi."
              : "Nessuna scadenza urgente. Vuoi ripassare 1 concetto a caso?"}
          </Testo>
          <Pillola
            label={gruppi.inRitardo.length + gruppi.oggi.length > 0 ? "Avvia (1 min)" : "Avvia ripasso libero"}
            onPress={() => microSessione.avvia(gruppi.inRitardo.length + gruppi.oggi.length > 0 ? 2 : 1)}
            icona="fulmine"
            style={styles.bottoneMicroSessione}
          />
        </Scheda>
`;

if (!content.includes('cardMicroSessione')) {
  content = content.replace('/>\n\n        {/* Two ways', `/>\n\n${microSessioneJSX}\n\n        {/* Two ways`);
}

if (!content.includes('<MicroSessioneModal')) {
  content = content.replace('</ScrollView>', '</ScrollView>\n      <MicroSessioneModal sessione={microSessione} />');
}

if (!content.includes('cardMicroSessione:')) {
  content = content.replace('avviso: {', 'cardMicroSessione: { gap: theme.spacing.xs, backgroundColor: theme.colors.surface, marginTop: theme.spacing.m, marginBottom: theme.spacing.s },\n  bottoneMicroSessione: { marginTop: theme.spacing.xs },\n  testataCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },\n  avviso: {');
  // Need to import Scheda, Kicker, Titolo if not imported? They are probably imported.
}

// Add header button to Profilo
// RipassiScreen needs useNavigation for 'Profilo' maybe. It already has useNavigation.
// But it's in a stack now. We can set it in App.tsx instead or in useLayoutEffect in RipassiScreen.

fs.writeFileSync(file, content);
console.log('RipassiScreen updated');
