import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Play from "./pages/Play";
import ComingSoon from "./pages/ComingSoon"
// import Simulate from "./pages/Simulate";
// import Stats from "./pages/Stats";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Play />} />
        <Route path="/simulate" element={<ComingSoon title="Simulate" />} />
        <Route path="/stats" element={<ComingSoon title="Stats" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;