import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useState, useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { IntroOverlay } from "@/components/IntroOverlay";
import { AiChatWidget } from "@/components/AiChatWidget";
import { InstallPromptModal } from "@/components/InstallPromptModal";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: "#fff", background: "#111", fontFamily: "monospace", minHeight: "100vh" }}>
          <h2 style={{ color: "#FFD600", marginBottom: 16 }}>Errore di rendering</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, opacity: 0.6, marginTop: 16 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Eager — critical on first paint
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

// Lazy — public pages
const About = lazy(() => import("@/pages/about"));
const Gallery = lazy(() => import("@/pages/gallery"));
const Academy = lazy(() => import("@/pages/academy"));
const CategoryDetail = lazy(() => import("@/pages/category-detail"));
const CourseDetail = lazy(() => import("@/pages/course-detail"));
const Access = lazy(() => import("@/pages/access"));
const ActivateCourse = lazy(() => import("@/pages/activate-course"));
const StudentDashboard = lazy(() => import("@/pages/student-dashboard"));
const Contact = lazy(() => import("@/pages/contact"));
const Register = lazy(() => import("@/pages/register"));
const Login = lazy(() => import("@/pages/login"));
const CustomerNotifications = lazy(() => import("@/pages/customer-notifications"));
const NotificationDetail = lazy(() => import("@/pages/notification-detail"));
const MyCourses = lazy(() => import("@/pages/my-courses"));
const CustomerChat = lazy(() => import("@/pages/chat"));
const Checkout = lazy(() => import("@/pages/checkout"));
const CheckoutSuccess = lazy(() => import("@/pages/checkout-success"));
const CheckoutCancel = lazy(() => import("@/pages/checkout-cancel"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const DeleteAccount = lazy(() => import("@/pages/delete-account"));
const CookiePolicy = lazy(() => import("@/pages/cookie-policy"));
const Returns = lazy(() => import("@/pages/returns"));
const Legal = lazy(() => import("@/pages/legal"));
const Faq = lazy(() => import("@/pages/faq"));

// Lazy — admin pages (never visited by regular users)
const AdminLogin = lazy(() => import("@/pages/admin/login"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminCourses = lazy(() => import("@/pages/admin/courses"));
const AdminAccessCodes = lazy(() => import("@/pages/admin/access-codes"));
const AdminDiscountCodes = lazy(() => import("@/pages/admin/discount-codes"));
const AdminPurchases = lazy(() => import("@/pages/admin/purchases"));
const AdminNotifications = lazy(() => import("@/pages/admin/notifications"));
const AdminGallery = lazy(() => import("@/pages/admin/gallery"));
const AdminContacts = lazy(() => import("@/pages/admin/contacts"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminKnowledgeBase = lazy(() => import("@/pages/admin/knowledge-base"));
const AdminAiQuestions = lazy(() => import("@/pages/admin/ai-questions"));
const AdminAiOverview = lazy(() => import("@/pages/admin/ai-overview"));
const AdminAiLogs = lazy(() => import("@/pages/admin/ai-logs"));
const AdminAiTest = lazy(() => import("@/pages/admin/ai-test"));
const AdminAccounts = lazy(() => import("@/pages/admin/accounts"));
const AdminChat = lazy(() => import("@/pages/admin/chat"));
const AdminBroadcast = lazy(() => import("@/pages/admin/broadcast"));
const AdminPaymentLinks = lazy(() => import("@/pages/admin/payment-links"));
const AdminAcademyCategories = lazy(() => import("@/pages/admin/academy-categories"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Minimal dark fallback — matches site background, no flash
const PageFallback = () => <div className="min-h-screen bg-black" />;

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
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
        <Route path="/delete-account" component={DeleteAccount} />
        <Route path="/elimina-account" component={DeleteAccount} />
        <Route path="/cookie-policy" component={CookiePolicy} />
        <Route path="/returns" component={Returns} />
        <Route path="/legal" component={Legal} />
        <Route path="/faq" component={Faq} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function ConditionalAiWidget() {
  const [location] = useLocation();
  const isAdmin = location === "/admin" || location.startsWith("/admin/");
  if (isAdmin) return null;
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
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}

export default App;
