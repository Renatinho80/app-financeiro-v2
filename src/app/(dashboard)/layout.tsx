"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { NotificationBanner } from "@/components/layout/notification-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState<string>();
  const [userEmail, setUserEmail] = useState<string>();

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      // Verifica limite de expiração da sessão (lógica para 12h)
      const expiry = localStorage.getItem("session_expiry");
      if (expiry && new Date().getTime() > parseInt(expiry)) {
        await supabase.auth.signOut();
        localStorage.removeItem("session_expiry");
        window.location.href = "/login";
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
        // Try to get name from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        setUserName(profile?.name || user.user_metadata?.name || user.email?.split("@")[0]);
      }
    };
    fetchUser();
    
    // Configura checagem periódica a cada 1 hora para expulsar usuário caso a aba fique aberta
    const interval = setInterval(() => {
      const expiry = localStorage.getItem("session_expiry");
      if (expiry && new Date().getTime() > parseInt(expiry)) {
        const supabase = createClient();
        supabase.auth.signOut().then(() => {
          localStorage.removeItem("session_expiry");
          window.location.href = "/login";
        });
      }
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen lg:min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          userName={userName}
          userEmail={userEmail}
        />
        <NotificationBanner />
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-auto">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
