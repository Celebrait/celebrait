import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { User, LogOut, LogIn, LayoutDashboard } from "lucide-react";
import { Link } from "wouter";
import logoSrc from "../assets/Logo2.png";

export default function Header() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <img 
                src={logoSrc} 
                alt="Celebrait Logo" 
                className="h-12 sm:h-16 object-contain cursor-pointer"
              />
            </Link>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="bg-gradient-celebrait text-white px-2 py-1 sm:px-4 sm:py-1.5 rounded-xl shadow-lg text-xs sm:text-sm">
              BETA
            </span>
            
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Link href="/dashboard">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 hidden sm:flex"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard" className="sm:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                  </Button>
                </Link>
                
                <div className="flex items-center space-x-2 bg-purple-50 rounded-full pl-1 pr-2 py-1">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs sm:text-sm font-medium">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </div>
                  <span className="text-purple-700 text-xs sm:text-sm font-medium hidden sm:block max-w-[100px] truncate">
                    {user.firstName || user.email?.split('@')[0]}
                  </span>
                </div>
                
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-2"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleLogin}
                variant="outline"
                size="sm"
                className="border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
              >
                <LogIn className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Log In</span>
                <span className="sm:hidden">Login</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
