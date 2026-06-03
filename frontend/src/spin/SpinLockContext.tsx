import { createContext, useContext, useState, ReactNode } from 'react';

// Tracks whether the wheel is mid-spin. Lives above the router so Nav can
// disable navigation while a spin is running — the wheel's animation state is
// local to Wheel.tsx and gets corrupted if the page unmounts or its inputs
// change before the spin resolves.
type SpinLockState = {
  spinning: boolean;
  setSpinning: (v: boolean) => void;
};

const SpinLockContext = createContext<SpinLockState | undefined>(undefined);

export function SpinLockProvider({ children }: { children: ReactNode }) {
  const [spinning, setSpinning] = useState(false);
  return (
    <SpinLockContext.Provider value={{ spinning, setSpinning }}>
      {children}
    </SpinLockContext.Provider>
  );
}

export function useSpinLock() {
  const ctx = useContext(SpinLockContext);
  if (!ctx) throw new Error('useSpinLock must be used within SpinLockProvider');
  return ctx;
}
