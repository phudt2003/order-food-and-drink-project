import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

function ThemeToggle({ className = "", size = "md" }) {
  const { isDark, toggleTheme } = useTheme();
  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
      aria-pressed={isDark}
      className={[
        "flex items-center rounded-full transition bg-[#E9E3DC] dark:bg-[#3A2E26]",
        isSmall ? "gap-1 p-0.5" : "gap-2 p-1",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C67C4E]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F5F2] dark:focus-visible:ring-offset-[#3A2E26]",
        className,
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex items-center justify-center rounded-full transition",
          isSmall ? "h-6 w-6" : "h-8 w-8 md:h-9 md:w-9",
          !isDark ? "bg-white text-[#C67C4E] shadow-sm" : "text-[#3A3A3A] dark:text-[#F5F5F5]",
        ].join(" ")}
        aria-hidden="true"
      >
        <Sun className="h-4 w-4" />
      </span>

      <span
        className={[
          "inline-flex items-center justify-center rounded-full transition",
          isSmall ? "h-6 w-6" : "h-8 w-8 md:h-9 md:w-9",
          isDark ? "bg-[#2A211B] text-[#F5F5F5] shadow-sm" : "text-[#3A3A3A] dark:text-[#F5F5F5]",
        ].join(" ")}
        aria-hidden="true"
      >
        <Moon className="h-4 w-4" />
      </span>

    </button>
  );
}

export default ThemeToggle;

