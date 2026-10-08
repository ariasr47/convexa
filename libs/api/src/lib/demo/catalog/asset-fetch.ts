export async function fetchScenarioSeedAsset(assetUrl: string): Promise<unknown> {
  const noStoreOptions = { cache: 'no-store' } as NonNullable<Parameters<typeof fetch>[1]> & {
    cache: 'no-store';
  };
  const response = await fetch(assetUrl, noStoreOptions);
  if (!response.ok) throw new Error(`Scenario seed request failed (${response.status}).`);
  return response.json();
}
