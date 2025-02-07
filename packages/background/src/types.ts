export type Background = {
  _serverUi: Handle;
  _solanaConnection: Handle;
  _serverInjected?: Handle;
  _ethereumConnection: Handle;
};

export type Config = {
  isMobile: boolean;
};

// Opaque handle.
export type Handle = any;

export type CachedValue<T> = {
  ts: number;
  value: T;
};
