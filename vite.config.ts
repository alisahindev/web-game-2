import { defineConfig } from "vitest/config";

const env = globalThis as unknown as {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const repositoryName = env.process?.env?.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubActions = env.process?.env?.GITHUB_ACTIONS === "true";

export default defineConfig({
  base: isGitHubActions && repositoryName ? `/${repositoryName}/` : "/",
  test: {
    environment: "node",
  },
});
