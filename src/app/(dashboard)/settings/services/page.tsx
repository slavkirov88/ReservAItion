import { ServicesEditor } from '@/components/settings/ServicesEditor'

export default function ServicesSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Услуги</h1>
        <p className="text-muted-foreground">Управлявайте услугите, предлагани от клиниката</p>
      </div>
      <ServicesEditor />
    </div>
  )
}
