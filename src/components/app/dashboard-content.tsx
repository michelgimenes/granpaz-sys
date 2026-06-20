'use client'

import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'

const DashboardLayout = dynamic(
  () => import('@/components/dashboard/dashboard-layout').then(mod => ({ default: mod.DashboardLayout })),
  { ssr: false }
)
const OverviewTab = dynamic(
  () => import('@/components/dashboard/overview-tab').then(mod => ({ default: mod.OverviewTab })),
  { ssr: false }
)
const ApprovalTab = dynamic(
  () => import('@/components/dashboard/approval-tab').then(mod => ({ default: mod.ApprovalTab })),
  { ssr: false }
)
const ContractsTab = dynamic(
  () => import('@/components/dashboard/contracts-tab').then(mod => ({ default: mod.ContractsTab })),
  { ssr: false }
)
const FinancialTab = dynamic(
  () => import('@/components/dashboard/financial-tab').then(mod => ({ default: mod.FinancialTab })),
  { ssr: false }
)
const NetworkTab = dynamic(
  () => import('@/components/dashboard/network-tab').then(mod => ({ default: mod.NetworkTab })),
  { ssr: false }
)
const ClaimsTab = dynamic(
  () => import('@/components/dashboard/claims-tab').then(mod => ({ default: mod.ClaimsTab })),
  { ssr: false }
)
const ConfigTab = dynamic(
  () => import('@/components/dashboard/config-tab').then(mod => ({ default: mod.ConfigTab })),
  { ssr: false }
)
const AuditTab = dynamic(
  () => import('@/components/dashboard/audit-tab').then(mod => ({ default: mod.AuditTab })),
  { ssr: false }
)
const SeguradorasTab = dynamic(
  () => import('@/components/dashboard/seguradoras-tab').then(mod => ({ default: mod.SeguradorasTab })),
  { ssr: false }
)

export function DashboardContent() {
  const { currentDashboardTab } = useAppStore()

  const renderTab = () => {
    switch (currentDashboardTab) {
      case 'approval': return <ApprovalTab />
      case 'contracts': return <ContractsTab />
      case 'financial': return <FinancialTab />
      case 'network': return <NetworkTab />
      case 'claims': return <ClaimsTab />
      case 'config': return <ConfigTab />
      case 'seguradoras': return <SeguradorasTab />
      case 'audit': return <AuditTab />
      default: return <OverviewTab />
    }
  }

  return (
    <DashboardLayout>
      {renderTab()}
    </DashboardLayout>
  )
}
