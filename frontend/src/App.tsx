import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.pcss";
import LandingPage from "./pages/landing/LandingPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
