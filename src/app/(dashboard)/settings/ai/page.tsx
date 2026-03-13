import { AIConfigEditor } from '@/components/settings/AIConfigEditor'

export default function AISettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Конфигурация</h1>
        <p className="text-muted-foreground">Настройте поведението на вашия AI рецепционист</p>
      </div>
      <AIConfigEditor />
    </div>
  )
}
