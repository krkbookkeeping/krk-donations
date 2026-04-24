import { defineConfig } from "vitest/config";

// Separate config for rules tests — they require a running Firestore emulator
// and are invoked through `firebase emulators:exec`.
export default defineConfig({
  test: {
    include: ["test/rules/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
  },
});
