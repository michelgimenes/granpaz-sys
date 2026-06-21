'use client'

import { useAppStore, type User } from '@/lib/store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield, Users, Wallet, HeadphonesIcon, UserCircle } from 'lucide-react'

const profiles = [
  {
    value: 'SUPERADMIN',
    label: 'SuperAdmin',
    description: 'Acesso total — aprovação, seguradoras, configurações, auditoria',
    icon: Shield,
  },
  {
    value: 'SUPERVISOR',
    label: 'Supervisor',
    description: 'Visão hierárquica, auxílio cadastral, contratos, rede',
    icon: Users,
  },
  {
    value: 'FINANCEIRO',
    label: 'Financeiro',
    description: 'Contas a pagar, inadimplência, reconciliação, aprovação de saques',
    icon: Wallet,
  },
  {
    value: 'SUPORTE',
    label: 'Suporte',
    description: 'Correção cadastral, logs, diagnósticos',
    icon: HeadphonesIcon,
  },
  {
    value: 'CLIENTE',
    label: 'Cliente / Revendedor',
    description: 'Dashboard, autogestão, indicações, abatimento de parcelas',
    icon: UserCircle,
  },
]

export function ProfileSwitcher() {
  const { user, activeProfile, setActiveProfile } = useAppStore()

  if (!user || user.role !== 'SUPERADMIN') return null

  const currentProfile = profiles.find(p => p.value === activeProfile) ?? profiles[0]

  return (
    <div className="px-3 py-3 border-b border-primary-foreground/10">
      <label className="text-xs text-primary-foreground/50 mb-1.5 block font-medium tracking-wide">
        Perfil de teste
      </label>
      <Select
        value={activeProfile ?? ''}
        onValueChange={(value) => setActiveProfile(value as User['role'])}
      >
        <SelectTrigger className="w-full h-auto min-h-0 bg-gran-sidebar-hover border-primary-foreground/10 text-primary-foreground text-xs px-2 py-1.5 rounded-md">
          <SelectValue>
            <div className="flex items-center gap-2">
              {currentProfile.icon && (
                <currentProfile.icon className="h-3.5 w-3.5 shrink-0 text-gran-accent" />
              )}
              <span>{currentProfile.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-gran-sidebar border-primary-foreground/10 text-primary-foreground">
          {profiles.map((profile) => {
            const Icon = profile.icon
            const isActive = activeProfile === profile.value
            return (
              <SelectItem
                key={profile.value}
                value={profile.value}
                className={`text-xs py-2 px-2 ${isActive ? 'bg-gran-sidebar-active' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 shrink-0 mt-0.5 text-gran-accent" />
                  <div className="flex flex-col">
                    <span className="font-medium text-xs">{profile.label}</span>
                    <span className="text-primary-foreground/50 text-[10px] leading-tight">
                      {profile.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
