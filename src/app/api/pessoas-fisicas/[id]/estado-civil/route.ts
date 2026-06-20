import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/pessoas-fisicas/[id]/estado-civil
 *
 * Preservação Seletiva de Vínculos (§1.1):
 * - Quando agregado muda de CASADO/UNIAO_ESTAVEL para SOLTEIRO/DIVORCIADO/VIUVO:
 *   - Apenas sub-dependentes com parentesco CONJUGE são desvinculados
 *   - Sub-dependentes com parentesco FILHO permanecem ativos
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { novoEstadoCivil, motivo } = body

    // Validações básicas
    const ESTADOS_CIVIL_INDIVIDUAL = ['SOLTEIRO', 'DIVORCIADO', 'VIUVO']
    const ESTADOS_CIVIL_FAMILIAR = ['CASADO', 'UNIAO_ESTAVEL']

    if (!novoEstadoCivil || ![...ESTADOS_CIVIL_INDIVIDUAL, ...ESTADOS_CIVIL_FAMILIAR].includes(novoEstadoCivil)) {
      return NextResponse.json({ error: 'Estado civil inválido.' }, { status: 400 })
    }

    // Buscar pessoa
    const pessoa = await db.pessoaFisica.findUnique({ where: { id } })
    if (!pessoa) {
      return NextResponse.json({ error: 'Pessoa não encontrada.' }, { status: 404 })
    }

    // Se mudando de familiar para individual, aplicar preservação seletiva
    const estadoCivilAnterior = pessoa.estadoCivil
    const eraFamiliar = ESTADOS_CIVIL_FAMILIAR.includes(estadoCivilAnterior)
    const agoraIndividual = ESTADOS_CIVIL_INDIVIDUAL.includes(novoEstadoCivil)

    let conjugesRemovidos = 0
    let filhosPreservados = 0

    if (eraFamiliar && agoraIndividual) {
      // Buscar sub-dependentes ativos vinculados a este agregado
      const subDependentesAtivos = await db.vinculo.findMany({
        where: {
          agregadoPaiId: id,
          dataFimVinculo: null,
        },
        include: {
          pessoaVinculada: { select: { id: true, nomeCompleto: true, parentesco: true } },
        },
      })

      for (const vinc of subDependentesAtivos) {
        if (vinc.parentesco === 'CONJUGE') {
          // Desvincular apenas cônjuge
          await db.vinculo.update({
            where: { id: vinc.id },
            data: { dataFimVinculo: new Date() },
          })
          conjugesRemovidos++
        } else if (vinc.parentesco === 'FILHO') {
          // Filhos permanecem ativos
          filhosPreservados++
        }
      }
    }

    // Atualizar estado civil
    await db.pessoaFisica.update({
      where: { id },
      data: { estadoCivil: novoEstadoCivil, updatedAt: new Date() },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        entidade: 'PessoaFisica',
        entidadeId: id,
        acao: 'UPDATE_ESTADO_CIVIL',
        atorId: request.headers.get('x-user-id'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        valoresAnteriores: JSON.stringify({ estadoCivil: estadoCivilAnterior }),
        valoresNovos: JSON.stringify({
          estadoCivil: novoEstadoCivil,
          conjugesRemovidos,
          filhosPreservados,
          motivo: motivo || 'Alteração de estado civil',
        }),
      },
    })

    return NextResponse.json({
      message: 'Estado civil atualizado com sucesso.',
      estadoCivilAnterior,
      novoEstadoCivil,
      conjugesRemovidos,
      filhosPreservados,
    })
  } catch (error) {
    console.error('Update estado civil error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
