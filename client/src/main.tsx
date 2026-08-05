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
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>
);
