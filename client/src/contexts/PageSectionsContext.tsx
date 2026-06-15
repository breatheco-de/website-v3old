import { createContext, useContext } from "react";

type PageSectionsMap = Record<string, Record<string, unknown>>;

const PageSectionsContext = createContext<PageSectionsMap>({});

export function PageSectionsProvider({
  value,
  children,
}: {
  value: PageSectionsMap;
  children: React.ReactNode;
}) {
  return (
    <PageSectionsContext.Provider value={value}>
      {children}
    </PageSectionsContext.Provider>
  );
}

export function usePageSections(): PageSectionsMap {
  return useContext(PageSectionsContext);
}
