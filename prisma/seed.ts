import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─────────────────────────────────────────────────────────
  // 1. Business Rules Configuration (16 mandatory keys)
  // ─────────────────────────────────────────────────────────
  const configKeys = [
    { chave: 'IDADE_LIMITE_TITULAR', valor: '65', tipoParse: 'INT', descricao: 'Idade limite para titular no plano' },
    { chave: 'IDADE_LIMITE_CONJUGE', valor: '60', tipoParse: 'INT', descricao: 'Idade limite para cônjuge como dependente' },
    { chave: 'IDADE_LIMITE_DEPENDENTE', valor: '21', tipoParse: 'INT', descricao: 'Idade limite para dependente (filho)' },
    { chave: 'IDADE_COBERTURA_FILHO', valor: '18', tipoParse: 'INT', descricao: 'Idade máxima de cobertura para filho' },
    { chave: 'IDADE_LIMITE_AGREGADO', valor: '60', tipoParse: 'INT', descricao: 'Idade limite para agregado' },
    { chave: 'IDADE_LIMITE_SUB_DEPENDENTE', valor: '21', tipoParse: 'INT', descricao: 'Idade limite para sub-dependente' },
    { chave: 'IDADE_COBERTURA_SUB_FILHO', valor: '18', tipoParse: 'INT', descricao: 'Idade máxima de cobertura para sub-filho' },
    { chave: 'DIAS_CARENCIA_ACIDENTAL', valor: '3', tipoParse: 'INT', descricao: 'Carência em dias para morte acidental' },
    { chave: 'MESES_CARENCIA_NATURAL', valor: '6', tipoParse: 'INT', descricao: 'Carência em meses para morte natural' },
    { chave: 'MESES_CARENCIA_SUICIDIO', valor: '24', tipoParse: 'INT', descricao: 'Carência em meses para suicídio' },
    { chave: 'MESES_REMISSAO_OBITO_PADRAO', valor: '3', tipoParse: 'INT', descricao: 'Meses de remissão padrão em caso de óbito' },
    { chave: 'DIAS_SUSPENSAO_INADIMPLENCIA', valor: '30', tipoParse: 'INT', descricao: 'Dias para suspensão por inadimplência' },
    { chave: 'SAQUE_PF_ATIVO', valor: 'false', tipoParse: 'BOOLEAN', descricao: 'Habilita saque para pessoa física ativa' },
    { chave: 'LIMITE_SAQUE_DIARIO', valor: '5000', tipoParse: 'DECIMAL', descricao: 'Limite diário de saque em reais' },
    { chave: 'HASH_ASSINATURA_PDF_SALT', valor: 'granpaz_salt_2024_dev', tipoParse: 'VARCHAR', descricao: 'Salt para assinatura de documentos PDF' },
    { chave: 'PREVALENCIA_APIOLICE_SOBRE_CONFIG', valor: 'true', tipoParse: 'BOOLEAN', descricao: 'Apólice da seguradora prevalece sobre configuração padrão' },
  ]

  console.log('  → Seeding business rules configuration...')
  for (const config of configKeys) {
    await prisma.configuracaoRegraNegocio.upsert({
      where: { chave: config.chave },
      update: { valor: config.valor, tipoParse: config.tipoParse, descricao: config.descricao },
      create: config,
    })
  }
  console.log(`    ✓ ${configKeys.length} configuration keys seeded`)

  // ─────────────────────────────────────────────────────────
  // 2. Plans
  // ─────────────────────────────────────────────────────────
  console.log('  → Seeding plans...')
  const planoIndividual = await prisma.plano.upsert({
    where: { id: 'plano_individual_001' },
    update: {},
    create: {
      id: 'plano_individual_001',
      nome: 'Individual',
      tipo: 'INDIVIDUAL',
      valorBase: 29.90,
      valorTaxaAdesao: 39.90,
      valorPorAgregado: 0,
      maxDependentes: 0,
      maxAgregados: 0,
      ativo: true,
      descricao: 'Plano individual com cobertura para o titular',
    },
  })

  const planoFamiliar = await prisma.plano.upsert({
    where: { id: 'plano_familiar_001' },
    update: {},
    create: {
      id: 'plano_familiar_001',
      nome: 'Familiar',
      tipo: 'FAMILIAR',
      valorBase: 49.90,
      valorTaxaAdesao: 59.90,
      valorPorAgregado: 19.90,
      maxDependentes: 8,
      maxAgregados: 4,
      ativo: true,
      descricao: 'Plano familiar com cobertura para titular, dependentes e agregados',
    },
  })
  console.log('    ✓ 2 plans seeded')

  // ─────────────────────────────────────────────────────────
  // 3. Insurance Companies
  // ─────────────────────────────────────────────────────────
  console.log('  → Seeding insurance companies...')
  const seguradoraAlpha = await prisma.seguradora.upsert({
    where: { id: 'seguradora_alpha_001' },
    update: {},
    create: {
      id: 'seguradora_alpha_001',
      nome: 'Seguradora Alpha',
      cnpj: '12.345.678/0001-90',
      codigoSeguradora: 'ALPHA-001',
      telefoneSinistro: '0800-123-4567',
      processoSusep: '15414.900123/2024-01',
      clausulasMarkdown: '## Cláusulas da Apólice - Seguradora Alpha\n\n### Cláusula 1 - Objeto do Seguro\nO presente seguro tem por objeto garantir o pagamento de indenização aos beneficiários em caso de morte do segurado.\n\n### Cláusula 2 - Carência\nO prazo de carência é de 180 dias para morte natural e 3 dias para morte acidental.',
      ativa: true,
    },
  })

  const seguradoraBeta = await prisma.seguradora.upsert({
    where: { id: 'seguradora_beta_001' },
    update: {},
    create: {
      id: 'seguradora_beta_001',
      nome: 'Seguradora Beta',
      cnpj: '98.765.432/0001-10',
      codigoSeguradora: 'BETA-001',
      telefoneSinistro: '0800-987-6543',
      processoSusep: '15414.900456/2024-02',
      clausulasMarkdown: '## Cláusulas da Apólice - Seguradora Beta\n\n### Cláusula 1 - Cobertura\nCobertura por morte natural ou acidental, conforme condições contratuais.\n\n### Cláusula 2 - Remissão\nEm caso de óbito do titular, o contrato será remido por 3 meses.',
      ativa: true,
    },
  })
  console.log('    ✓ 2 insurance companies seeded')

  // ─────────────────────────────────────────────────────────
  // 4. Bonus Levels
  // ─────────────────────────────────────────────────────────
  console.log('  → Seeding bonus levels...')
  const bonusLevels = [
    { nivel: 1, percentual: 10.0, descricao: 'Nível 1 - Bônus direto (indicador direto)' },
    { nivel: 2, percentual: 5.0, descricao: 'Nível 2 - Segunda geração' },
    { nivel: 3, percentual: 3.0, descricao: 'Nível 3 - Terceira geração' },
    { nivel: 4, percentual: 2.0, descricao: 'Nível 4 - Quarta geração' },
    { nivel: 5, percentual: 1.0, descricao: 'Nível 5 - Quinta geração' },
  ]

  for (const bl of bonusLevels) {
    await prisma.nivelBonificacao.upsert({
      where: { id: `nivel_bonificacao_${bl.nivel}` },
      update: {},
      create: {
        id: `nivel_bonificacao_${bl.nivel}`,
        nivel: bl.nivel,
        percentual: bl.percentual,
        descricao: bl.descricao,
        ativo: true,
      },
    })
  }
  console.log('    ✓ 5 bonus levels seeded')

  // ─────────────────────────────────────────────────────────
  // 5. SuperAdmin User
  // ─────────────────────────────────────────────────────────
  console.log('  → Seeding SuperAdmin user...')
  // For dev purposes, we use a simple hash representation
  // In production, use bcrypt or argon2 via NextAuth credentials provider
  const adminSenhaHash = 'dev_hash_granpaz_admin_2024'
  await prisma.user.upsert({
    where: { email: 'admin@granpaz.com' },
    update: {},
    create: {
      id: 'user_superadmin_001',
      nome: 'Administrador Granpaz',
      email: 'admin@granpaz.com',
      senhaHash: adminSenhaHash,
      role: 'SUPERADMIN',
      ativo: true,
    },
  })
  console.log('    ✓ SuperAdmin user seeded (admin@granpaz.com)')

  // ─────────────────────────────────────────────────────────
  // 6. Demo Cliente/Revendedor User
  // ─────────────────────────────────────────────────────────
  console.log('  → Seeding demo Cliente/Revendedor user...')

  // First create the PessoaFisica for the demo user
  const demoPessoa = await prisma.pessoaFisica.upsert({
    where: { id: 'pessoa_demo_001' },
    update: {},
    create: {
      id: 'pessoa_demo_001',
      nomeCompleto: 'Maria Silva',
      dataNascimento: new Date('1990-05-15'),
      cpf: '123.456.789-00',
      genero: 'F',
      estadoCivil: 'SOLTEIRO',
      tipoRegistro: 'TITULAR',
      profissao: 'Revendedora',
      email: 'maria.silva@demo.com',
      telefone: '(11) 99999-0001',
      cep: '01001-000',
      logradouro: 'Rua Exemplo',
      numero: '123',
      complemento: 'Apto 4',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
    },
  })

  await prisma.user.upsert({
    where: { email: 'maria.silva@demo.com' },
    update: {},
    create: {
      id: 'user_cliente_demo_001',
      nome: 'Maria Silva',
      email: 'maria.silva@demo.com',
      senhaHash: 'dev_hash_granpaz_cliente_2024',
      role: 'CLIENTE',
      pessoaFisicaId: demoPessoa.id,
      ativo: true,
    },
  })

  // Create a digital wallet for the demo user
  await prisma.carteiraDigital.upsert({
    where: { id: 'carteira_demo_001' },
    update: {},
    create: {
      id: 'carteira_demo_001',
      titularId: demoPessoa.id,
      saldoDisponivel: 0,
      saldoBloqueado: 0,
      saldoDevedor: 0,
    },
  })
  console.log('    ✓ Demo Cliente/Revendedor user seeded (maria.silva@demo.com)')

  console.log('\n✅ Seeding complete!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
