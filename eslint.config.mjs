import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────
// SUSEP Compliance Plugin (SPEC-07 ADR-03)
// Plugin inline para detectar termos proibidos pela SUSEP
// no código-fonte (Air-Gap Semântico)
// ─────────────────────────────────────────────────────────

const PROHIBITED_TERMS = [
  { pattern: /nosso\s+seguro/gi, message: 'Termo proibido "nosso seguro" detectado. Use "proteção" ou "benefício".' },
  { pattern: /n[oó]s\s+garantimos/gi, message: 'Termo proibido "nós garantimos" detectado. A garantia é da Seguradora Parceira.' },
  { pattern: /compre\s+nosso\s+seguro/gi, message: 'Termo proibido "compre nosso seguro" detectado.' },
  { pattern: /corretora/gi, message: 'Termo "corretora" detectado. Saúde & Proteção atua como Estipulante.' },
  { pattern: /n[oó]s\s+pagamos/gi, message: 'Termo proibido "nós pagamos" detectado. O pagamento é da Seguradora.' },
  { pattern: /seguro\s+granpaz/gi, message: 'Expressão "seguro Granpaz" detectada. Use "plano Granpaz".' },
]

const EXCLUDED_PATHS = ['compliance-footer', 'ComplianceBanner', 'compliance/', 'lgpd', 'susep-compliance', 'copy.json', 'eslint.config']

const susepPlugin = {
  rules: {
    'no-prohibited-terms': {
      meta: {
        type: 'problem',
        docs: { description: 'Detecta termos proibidos pela SUSEP (Air-Gap Semântico)' },
        messages: { susepViolation: 'SUSEP_VIOLATION: {{ message }}' },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename()
        if (EXCLUDED_PATHS.some(ex => filename.includes(ex))) return {}
        return {
          Literal(node) {
            if (typeof node.value !== 'string') return
            for (const { pattern, message } of PROHIBITED_TERMS) {
              pattern.lastIndex = 0
              if (pattern.test(node.value)) {
                context.report({ node, messageId: 'susepViolation', data: { message } })
              }
            }
          },
          JSXText(node) {
            const text = node.value || ''
            for (const { pattern, message } of PROHIBITED_TERMS) {
              pattern.lastIndex = 0
              if (pattern.test(text)) {
                context.report({ node, messageId: 'susepViolation', data: { message } })
              }
            }
          },
        }
      },
    },
  },
}

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  plugins: { 'susep': susepPlugin },
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // SUSEP Compliance (SPEC-07 ADR-03)
    "susep/no-prohibited-terms": "error",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "eslint-rules/**"]
}];

export default eslintConfig;
