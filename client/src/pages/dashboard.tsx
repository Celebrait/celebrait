import { useEffect, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, CreditCard, Package, LogOut, Eye, ChevronRight, Gift, Coins, Sparkles } from "lucide-react";
import type { Card as CardType, Order } from "@shared/schema";

function getCardStatusBadge(status: string | null) {
  switch (status) {
    case "generating":
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Generating</Badge>;
    case "completed":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
    case "paid":
      return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Paid</Badge>;
    default:
      return <Badge variant="secondary">{status || "Unknown"}</Badge>;
  }
}

function getOrderStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
    case "paid":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Paid</Badge>;
    case "processing":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Processing</Badge>;
    case "shipped":
      return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Shipped</Badge>;
    case "delivered":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Delivered</Badge>;
    case "cancelled":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const creditsRef = useRef<HTMLDivElement>(null);

  const { data: cards, isLoading: cardsLoading } = useQuery<CardType[]>({
    queryKey: ["/api/user/cards"],
    enabled: isAuthenticated,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/user/orders"],
    enabled: isAuthenticated,
  });

  const { data: credits, isLoading: creditsLoading } = useQuery<{
    freeRemaining: number;
    paidCredits: number;
    canGenerate: boolean;
  }>({
    queryKey: ["/api/user/credits"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (searchParams.includes("tab=credits") && creditsRef.current) {
      setTimeout(() => {
        creditsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [searchParams, creditsLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
            My Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Manage your cards and orders</p>
        </div>

        <Card className="mb-8 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user?.firstName?.[0] || user?.email?.[0] || <User className="w-8 h-8" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.firstName || "Welcome back!"}
                </CardTitle>
                <p className="text-gray-600 text-sm">{user?.email}</p>
              </div>
            </div>
            <Button 
              onClick={() => logout()}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </CardHeader>
        </Card>

        {/* Credits Section */}
        <div ref={creditsRef} className="mb-8">
          <Card className={`border-2 ${searchParams.includes("tab=credits") ? 'border-orange-400 ring-2 ring-orange-200' : 'border-orange-200/50'} bg-gradient-to-br from-orange-50 to-yellow-50`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Coins className="w-5 h-5 text-orange-600" />
                Card Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-32" />
                  <Skeleton className="h-16 w-32" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current Balance */}
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-white rounded-xl p-4 border border-green-200 flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <Gift className="w-4 h-4" />
                        <span className="text-sm font-medium">Free Cards</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        {credits?.freeRemaining || 0} <span className="text-sm font-normal">/ 2</span>
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-blue-200 flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <Coins className="w-4 h-4" />
                        <span className="text-sm font-medium">Paid Credits</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">
                        {credits?.paidCredits || 0}
                      </p>
                    </div>
                  </div>

                  {/* Status Message */}
                  {credits && (
                    <div className={`p-3 rounded-lg text-sm ${
                      credits.freeRemaining > 0 
                        ? 'bg-green-100 text-green-700'
                        : credits.paidCredits > 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                    }`}>
                      {credits.freeRemaining > 0 
                        ? `You have ${credits.freeRemaining} free card${credits.freeRemaining !== 1 ? 's' : ''} remaining. Enjoy!`
                        : credits.paidCredits > 0
                          ? `You have ${credits.paidCredits} paid credit${credits.paidCredits !== 1 ? 's' : ''} to use.`
                          : 'You\'ve used all your free cards. Top up to continue creating!'}
                    </div>
                  )}

                  {/* Buy More Credits */}
                  <div className="bg-white rounded-xl p-4 border border-orange-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      <span className="font-medium text-gray-800">Buy More Credits</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <button 
                        className="p-3 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-all text-center"
                        onClick={() => alert('Credit top-up coming soon!')}
                      >
                        <p className="text-lg font-bold text-orange-600">R50</p>
                        <p className="text-sm text-gray-600">5 cards</p>
                        <p className="text-xs text-gray-400">R10/card</p>
                      </button>
                      <button 
                        className="p-3 rounded-lg border-2 border-orange-300 bg-orange-50 hover:border-orange-400 transition-all text-center relative"
                        onClick={() => alert('Credit top-up coming soon!')}
                      >
                        <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs">Popular</Badge>
                        <p className="text-lg font-bold text-orange-600">R90</p>
                        <p className="text-sm text-gray-600">10 cards</p>
                        <p className="text-xs text-gray-400">R9/card</p>
                      </button>
                      <button 
                        className="p-3 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-all text-center"
                        onClick={() => alert('Credit top-up coming soon!')}
                      >
                        <p className="text-lg font-bold text-orange-600">R200</p>
                        <p className="text-sm text-gray-600">25 cards</p>
                        <p className="text-xs text-gray-400">R8/card</p>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-3 text-center">
                      Each AI-generated card costs us about R10 to create. Thank you for supporting our service!
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                My Cards
              </h2>
              <Link href="/create-card">
                <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  Create New
                </Button>
              </Link>
            </div>

            {cardsLoading ? (
              <div className="grid gap-4">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : cards && cards.length > 0 ? (
              <div className="grid gap-4">
                {cards.map((card) => (
                  <div 
                    key={card.id} 
                    className="bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all p-4"
                  >
                    <div className="flex gap-4">
                      {card.frontImageUrl || card.frontImagePath ? (
                        <img 
                          src={card.frontImagePath || `/api/cards/${card.id}/fast-front-image`}
                          alt="Card front"
                          className="w-20 h-20 rounded-lg object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                          <CreditCard className="w-8 h-8 text-purple-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-900">
                            {card.sceneType || "Custom Card"}
                          </p>
                          {getCardStatusBadge(card.status)}
                        </div>
                        <p className="text-sm text-gray-500 capitalize">{card.cardType} • {card.printOption}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Created {card.createdAt ? new Date(card.createdAt).toLocaleDateString() : "recently"}
                        </p>
                      </div>
                      <Link href={`/complete-order/${card.id}`}>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-purple-600">
                          <Eye className="w-5 h-5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="bg-gray-50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CreditCard className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">No cards yet</p>
                  <Link href="/create-card">
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                      Create Your First Card
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-pink-600" />
                Order History
              </h2>
            </div>

            {ordersLoading ? (
              <div className="space-y-4">
                <OrderSkeleton />
                <OrderSkeleton />
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div 
                    key={order.id}
                    className="bg-white rounded-xl border border-gray-200 hover:border-pink-300 hover:shadow-lg transition-all p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          Order #{order.paymentReference?.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-500">
                          R{(order.amount / 100).toFixed(2)} • {order.orderType}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {getOrderStatusBadge(order.orderStatus)}
                          <p className="text-xs text-gray-400 mt-1">
                            Payment: {order.paymentStatus}
                          </p>
                        </div>
                        <Link href={`/card-preview/${order.paymentReference}`}>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-pink-600">
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="bg-gray-50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Package className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">No orders yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Your orders will appear here after checkout
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
