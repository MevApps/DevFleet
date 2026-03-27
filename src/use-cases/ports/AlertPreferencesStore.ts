import type { AlertPreferences } from "../../entities/AlertPreferences"

export interface AlertPreferencesStore {
  read(): Promise<AlertPreferences>
  update(prefs: AlertPreferences): Promise<void>
}
