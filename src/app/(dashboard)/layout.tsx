"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { NotificationBanner } from "@/components/layout/notification-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState<string>();
  const [userEmail, setUserEmail] = useState<string>();
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      // A validade da sessão é gerenciada pelo middleware server-side (src/lib/supabase/middleware.ts).
      // Aqui apenas carregamos os dados do perfil para exibição no header.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", user.id)
          .single();
        setUserName(profile?.name || user.user_metadata?.name || user.email?.split("@")[0]);
        setUserAvatarUrl(profile?.avatar_url || null);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen lg:min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
        />
        <NotificationBanner />
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      <BottomNav />
      <OnboardingWizard />
    </div>
  );
}
