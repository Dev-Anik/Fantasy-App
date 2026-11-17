// Periodic background check for squad news (and a refresh of the deadline
// reminders). Must be defined at module scope, before any screen mounts:
// a background launch runs this file without rendering the app. Imported at
// the top of src/app/_layout.tsx.
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { anyEnabled, checkSquadNews, loadSettings } from "./notifications";

export const NEWS_TASK = "profpl-squad-news";
// The OS treats this as a minimum and may run it less often.
const INTERVAL_MINUTES = 60;

TaskManager.defineTask(NEWS_TASK, async () => {
  try {
    await checkSquadNews();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Registers the task while any notification is switched on, and removes it
// otherwise. Registration persists across app restarts.
export async function syncBackgroundTask() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const wanted = anyEnabled(await loadSettings());
    const registered = await TaskManager.isTaskRegisteredAsync(NEWS_TASK);
    if (wanted && !registered) {
      await BackgroundTask.registerTaskAsync(NEWS_TASK, { minimumInterval: INTERVAL_MINUTES });
    } else if (!wanted && registered) {
      await BackgroundTask.unregisterTaskAsync(NEWS_TASK);
    }
  } catch {}
}

export async function stopBackgroundTask() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(NEWS_TASK)) {
      await BackgroundTask.unregisterTaskAsync(NEWS_TASK);
    }
  } catch {}
}
