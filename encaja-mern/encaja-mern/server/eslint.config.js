// Análisis estático de seguridad (SAST) para la API de Encaja.
// Detecta patrones peligrosos en el código Node/Express SIN ejecutarlo:
// eval(), regex inseguras, child_process, require dinámico, etc.
const security = require('eslint-plugin-security');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**'] },

  // Reglas de seguridad recomendadas.
  security.configs.recommended,

  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs' },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      // --- Alto impacto: ESTAS SÍ rompen el pipeline ---
      'security/detect-eval-with-expression': 'error',
      'security/detect-child-process': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-no-csrf-before-method-override': 'error',

      // --- Ruidosas (falsos positivos): quedan como advertencia ---
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
    },
  },
];