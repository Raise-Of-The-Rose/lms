import { Palette } from "lucide-react";
import { useTheme } from "../context/ThemeProvider";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
    const { theme, setTheme, themes } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-base-100/80 backdrop-blur-sm p-2 rounded-full border border-base-300 shadow-lg">
            <Palette className="w-4 h-4 text-primary ml-2" />
            <select
                className="select select-sm select-ghost font-bold text-xs capitalize border-none focus:outline-none bg-transparent"
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
            >
                {themes.map((t) => (
                    <option key={t} value={t} className="capitalize">
                        {t}
                    </option>
                ))}
            </select>
        </div>
    );
}
