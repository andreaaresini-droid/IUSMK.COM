import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { IntroOverlay } from "@/components/IntroOverlay";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import About from "@/pages/about";
import Gallery from "@/pages/gallery";
import Academy from "@/pages/academy";
import CategoryDetail from "@/pages/category-detail";
import CourseDetail from "@/pages/course-detail";
import Access from "@/pages/access";
import ActivateCourse from "@/pages/activate-course";
import StudentDashboard from "@/pages/student-dashboard";
import Contact from "@/pages/contact";
import Register from "@/pages/register";
import Login from "@/pages/login";
import CustomerNotifications from "@/pages/customer-notifications";
import NotificationDetail from "@/pages/notification-detail";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminCourses from "@/pages/admin/courses";
import AdminAccessCodes from "@/pages/admin/access-codes";
import AdminDiscountCodes from "@/pages/admin/discount-codes";
import AdminPurchases from "@/pages/admin/purchases";
import AdminNotifications from "@/pages/admin/notifications";
import AdminGallery from "@/pages/admin/gallery";
import AdminContacts from "@/pages/admin/contacts";
import AdminSettings from "@/pages/admin/settings";
import AdminKnowledgeBase from "@/pages/admin/knowledge-base";
import AdminAiQuestions from "@/pages/admin/ai-questions";
import AdminAiOverview from "@/pages/admin/ai-overview";
import AdminAiLogs from "@/pages/admin/ai-logs";
import AdminAiTest from "@/pages/admin/ai-test";
import AdminAccounts from "@/pages/admin/accounts";
import AdminChat from "@/pages/admin/chat";
import AdminBroadcast from "@/pages/admin/broadcast";
import AdminPaymentLinks from "@/pages/admin/payment-links";
import AdminAcademyCategories from "@/pages/admin/academy-categories";
import MyCourses from "@/pages/my-courses";
import CustomerChat from "@/pages/chat";
import { AiChatWidget } from "@/components/AiChatWidget";
import { InstallPromptModal } from "@/components/InstallPromptModal";
import Checkout from "@/pages/checkout";
import CheckoutSuccess from "@/pages/checkout-success";
import CheckoutCancel from "@/pages/checkout-cancel";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import CookiePolicy from "@/pages/cookie-policy";
import Returns from "@/pages/returns";
import Legal from "@/pages/legal";
import Faq from "@/pages/faq";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/academy" component={Academy} />
      <Route path="/academy/:categoryId" component={CategoryDetail} />
      <Route path="/course/:courseId" component={CourseDetail} />
      <Route path="/course/:courseId/activate" component={ActivateCourse} />
      <Route path="/access" component={Access} />
      <Route path="/dashboard" component={StudentDashboard} />
      <Route path="/contact" component={Contact} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route path="/notifications" component={CustomerNotifications} />
      <Route path="/notifications/:id" component={NotificationDetail} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/courses" component={AdminCourses} />
      <Route path="/admin/access-codes" component={AdminAccessCodes} />
      <Route path="/admin/discount-codes" component={AdminDiscountCodes} />
      <Route path="/admin/purchases" component={AdminPurchases} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/gallery" component={AdminGallery} />
      <Route path="/admin/contacts" component={AdminContacts} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/ai" component={AdminAiOverview} />
      <Route path="/admin/knowledge-base" component={AdminKnowledgeBase} />
      <Route path="/admin/ai-questions" component={AdminAiQuestions} />
      <Route path="/admin/ai-logs" component={AdminAiLogs} />
      <Route path="/admin/ai-test" component={AdminAiTest} />
      <Route path="/admin/accounts" component={AdminAccounts} />
      <Route path="/admin/chat" component={AdminChat} />
      <Route path="/admin/broadcast" component={AdminBroadcast} />
      <Route path="/admin/payment-links" component={AdminPaymentLinks} />
      <Route path="/admin/academy" component={AdminAcademyCategories} />
      <Route path="/my-courses" component={MyCourses} />
      <Route path="/chat" component={CustomerChat} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/checkout/cancel" component={CheckoutCancel} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/cookie-policy" component={CookiePolicy} />
      <Route path="/returns" component={Returns} />
      <Route path="/legal" component={Legal} />
      <Route path="/faq" component={Faq} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ConditionalAiWidget() {
  const [location] = useLocation();
  const isAdmin = location === "/admin" || location.startsWith("/admin/");
  if (isAdmin) {
    console.log("[ASSISTANT] mount skipped — admin route:", location);
    return null;
  }
  console.log("[ASSISTANT] mounted on route:", location);
  return <AiChatWidget />;
}

const INTRO_SESSION_KEY = "iusmk_intro_done";

function ScrollToTop() {
  const [pathname] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function App() {
  const [showIntro, setShowIntro] = useState<boolean>(
    () => !sessionStorage.getItem(INTRO_SESSION_KEY)
  );

  const handleIntroComplete = () => {
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    setShowIntro(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ScrollToTop />
            <Router />
            <ConditionalAiWidget />
            <InstallPromptModal />
          </WouterRouter>
          <Toaster />
          {showIntro && <IntroOverlay onComplete={handleIntroComplete} />}
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
