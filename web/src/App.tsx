import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/home/Home";
import Play from "./pages/play/Play";
import Setup from "./pages/setup/Setup";
import History from "./pages/stats/History";
import Results from "./pages/stats/Results";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* one setup page for every mode; the old addresses lead there */}
        <Route path="/new" element={<FreshSetup />} />
        <Route path="/play" element={<Navigate to="/new?mode=play" replace />} />
        <Route path="/simulate" element={<Navigate to="/new?mode=simulate" replace />} />
        <Route path="/play/table" element={<Play />} />
        <Route path="/stats" element={<History />} />
        <Route path="/stats/:id" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}

// A new Setup for every visit, even from /new to /new (the "New" link while
// already there), so it starts again from the defaults.
function FreshSetup() {
  return <Setup key={useLocation().key} />;
}

export default App;
