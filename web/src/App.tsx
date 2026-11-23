import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/home/Home";
import Play from "./pages/play/Play";
import Setup from "./pages/play/setup/Setup";
import ComingSoon from "./pages/ComingSoon"
// import Simulate from "./pages/simulate/Simulate";
// import Stats from "./pages/stats/Stats";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Setup />} />
        <Route path="/play/table" element={<Play />} />
        <Route path="/simulate" element={<ComingSoon title="Simulate" />} />
        <Route path="/stats" element={<ComingSoon title="Stats" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;