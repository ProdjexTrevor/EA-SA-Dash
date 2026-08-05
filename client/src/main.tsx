import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ScorecardPage } from "./pages/ScorecardPage";
import { TrendsPage } from "./pages/TrendsPage";
import { ManagementPage } from "./pages/ManagementPage";
import { RegionReportPage } from "./pages/RegionReportPage";
import { ComparePage } from "./pages/ComparePage";
import { HealthCheckPage } from "./pages/HealthCheckPage";
import { HealthMapPage } from "./pages/HealthMapPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { MoversPage } from "./pages/MoversPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { EngagementProfilePage } from "./pages/EngagementProfilePage";
import { StoriesPage } from "./pages/StoriesPage";
import { SharePage } from "./pages/SharePage";
import { WinWallPage } from "./pages/WinWallPage";
import { RiskRadarPage } from "./pages/RiskRadarPage";
import { WarRoomPage } from "./pages/WarRoomPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ManagementPage />} />
          <Route path="/region-report" element={<RegionReportPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/scorecard" element={<ScorecardPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/health-check" element={<HealthCheckPage />} />
          <Route path="/health-map" element={<HealthMapPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/wins" element={<WinWallPage />} />
          <Route path="/risk-radar" element={<RiskRadarPage />} />
          <Route path="/war-room" element={<WarRoomPage />} />
          <Route path="/movers" element={<MoversPage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/engagement/:engagementId" element={<EngagementProfilePage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/share" element={<SharePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>
);
