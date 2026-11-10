import Home, { type Mode } from "./pages/Home";

export default function App() {
  // Placeholder until the Play / Simulate / Stats screens exist.
  const handleNavigate = (mode: Mode) => {
    console.log(`open ${mode}`);
  };

  return <Home onNavigate={handleNavigate} />;
}