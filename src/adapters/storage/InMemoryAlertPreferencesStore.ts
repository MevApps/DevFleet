import type { AlertPreferences } from "../../entities/AlertPreferences"
import { createDefaultAlertPreferences } from "../../entities/AlertPreferences"
import type { AlertPreferencesStore } from "../../use-cases/ports/AlertPreferencesStore"

export class InMemoryAlertPreferencesStore implements AlertPreferencesStore {
  private prefs: AlertPreferences = createDefaultAlertPreferences()
  async read(): Promise<AlertPreferences> { return this.prefs }
  async update(prefs: AlertPreferences): Promise<void> { this.prefs = prefs }
}
