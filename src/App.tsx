/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import PhotoboothFlow from "./PhotoboothFlow";
import AdminDashboard from "./AdminDashboard";
import ClientShare from "./ClientShare";
import RemoteCam from "./RemoteCam";
import AuthPortal from "./AuthPortal";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPortal />} />
        <Route path="/photobooth" element={<PhotoboothFlow />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/share/:sessionId" element={<ClientShare />} />
        <Route path="/remote-cam" element={<RemoteCam />} />
      </Routes>
    </BrowserRouter>
  );
}
