import { Heart, Menu, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-celebrait rounded-xl flex items-center justify-center">
              <Heart className="text-white text-lg" fill="currentColor" />
            </div>
            <span className="text-2xl font-bold text-gradient-celebrait">Celebrait</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 px-3 py-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:block font-medium">
                      {user?.firstName || user?.email?.split('@')[0] || 'Account'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => window.location.href = '/account'}>
                    <User className="mr-2 h-4 w-4" />
                    My Account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = '/api/logout'}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-gradient-celebrait hover:opacity-90 text-white px-6 py-2 rounded-xl shadow-lg transition-all duration-300"
              >
                Sign In
              </Button>
            )}
            
            <Button variant="ghost" size="sm" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
