import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkOwnership } from '@/lib/auth-helpers'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; vinculoId: string }> }
) {
  try {
    const { id, vinculoId } = await params

    const ownership = await checkOwnership(request, id)
    if (!ownership.authorized) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
    }

    const vinculo = await db.vinculo.findUnique({
      where: { id: vinculoId },
      include: {
        pessoaVinculada: { select: { id: true, nomeCompleto: true, tipoRegistro: true } },
      },
    })

    if (!vinculo) {
      return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 })
    }

    if (vinculo.titularRaizId !== id) {
      return NextResponse.json({ error: 'Vínculo não pertence a este titular.' }, { status: 403 })
    }

    if (vinculo.dataFimVinculo) {
      return NextResponse.json({ error: 'Vínculo já foi removido anteriormente.' }, { status: 400 })
    }

    // Se for agregado, verificar sub-dependentes ativos
    if (vinculo.tipoVinculo === 'AGREGADO') {
      const subDependentesAtivos = await db.vinculo.findMany({
        where: { agregadoPaiId: vinculo.pessoaVinculada.id, dataFimVinculo: null },
      })
      if (subDependentesAtivos.length > 0) {
        return NextResponse.json({
          error: `Não é possível remover este agregado pois possui ${subDependentesAtivos.length} sub-dependente(s) ativo(s). Remova os sub-dependentes primeiro.`,
        }, { status: 400 })
      }
    }

    await db.vinculo.update({
      where: { id: vinculoId },
      data: { dataFimVinculo: new Date() },
    })

    // Recalcular valorTotalAgregados se for AGREGADO
    if (vinculo.tipoVinculo === 'AGREGADO') {
      const contratoAtivo = await db.contrato.findFirst({
        where: { titularId: id, status: { in: ['AGUARDANDO_APROVACAO', 'APROVADO', 'SUSPENSO'] } },
        include: { plano: true },
      })
      if (contratoAtivo && contratoAtivo.plano.valorPorAgregado > 0) {
        const agregadosAtivos = await db.vinculo.count({
          where: { titularRaizId: id, tipoVinculo: 'AGREGADO', dataFimVinculo: null },
        })
        await db.contrato.update({
          where: { id: contratoAtivo.id },
          data: { valorTotalAgregados: contratoAtivo.plano.valorPorAgregado * agregadosAtivos },
        })
      }
    }

    await db.auditLog.create({
      data: {
        entidade: 'Vinculo',
        entidadeId: vinculoId,
        acao: 'DELETE',
        atorId: request.headers.get('x-user-id'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        valoresAnteriores: JSON.stringify({
          tipoVinculo: vinculo.tipoVinculo,
          parentesco: vinculo.parentesco,
          pessoaVinculadaId: vinculo.pessoaVinculada.id,
          pessoaVinculadaNome: vinculo.pessoaVinculada.nomeCompleto,
        }),
      },
    })

    return NextResponse.json({ message: 'Vínculo removido com sucesso.' })
  } catch (error) {
    console.error('Delete vinculo error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
