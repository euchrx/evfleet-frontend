import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FeedbackKiosk from './pages/Feedback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/feedback" element={<FeedbackKiosk />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;