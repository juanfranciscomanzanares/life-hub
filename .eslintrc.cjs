/*
  Reglas mínimas, no un corrector de estilo.

  Lo que de verdad se busca aquí es `no-undef`: al partir LifeDashboard.jsx en
  secciones, un import que se quedara atrás NO rompe el build (Vite empaqueta
  tan contento una variable que no existe) y solo revienta al abrir esa sección
  en el navegador, quizá semanas después. Esta regla lo caza antes.

  Detrás va `react-hooks`, que avisa de dependencias mal puestas en useEffect:
  el tipo de fallo que aquí se traduce en datos que no se refrescan.

  El formato (comillas, punto y coma, longitud de línea) se deja fuera a
  propósito: no aporta y llenaría el CI de ruido.
*/
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "18.3" } },
  plugins: ["react", "react-hooks"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  rules: {
    // Con React 17+ no hace falta importar React para usar JSX.
    "react/react-in-jsx-scope": "off",
    // Este proyecto no usa PropTypes; los componentes son de un solo uso.
    "react/prop-types": "off",
    // Las comillas tipográficas y los apóstrofes van tal cual en el texto en
    // español: escaparlos haría los literales ilegibles.
    "react/no-unescaped-entities": "off",
    // Los `catch {}` vacíos de este código son deliberados y están comentados
    // (Safari en privado, hash mal formado...).
    "no-empty": ["error", { allowEmptyCatch: true }],
    /*
      Un import o una variable que sobra no rompe nada, pero es justo el rastro
      que deja un refactor a medias.

      `ignoreRestSiblings` es imprescindible aquí: el código usa a menudo
      `const { week, streak, ...resto } = habito` para QUITAR campos. Esos
      nombres tienen que coincidir con las claves que se descartan, así que no
      se pueden renombrar a _week; y no son un descuido, son la intención.
    */
    "no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
    ],
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.jsx"],
      env: { node: true },
      globals: { global: "readonly" },
    },
    {
      files: ["public/sw.js"],
      env: { serviceworker: true, browser: false },
    },
  ],
  ignorePatterns: ["dist/", "node_modules/", "automation/"],
};
