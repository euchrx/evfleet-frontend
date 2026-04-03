import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/Dashboard';
import FeedbackKiosk from './pages/Feedback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/feedback" element={<FeedbackKiosk />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;