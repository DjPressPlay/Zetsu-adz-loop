import { runAutonomousCycle } from "../../src/server-app";

export const handler = async (event: any, context: any) => {
  console.log("[CRON] Starting autonomous cycle...");
  await runAutonomousCycle();
  console.log("[CRON] Autonomous cycle complete.");
  return {
    statusCode: 200,
  };
};

// This is the configuration for the scheduled function
// It will run every hour
export const config = {
  schedule: "@hourly"
};
