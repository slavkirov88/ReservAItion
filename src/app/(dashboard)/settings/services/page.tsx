import { ServicesEditor } from '@/components/settings/ServicesEditor'

export default function ServicesSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Типове стаи</h1>
        <p className="text-muted-foreground">Управлявайте типовете стаи, предлагани от хотела</p>
      </div>
      <ServicesEditor />
    </div>
  )
}
