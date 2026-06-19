/**
 * eslint-plugin-susep: Custom rule for SUSEP compliance (SPEC-07 ADR-03)
 * Detecta termos proibidos no código-fonte que poderiam caracterizar corretagem direta
 * ou enganar consumidores sobre o papel do Estipulante.
 */

const PROHIBITED_TERMS = [
  { pattern: /nosso\s+seguro/gi, message: 'Termo proibido "nosso seguro" detectado. Use "proteção" ou "benefício".' },
  { pattern: /n[oó]s\s+garantimos/gi, message: 'Termo proibido "nós garantimos" detectado. A garantia é da Seguradora Parceira.' },
  { pattern: /compre\s+nosso\s+seguro/gi, message: 'Termo proibido "compre nosso seguro" detectado. Evite caracterizar corretagem direta.' },
  { pattern: /corretora/gi, message: 'Termo "corretora" detectado. Saúde & Proteção atua como Estipulante, não corretora.' },
  { pattern: /n[oó]s\s+pagamos/gi, message: 'Termo proibido "nós pagamos" detectado. O pagamento é da Seguradora Parceira.' },
  { pattern: /seguro\s+granpaz/gi, message: 'Expressão "seguro Granpaz" detectada. Use "plano Granpaz" ou "proteção Granpaz".' },
]

// Exclusões: estes caminhos/arquivos podem referenciar seguros em contextos legais/compliance
const EXCLUDED_PATHS = [
  'compliance-footer',
  'ComplianceBanner',
  'compliance/',
  'lgpd',
  'susep-compliance', // auto-referência
  'copy.json', // terá sua própria validação
]

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detecta termos proibidos pela SUSEP no código-fonte (Air-Gap Semântico)',
      category: 'Compliance',
      recommended: true,
    },
    messages: {
      susepViolation: 'SUSEP_VIOLATION: {{ message }}',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename()
    
    // Ignorar caminhos excluídos
    if (EXCLUDED_PATHS.some(excluded => filename.includes(excluded))) {
      return {}
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return
        const text = node.value
        
        for (const { pattern, message } of PROHIBITED_TERMS) {
          // Resetar regex lastIndex para padrões globais
          pattern.lastIndex = 0
          if (pattern.test(text)) {
            context.report({
              node,
              messageId: 'susepViolation',
              data: { message },
            })
          }
        }
      },
      JSXText(node) {
        const text = node.value || ''
        for (const { pattern, message } of PROHIBITED_TERMS) {
          pattern.lastIndex = 0
          if (pattern.test(text)) {
            context.report({
              node,
              messageId: 'susepViolation',
              data: { message },
            })
          }
        }
      },
      TemplateElement(node) {
        const text = node.value?.raw || ''
        for (const { pattern, message } of PROHIBITED_TERMS) {
          pattern.lastIndex = 0
          if (pattern.test(text)) {
            context.report({
              node,
              messageId: 'susepViolation',
              data: { message },
            })
          }
        }
      },
    }
  },
}
