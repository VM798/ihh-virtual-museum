import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import ChatWidget from "./components/ChatWidget";
import Home from "./pages/Home";
import Gallery from "./pages/Gallery";
import Profile from "./pages/Profile";
import TimelinePage from "./pages/TimelinePage";
import SourcesPage from "./pages/SourcesPage";
import IntegratePage from "./pages/IntegratePage";
import SharePage from "./pages/SharePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import EducatorsPage from "./pages/EducatorsPage";
import MuseumPage from "./pages/MuseumPage";
import KidsPage from "./pages/KidsPage";
import SignInPage from "./pages/SignInPage";
import AccountPage from "./pages/AccountPage";

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
        <Route path="/museum" element={<MuseumPage />} />
        <Route path="/inductees" element={<Gallery />} />
        <Route path="/inductees/:slug" element={<Profile />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/educators" element={<EducatorsPage />} />
        <Route path="/educators/kids" element={<KidsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/integrate" element={<IntegratePage />} />
        <Route path="/signin" element={<SignInPage mode="signin" />} />
        <Route path="/register" element={<SignInPage mode="register" />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<div className="container section"><h2>Page not found</h2></div>} />
      </Routes>
      <Footer />
      <ChatWidget />
    </>
  );
}
