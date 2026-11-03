import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Gallery from "./pages/Gallery";
import Profile from "./pages/Profile";
import TimelinePage from "./pages/TimelinePage";
import SourcesPage from "./pages/SourcesPage";
import IntegratePage from "./pages/IntegratePage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inductees" element={<Gallery />} />
        <Route path="/inductees/:slug" element={<Profile />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/integrate" element={<IntegratePage />} />
        <Route path="*" element={<div className="container section"><h2>Page not found</h2></div>} />
      </Routes>
      <Footer />
    </>
  );
}
