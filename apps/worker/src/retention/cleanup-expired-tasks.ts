import { cleanupExpiredTasks } from "@ai-rewrite/db";

export async function cleanupExpiredTasksEntry() {
  return cleanupExpiredTasks();
}
