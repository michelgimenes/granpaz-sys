import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/rede/arvore
 * Query the hierarchical sponsorship tree
 *
 * Query params:
 * - revendedor_id (optional, defaults to root nodes — those without an active patrocínio as revendedor)
 * - max_nivel (default 5, max 10) — limit depth to prevent DoS
 *
 * Returns a tree structure where each node has:
 * { id, revendedorId, nomeCompleto, cpf, nivelProfundidade, subordinados: [...] }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const revendedorId = searchParams.get('revendedor_id') || undefined
    const maxNivel = Math.min(10, Math.max(1, parseInt(searchParams.get('max_nivel') || '5', 10)))

    if (revendedorId) {
      // ─── Build tree from a specific revendedor ───
      const revendedor = await db.pessoaFisica.findUnique({
        where: { id: revendedorId },
        select: { id: true, nomeCompleto: true, cpf: true },
      })
      if (!revendedor) {
        return NextResponse.json({ error: 'Revendedor não encontrado.' }, { status: 404 })
      }

      // Get the revendedor's active patrocínio to determine their level
      const patrocinioAtivo = await db.patrocinio.findFirst({
        where: { revendedorId, dataFimVinculo: null },
      })
      const nivelBase = patrocinioAtivo ? patrocinioAtivo.nivelProfundidade : 0

      const tree = await buildTreeNode(revendedorId, revendedor.nomeCompleto, revendedor.cpf, nivelBase, maxNivel)
      return NextResponse.json({ tree })
    } else {
      // ─── Build trees from root nodes ───
      // Root nodes: people who are patrocinadores but don't have an active patrocínio as revendedor
      // i.e., they appear as patrocinadorId in active patrocínios but not as revendedorId

      // Find all unique patrocinadorIds from active patrocínios
      const patrocinadoresAtivos = await db.patrocinio.findMany({
        where: { dataFimVinculo: null },
        select: { patrocinadorId: true },
        distinct: ['patrocinadorId'],
      })

      const patrocinadorIds = patrocinadoresAtivos.map(p => p.patrocinadorId)

      // Filter to those who don't have an active patrocínio as revendedor (true roots)
      const roots: { id: string; nomeCompleto: string; cpf: string | null }[] = []

      for (const pid of patrocinadorIds) {
        const asRevendedor = await db.patrocinio.findFirst({
          where: { revendedorId: pid, dataFimVinculo: null },
        })
        if (!asRevendedor) {
          const pessoa = await db.pessoaFisica.findUnique({
            where: { id: pid },
            select: { id: true, nomeCompleto: true, cpf: true },
          })
          if (pessoa) {
            roots.push(pessoa)
          }
        }
      }

      // Build tree for each root
      const trees = []
      for (const root of roots) {
        const tree = await buildTreeNode(root.id, root.nomeCompleto, root.cpf, 0, maxNivel)
        trees.push(tree)
      }

      return NextResponse.json({ trees })
    }
  } catch (error) {
    console.error('Arvore query error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

/**
 * Recursively build a tree node with subordinates
 * Uses iterative BFS approach with depth limit
 */
async function buildTreeNode(
  startId: string,
  startNome: string,
  startCpf: string | null,
  startNivel: number,
  maxNivel: number
): Promise<TreeNode> {
  const root: TreeNode = {
    id: startId,
    revendedorId: startId,
    nomeCompleto: startNome,
    cpf: startCpf,
    nivelProfundidade: startNivel,
    subordinados: [],
  }

  // BFS: level-by-level traversal
  type QueueItem = { node: TreeNode; nivel: number }
  const queue: QueueItem[] = [{ node: root, nivel: startNivel }]

  while (queue.length > 0) {
    const { node, nivel } = queue.shift()!

    // Don't traverse beyond max_nivel
    if (nivel >= maxNivel) continue

    // Find direct active subordinates (where this person is the patrocinador)
    const patrocinios = await db.patrocinio.findMany({
      where: { patrocinadorId: node.revendedorId, dataFimVinculo: null },
      include: {
        revendedor: {
          select: { id: true, nomeCompleto: true, cpf: true },
        },
      },
      orderBy: { dataEntrada: 'asc' },
    })

    for (const p of patrocinios) {
      const childNode: TreeNode = {
        id: p.id,
        revendedorId: p.revendedorId,
        nomeCompleto: p.revendedor.nomeCompleto,
        cpf: p.revendedor.cpf,
        nivelProfundidade: p.nivelProfundidade,
        subordinados: [],
      }
      node.subordinados.push(childNode)
      queue.push({ node: childNode, nivel: p.nivelProfundidade })
    }
  }

  return root
}

interface TreeNode {
  id: string
  revendedorId: string
  nomeCompleto: string
  cpf: string | null
  nivelProfundidade: number
  subordinados: TreeNode[]
}
