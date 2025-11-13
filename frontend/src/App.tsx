import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.pcss";
import LandingPage from "./pages/landing/LandingPage";
import AppPage from "./pages/app/AppPage";
import { WalletProvider } from "./contexts/WalletContext";
import { ToastProvider } from "./contexts/ToastContext";

function App() {
  return (
    <WalletProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app/*" element={<AppPage />} />
          </Routes>
        </Router>
      </ToastProvider>
    </WalletProvider>
  );
}

export default App;
