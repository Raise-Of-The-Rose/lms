import React, { createContext, useContext, useEffect, useState } from "react";

const DAISY_THEMES = [
    "light", "dark", "cupcake", "synthwave", "retro", "cyberpunk",
    "valentine", "aqua", "night", "dracula", "autumn", "business",
    "coffee", "emerald", "forest", "luxury", "pastel", "wireframe", "nord"
] as const;

type DaisyTheme = typeof DAISY_THEMES[number];

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: DaisyTheme;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: DaisyTheme;
    setTheme: (theme: DaisyTheme) => void;
    themes: readonly string[];
};

const initialState: ThemeProviderState = {
    theme: "light",
    setTheme: () => null,
    themes: DAISY_THEMES,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = "light",
    storageKey = "daisyui-theme",
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<DaisyTheme>(
        () => (localStorage.getItem(storageKey) as DaisyTheme) || defaultTheme
    );

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    const setTheme = (newTheme: DaisyTheme) => {
        localStorage.setItem(storageKey, newTheme);
        setThemeState(newTheme);
    };

    return (
        <ThemeProviderContext.Provider value={{ theme, setTheme, themes: DAISY_THEMES }}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");
    return context;
};
