import { Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import { fam } from "./lib/paths.js";
import Layout from "./components/Layout.jsx";
import { Login, ForgotPassword, ResetPassword, VerifyEmail } from "./pages/AuthPages.jsx";
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
import Friend from "./pages/Friend.jsx";
import Programs from "./pages/Programs.jsx";

function Private({ children }) {
  const { loading, user } = useAuth();
  if (loading) return <div className="p-8 text-center text-muted">…</div>;
  return user ? children : <Navigate to={fam("/login")} replace />;
}

// الروابط القديمة /store و /store/:slug تتحوّل للعناوين الجديدة مع الإبقاء على ?lang
function OldStoreRedirect() {
  const { slug } = useParams();
  const { search } = useLocation();
  return <Navigate to={`${slug ? `/p/${slug}` : "/"}${search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* المتجر العام للزبائن */}
      <Route path="/" element={<Store />} />
      <Route path="/p/:slug" element={<Store />} />
      <Route path="/store" element={<OldStoreRedirect />} />
      <Route path="/store/:slug" element={<OldStoreRedirect />} />

      {/* تطبيق العيلة */}
      <Route path="/family/login" element={<Login />} />
      <Route path="/family/forgot" element={<ForgotPassword />} />
      <Route path="/family/reset" element={<ResetPassword />} />
      <Route path="/family/verify-email" element={<VerifyEmail />} />
      <Route path="/family/gift/:orderId" element={<Private><GiftCard /></Private>} />
      <Route path="/family" element={<Private><Layout /></Private>}>
        <Route index element={<Home />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="prayer" element={<Prayer />} />
        <Route path="health" element={<Health />} />
        <Route path="feed" element={<Family />} />
        <Route path="study" element={<Study />} />
        <Route path="lesson/:id" element={<Lesson />} />
        <Route path="shop" element={<Shop />} />
        <Route path="settings" element={<Settings />} />
        <Route path="friend" element={<Friend />} />
        <Route path="programs" element={<Programs />} />
        <Route path="*" element={<Navigate to={fam()} replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
