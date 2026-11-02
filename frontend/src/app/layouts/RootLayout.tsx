import { Outlet } from "react-router";
import { ThemeProvider } from "../context/ThemeContext";

export function RootLayout() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <Outlet />
      </div>
    </ThemeProvider>
  );
}
