'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { Download, Users } from 'lucide-react'
import { formatDate } from '@/lib/helpers'

interface Patrocinio {
  id: string
  nivelProfundidade: number
  dataEntrada: string
  revendedor: {
    nomeCompleto: string
  }
  patrocinador: {
    nomeCompleto: string
  }
}

export function NetworkTab() {
  const { data: patrocinios = [], isLoading } = useQuery<Patrocinio[]>({
    queryKey: ['patrocinios'],
    queryFn: async () => {
      const res = await fetch('/api/patrocinios')
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
  })

  // Group by level
  const grouped = patrocinios.reduce<Record<number, Patrocinio[]>>((acc, p) => {
    const level = p.nivelProfundidade
    if (!acc[level]) acc[level] = []
    acc[level].push(p)
    return acc
  }, {})

  const handleExportCSV = () => {
    const headers = 'Nível;Revendedor;Patrocinador;Data Entrada\n'
    const rows = patrocinios.map(p =>
      `${p.nivelProfundidade};${p.revendedor.nomeCompleto};${p.patrocinador.nomeCompleto};${formatDate(p.dataEntrada)}`
    ).join('\n')
    const csv = headers + rows
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'rede-patrocinio.csv'
    link.click()
  }

  const levelColors = [
    'bg-primary/10 text-primary',
    'bg-brand-accent/10 text-brand-accent',
    'bg-state-success/10 text-state-success',
    'bg-state-warning/10 text-state-warning',
    'bg-state-error/10 text-state-error',
  ]

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Rede / Patrocínio</h1>
          <p className="text-muted-foreground mt-1">Visualização da rede de patrocínio</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} size="sm">
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total de Membros</p>
            <p className="text-2xl font-bold text-foreground">{patrocinios.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Níveis</p>
            <p className="text-2xl font-bold text-foreground">{Object.keys(grouped).length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Patrocinadores Únicos</p>
            <p className="text-2xl font-bold text-foreground">
              {new Set(patrocinios.map(p => p.patrocinador.nomeCompleto)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tree visualization (accordion-based) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-muted-foreground">Nenhum membro na rede</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, members]) => (
              <Card key={level} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={levelColors[Number(level) - 1] || 'bg-muted text-muted-foreground'}>
                      Nível {level}
                    </Badge>
                    <CardTitle className="text-sm">
                      {members.length} {members.length === 1 ? 'membro' : 'membros'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                        <div>
                          <span className="font-medium text-foreground">{m.revendedor.nomeCompleto}</span>
                          <span className="text-muted-foreground ml-2">patrocinado por {m.patrocinador.nomeCompleto}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(m.dataEntrada)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
