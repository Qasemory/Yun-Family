import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Tasks from "./pages/Tasks.jsx";
import Prayer from "./pages/Prayer.jsx";
import Health from "./pages/Health.jsx";
import Family from "./pages/Family.jsx";
import Study from "./pages/Study.jsx";
import Lesson from "./pages/Lesson.jsx";
import Shop from "./pages/Shop.jsx";
import Store from "./pages/Store.jsx";
import GiftCard from "./pages/GiftCard.jsx";
import Settings from "./pages/Settings.jsx";

function Private({ children }) {
  const { loading, user } = useAuth();
  if (loading) return <div className="p-8 text-center text-muted">…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/store" element={<Store />} />
      <Route path="/store/:slug" element={<Store />} />
      <Route path="/login" element={<Login />} />
      <Route path="/gift/:orderId" element={<Private><GiftCard /></Private>} />
      <Route element={<Private><Layout /></Private>}>
        <Route path="/" element={<Home />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/prayer" element={<Prayer />} />
        <Route path="/health" element={<Health />} />
        <Route path="/family" element={<Family />} />
        <Route path="/study" element={<Study />} />
        <Route path="/lesson/:id" element={<Lesson />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
