import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Uniwind, useUniwind } from "uniwind";

import {
  type AppearanceChoice,
  parseAppearanceChoice,
  readAppearancePreference,
  writeAppearancePreference,
} from "@/lib/appearance-preference";

type AppearanceState = {
  choice: AppearanceChoice;
  issue: "restore" | "save" | null;
  pending: boolean;
  select: (choice: AppearanceChoice) => Promise<void>;
};

const AppearanceContext = createContext<AppearanceState | null>(null);

export function AppearanceProvider({ children }: PropsWithChildren) {
  const { hasAdaptiveThemes, theme } = useUniwind();
  const [pending, setPending] = useState(true);
  const [issue, setIssue] = useState<AppearanceState["issue"]>(null);
  const busy = useRef(true);

  useEffect(() => {
    let active = true;
    void readAppearancePreference()
      .then((choice) => {
        if (active) Uniwind.setTheme(choice);
      })
      .catch(() => {
        if (active) {
          setIssue("restore");
          console.warn("Appearance preference could not be restored");
        }
      })
      .finally(() => {
        if (active) {
          busy.current = false;
          setPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const select = async (choice: AppearanceChoice) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await writeAppearancePreference(choice);
      Uniwind.setTheme(choice);
      setIssue(null);
    } catch {
      setIssue("save");
      console.warn("Appearance preference could not be saved");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <AppearanceContext.Provider
      value={{
        choice: hasAdaptiveThemes ? "system" : parseAppearanceChoice(theme),
        issue,
        pending,
        select,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceState {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("Appearance controls require AppearanceProvider");
  return value;
}
