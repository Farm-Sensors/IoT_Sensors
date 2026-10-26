import { jwtDecode } from "jwt-decode";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { clearModulesCache } from "../services/modules";

interface UserPayload {
  sub: string;
  rol: "admin" | "cliente";
  nombre?: string;
  exp: number;
}

interface AuthContextType {
  user: UserPayload | null;
  token: string | null;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ accessToken?: string }>).detail;
      if (detail?.accessToken) {
        setToken(detail.accessToken);
      }
    };
    window.addEventListener("auth:token-refreshed", handleTokenRefreshed);
    return () => {
      window.removeEventListener("auth:token-refreshed", handleTokenRefreshed);
    };
  }, []);

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode<UserPayload>(token);
        // Check if token is expired
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          setUser(decoded);
        }
      } catch (err) {
        logout();
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, [token]);

  const login = (accessToken: string, refreshToken: string) => {
    localStorage.setItem("token", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setToken(accessToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setToken(null);
    setUser(null);
    clearModulesCache();
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
