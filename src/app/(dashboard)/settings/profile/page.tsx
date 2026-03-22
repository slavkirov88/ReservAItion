import { ProfileEditor } from '@/components/settings/ProfileEditor'

export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Профил</h1>
        <p className="text-muted-foreground">Основна информация за вашия хотел</p>
      </div>
      <ProfileEditor />
    </div>
  )
}
