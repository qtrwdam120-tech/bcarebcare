import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Pages
import HomePage from "./pages/HomePage";
import CheckPage from "./pages/CheckPage";
import ComparPage from "./pages/ComparPage";
import InsurPage from "./pages/InsurPage";
import Step2Page from "./pages/Step2Page";
import Step3Page from "./pages/Step3Page";
import Step4Page from "./pages/Step4Page";
import Step5Page from "./pages/Step5Page";
import ThankYouPage from "./pages/ThankYouPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import CookiesPage from "./pages/CookiesPage";
import NotFound from "./pages/NotFound";
import DashboardPage from "./pages/DashboardPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/home-new" />} />
      <Route path="/home-new" component={HomePage} />
      <Route path="/check" component={CheckPage} />
      <Route path="/compar" component={ComparPage} />
      <Route path="/insur" component={InsurPage} />
      <Route path="/step2" component={Step2Page} />
      <Route path="/step3" component={Step3Page} />
      <Route path="/step4" component={Step4Page} />
      <Route path="/step5" component={Step5Page} />
      <Route path="/thank-you" component={ThankYouPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/cookies" component={CookiesPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
