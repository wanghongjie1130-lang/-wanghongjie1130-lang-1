import { ManualJsonAdapter } from "./manual/ManualJsonAdapter.mjs";
import { ManualCsvAdapter } from "./manual/ManualCsvAdapter.mjs";
import { StandardProductFeedAdapter } from "./public-db/StandardProductFeedAdapter.mjs";

export const adapters = [new ManualJsonAdapter(), new ManualCsvAdapter(), new StandardProductFeedAdapter()];

export function getAdapter(config) {
  const adapter = adapters.find(candidate => candidate.id === config.adapter || candidate.supports(config));
  if (!adapter) throw new Error(`Current source is not supported: ${config.adapter || config.input || "unknown"}`);
  return adapter;
}
