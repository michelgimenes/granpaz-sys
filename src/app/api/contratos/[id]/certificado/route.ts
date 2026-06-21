import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkOwnership } from '@/lib/auth-helpers'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const contrato = await db.contrato.findUnique({
      where: { id },
      include: {
        titular: true,
        plano: true,
        seguradora: true,
        dadosAprovacao: true,
      },
    })

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    const ownership = await checkOwnership(request, contrato.titularId)
    if (!ownership.authorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const vinculos = await db.vinculo.findMany({
      where: { titularRaizId: contrato.titularId, dataFimVinculo: null },
      include: {
        pessoaVinculada: {
          select: { nomeCompleto: true, tipoRegistro: true, dataNascimento: true, cpf: true },
        },
      },
    })

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const page = pdfDoc.addPage([595.28, 841.89])
    const { width, height } = page.getSize()
    const margin = 50
    let y = height - margin

    const drawText = (text: string, opts?: { bold?: boolean; size?: number; x?: number; color?: number[] }) => {
      const f = opts?.bold ? fontBold : font
      const s = opts?.size ?? 10
      const x = opts?.x ?? margin
      const c = opts?.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(0, 0, 0)
      page.drawText(text, { x, y: y - s, size: s, font: f, color: c })
      y -= s + (opts?.size ?? 10 > 14 ? 8 : 4)
    }

    const drawLine = () => {
      y -= 4
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) })
      y -= 8
    }

    // Header
    drawText('CERTIFICADO DO CONTRATO', { bold: true, size: 18, color: [0, 0.45, 0.95] })
    drawText(`Nº ${contrato.id.slice(0, 12).toUpperCase()}`, { size: 11 })
    y -= 4

    // Data de emissão
    const hoje = new Date().toLocaleDateString('pt-BR')
    drawText(`Data de Emissão: ${hoje}`, { size: 9, color: [0.4, 0.4, 0.4] })
    drawLine()

    // Seção: Titular
    drawText('TITULAR', { bold: true, size: 13 })
    drawText(`Nome: ${contrato.titular.nomeCompleto}`)
    drawText(`CPF: ${contrato.titular.cpf ?? '—'}`)
    drawText(`Data de Contratação: ${new Date(contrato.createdAt).toLocaleDateString('pt-BR')}`)
    drawText(`Status: ${contrato.status}`)
    drawLine()

    // Seção: Plano
    drawText('PLANO CONTRATADO', { bold: true, size: 13 })
    drawText(`Plano: ${contrato.plano.nome} (${contrato.plano.tipo === 'FAMILIAR' ? 'Familiar' : 'Individual'})`)
    drawText(`Valor Base: R$ ${(contrato.valorParcelaBase ?? 0).toFixed(2)}`)
    drawText(`Valor Agregados: R$ ${(contrato.valorTotalAgregados ?? 0).toFixed(2)}`)
    drawText(`Valor Total Mensal: R$ ${((contrato.valorParcelaBase ?? 0) + (contrato.valorTotalAgregados ?? 0)).toFixed(2)}`)
    drawText(`Vencimento: Dia ${contrato.diaVencimento}`)
    if (contrato.dadosAprovacao?.dataAprovacao) {
      drawText(`Data de Aprovação: ${new Date(contrato.dadosAprovacao.dataAprovacao).toLocaleDateString('pt-BR')}`)
    }
    drawLine()

    // Seção: Vínculos
    drawText('VÍNCULOS', { bold: true, size: 13 })
    if (vinculos.length === 0) {
      drawText('Nenhum vínculo registrado.')
    } else {
      const tipoLabel: Record<string, string> = {
        DEPENDENTE: 'Dependente', AGREGADO: 'Agregado', SUB_DEPENDENTE: 'Sub-dependente',
      }
      const header = ['Nome', 'Tipo', 'CPF']
      const colX = [margin, 250, 380]
      const colWidths = [200, 130, 130]

      // Table header
      drawText(header[0], { bold: true, size: 9, x: colX[0] })
      drawText(header[1], { bold: true, size: 9, x: colX[1] })
      drawText(header[2], { bold: true, size: 9, x: colX[2] })
      y += 4
      drawLine()

      // Table rows
      for (const v of vinculos) {
        if (y < 60) {
          // New page if needed
          const newPage = pdfDoc.addPage([595.28, 841.89])
          y = newPage.getSize().height - margin
        }
        drawText(v.pessoaVinculada.nomeCompleto, { size: 9, x: colX[0] })
        drawText(tipoLabel[v.tipoVinculo] ?? v.tipoVinculo, { size: 9, x: colX[1] })
        drawText(v.pessoaVinculada.cpf ?? '—', { size: 9, x: colX[2] })
        y += 4
      }
    }
    drawLine()

    // Seguradora
    if (contrato.seguradora) {
      drawText('SEGURADORA PARCEIRA', { bold: true, size: 13 })
      drawText(`Nome: ${contrato.seguradora.nome}`)
      drawText(`Código SUSEP: ${contrato.seguradora.codigoSeguradora ?? '—'}`)
      drawLine()
    }

    // Footer - compliance
    y = 40
    drawText('Saúde & Proteção Administração de Benefícios - CNPJ: XX.XXX.XXX/XXXX-XX', { size: 7, color: [0.5, 0.5, 0.5] })
    drawText('Este documento é um certificado de participação no Clube de Benefícios.', { size: 7, color: [0.5, 0.5, 0.5] })
    drawText('A cobertura funeral é garantida pela Seguradora Parceira, conforme condições gerais da apólice.', { size: 7, color: [0.5, 0.5, 0.5] })

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificado-${contrato.id.slice(0, 8)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Certificado error:', error)
    return NextResponse.json({ error: 'Erro ao gerar certificado' }, { status: 500 })
  }
}
