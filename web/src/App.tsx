import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/home/Home";
import Play from "./pages/play/Play";
import Setup from "./pages/play/setup/Setup";
import Simulate from "./pages/simulate/Simulate";
import History from "./pages/stats/History";
import Results from "./pages/stats/Results";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Setup />} />
        <Route path="/play/table" element={<Play />} />
        <Route path="/simulate" element={<Simulate />} />
        <Route path="/stats" element={<History />} />
        <Route path="/stats/:id" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;