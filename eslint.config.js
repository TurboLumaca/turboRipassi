/**
 * ESLint — Expo's own rules, plus the architectural boundaries of the project.
 *
 * The Model/Controller/View separation used to live only in prose ("no View
 * imports the Supabase client or a repository"), and it had already been
 * violated once and repaired by hand. Everything below turns those sentences
 * into something that fails a build.
 *
 * The layers, and what each is allowed to reach for:
 *   config      infrastructure (Supabase client, Sentry, SecureStore, env).
 *               Imports nothing from the app; everyone may import it.
 *   model       domain, repositories, cache, Drive. May import config.
 *   controller  React hooks: state and orchestration. May import model+config.
 *   view        components and screens. May import controller, config, and
 *               from the model only types and pure functions — never a
 *               repository, the Supabase client or the Drive client.
 */
const expoConfig = require("eslint-config-expo/flat");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

/** Import paths the View must go through the Controller for. */
const VIETATI_ALLA_VIEW = [
  {
    group: ["@/config/supabase", "**/config/supabase"],
    message:
      "La View non accede ai dati: passa da un hook del Controller (regola di architettura, sezione 4 della spec).",
  },
  {
    group: ["@/model/*/*Repo", "**/model/*/*Repo"],
    message:
      "La View non importa un repository del Model: passa da un hook del Controller.",
  },
  {
    group: ["@/model/cache/localCache", "@/model/drive/*", "**/model/drive/*"],
    message:
      "Cache e client Drive sono I/O del Model: la View li raggiunge tramite il Controller.",
  },
];

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "ios/**",
      "android/**",
      ".expo/**",
      "dist/**",
      "web-build/**",
      "docs/**",
    ],
  },
  ...expoConfig,
  {
    // The config files themselves run under Node, not in the app bundle.
    files: ["*.js"],
    languageOptions: { globals: { __dirname: "readonly", module: "writable", require: "readonly" } },
  },
  {
    // tsc already reports these with --noUnusedLocals, and its analysis of
    // type-only usage is the accurate one.
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    // Module mocks have to be registered before the module under test is
    // imported, so a test that mocks anything cannot keep all its imports at
    // the top, and reaching for the module afterwards means require().
    files: ["src/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "import/first": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["src/view/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: VIETATI_ALLA_VIEW }],
    },
  },
  {
    /**
     * The View starts writes it does not own: every one of them returns a
     * promise that the Controller can reject. Two of those promises used to be
     * fired and forgotten, so a failed write reached neither the user nor
     * Sentry — the one thing the error policy of this project says must never
     * happen. Prose did not prevent it; this rule does.
     *
     * Type-aware, so it needs the project's type information: that is what
     * `projectService` provides, and why this block carries its own parser.
     */
    files: ["src/view/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["src/model/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/view/*", "@/controller/*", "**/view/*", "**/controller/*"],
              message:
                "Il Model non conosce la UI né gli hook: le dipendenze puntano solo verso il basso.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/controller/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/view/*", "**/view/*"],
              message:
                "Il Controller non importa la View: espone stato e azioni, la View li consuma.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/config/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/model/*", "@/controller/*", "@/view/*"],
              message:
                "config è il livello trasversale di infrastruttura: non deve dipendere dai livelli applicativi (una dipendenza da model qui aveva già creato un ciclo).",
            },
          ],
        },
      ],
    },
  },
];
