import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { GithubRegistry, IRegistry } from '@hyperlane-xyz/registry';
import { ChainMap, MultiProvider } from '@hyperlane-xyz/sdk';

import { ChainConfig } from './features/chains/chainConfig';
import { logger } from './utils/logger';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 1;

// Define the AppState interface
interface AppState {
  chainConfigs: ChainMap<ChainConfig>;
  multiProvider: MultiProvider;
  registry: IRegistry;
  bannerClassName: string;
  setChainConfigs: (configs: ChainMap<ChainConfig>) => void;
  setMultiProvider: (mp: MultiProvider) => void;
  setRegistry: (registry: IRegistry) => void;
  setBanner: (className: string) => void;
}

// Initial state
const initialState: AppState = {
  chainConfigs: {},
  multiProvider: new MultiProvider({}),
  registry: new GithubRegistry(),
  bannerClassName: '',
  setChainConfigs: () => {},
  setMultiProvider: () => {},
  setRegistry: () => {},
  setBanner: () => {},
};

// Zustand store
export const useStore = create<AppState>(
  persist(
    (set, get) => ({
      ...initialState,
      setChainConfigs: async (configs: ChainMap<ChainConfig>) => {
        const multiProvider = await buildMultiProvider(get().registry, configs);
        set({ chainConfigs: configs, multiProvider });
      },
      setMultiProvider: (multiProvider: MultiProvider) => {
        set({ multiProvider });
      },
      setRegistry: (registry: IRegistry) => {
        set({ registry });
      },
      setBanner: (className: string) => set({ bannerClassName: className }),
    }),
    {
      name: 'hyperlane', // name in storage
      version: PERSIST_STATE_VERSION,
      partialize: (state) => ({ chainConfigs: state.chainConfigs }), // fields to persist
      onRehydrateStorage: () => {
        logger.debug('Rehydrating state');
        return (state, error) => {
          if (error || !state) {
            logger.error('Error during hydration', error);
            return;
          }
          buildMultiProvider(state.registry, state.chainConfigs)
            .then((mp) => {
              state.setMultiProvider(mp);
              logger.debug('Rehydration complete');
            })
            .catch((e) => logger.error('Error building MultiProvider', e));
        };
      },
    }
  )
);

// Custom hooks for accessing specific parts of the state
export function useRegistry() {
  return useStore((s) => s.registry);
}

export function useMultiProvider() {
  return useStore((s) => s.multiProvider);
}

// Ensures that the multiProvider has been populated during the onRehydrateStorage hook above,
// otherwise returns undefined
export function useReadyMultiProvider() {
  const multiProvider = useMultiProvider();
  return multiProvider.getKnownChainNames().length > 0 ? multiProvider : undefined;
}

// Function to build MultiProvider
async function buildMultiProvider(registry: IRegistry, customChainConfigs: ChainMap<ChainConfig>) {
  const registryChainMetadata = await registry.getMetadata();
  return new MultiProvider({ ...registryChainMetadata, ...customChainConfigs });
}
